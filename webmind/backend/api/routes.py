"""
api/routes.py
────────────────────────────────────────────────────────────────────────────
FastAPI router defining all WebMind endpoints:
  GET  /api/status        – index health check
  POST /api/scrape        – scrape + index a URL
  POST /api/ask           – RAG question answering
  POST /api/export        – download scraped data as JSON/CSV/Excel
  GET  /api/history       – chat history
  DELETE /api/history     – clear chat history
"""

import io
import csv
import json
import logging
from typing import Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse

from scraper import scrape_website
from rag import ask, build_index, load_history, clear_history
from .schemas import (
    ScrapeRequest, ScrapeResponse, PageResult,
    AskRequest, AskResponse, SentimentResult,
    HistoryResponse, HistoryEntry,
    StatusResponse, ExportRequest,
)
from .state import app_state

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


# ── Status ─────────────────────────────────────────────────────────────────────

@router.get("/status", response_model=StatusResponse, tags=["Info"])
async def get_status():
    """Return current index state."""
    return StatusResponse(
        indexed=app_state.is_indexed,
        documents_count=app_state.documents_count,
        last_scraped_url=app_state.last_scraped_url,
        message="Ready" if app_state.is_indexed else "No website indexed yet. Scrape a URL first.",
    )


# ── Scrape ─────────────────────────────────────────────────────────────────────

@router.post("/scrape", response_model=ScrapeResponse, tags=["Scraper"])
async def scrape_endpoint(body: ScrapeRequest):
    """
    Scrape a target URL (static or JS-rendered) and build a Chroma vector index.

    Supports:
    - Pagination / infinite scroll
    - Deep crawl (product/article detail pages)
    - Search-first strategy
    - Click-to-reveal content (career sections, cookie banners, etc.)
    """
    logger.info(f"[API] Scrape request → {body.url}")

    try:
        pages = await scrape_website(
            start_url=body.url,
            max_pages=body.max_pages,
            scrape_detail_pages=body.scrape_detail_pages,
            detail_selector=body.detail_selector,
            click_selector=body.click_selector,
            max_details_per_page=body.max_details_per_page,
            use_search=body.use_search,
            search_query=body.search_query,
            target_fields=body.fields,
        )
    except Exception as exc:
        logger.exception(f"[API] Scrape failed: {exc}")
        message = str(exc).strip() or repr(exc)
        raise HTTPException(
            status_code=500,
            detail=f"Scraping failed ({exc.__class__.__name__}): {message}",
        )

    if not pages:
        raise HTTPException(
            status_code=422,
            detail="No content could be extracted. The site may block bots or require login."
        )

    try:
        n_docs = build_index(pages)
    except Exception as exc:
        logger.exception(f"[API] Index build failed: {exc}")
        raise HTTPException(status_code=500, detail=f"Index build failed: {str(exc)}")

    # ── Update in-memory state ────────────────────────────────────────────────
    app_state.is_indexed      = True
    app_state.documents_count = n_docs
    app_state.last_scraped_url = body.url
    app_state.scraped_pages   = pages

    # ── Build response ────────────────────────────────────────────────────────
    page_results = [
        PageResult(
            url=p["url"],
            title=p.get("title", p["url"]),
            text=(p.get("text", "")[:500] + "…") if len(p.get("text", "")) > 500 else p.get("text", ""),
            metadata=p.get("metadata", {}),
            images=p.get("images", [])[:5],
            page_number=p.get("page_number", 0),
            structured_data=p.get("structured_data"),
        )
        for p in pages
    ]

    return ScrapeResponse(
        success=True,
        pages_scraped=len(pages),
        documents_indexed=n_docs,
        pages=page_results,
        message=f"Successfully scraped {len(pages)} pages and indexed {n_docs} documents.",
    )


# ── Export ─────────────────────────────────────────────────────────────────────

@router.post("/export", tags=["Export"])
async def export_endpoint(body: ExportRequest):
    """
    Export all scraped data as JSON, CSV, or Excel.
    Optionally filter to specific fields.
    """
    if not app_state.is_indexed or not app_state.scraped_pages:
        raise HTTPException(status_code=400, detail="No scraped data available. Run /scrape first.")

    pages = app_state.scraped_pages
    fmt   = body.format.lower()

    # ── Flatten pages to rows ─────────────────────────────────────────────────
    rows = []
    for p in pages:
        row = {
            "url":         p.get("url", ""),
            "title":       p.get("title", ""),
            "text":        p.get("text", ""),
            "page_number": p.get("page_number", 0),
        }
        # Flatten metadata
        for k, v in (p.get("metadata") or {}).items():
            row[f"meta_{k}"] = v
        # Flatten structured_data
        for k, v in (p.get("structured_data") or {}).items():
            row[f"data_{k}"] = v if not isinstance(v, list) else "; ".join(str(i) for i in v)

        if body.fields:
            row = {k: row[k] for k in body.fields if k in row}

        rows.append(row)

    # ── JSON ──────────────────────────────────────────────────────────────────
    if fmt == "json":
        content = json.dumps(rows, ensure_ascii=False, indent=2)
        return StreamingResponse(
            io.BytesIO(content.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=webmind_export.json"},
        )

    # ── CSV ───────────────────────────────────────────────────────────────────
    if fmt == "csv":
        if not rows:
            raise HTTPException(status_code=422, detail="No data to export.")
        buf = io.StringIO()
        writer = csv.DictWriter(buf, fieldnames=list(rows[0].keys()), extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
        return StreamingResponse(
            io.BytesIO(buf.getvalue().encode("utf-8-sig")),  # utf-8-sig for Excel compat
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=webmind_export.csv"},
        )

    # ── Excel ─────────────────────────────────────────────────────────────────
    if fmt == "excel":
        df  = pd.DataFrame(rows)
        buf = io.BytesIO()
        with pd.ExcelWriter(buf, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Scraped Data")
            # Auto-size columns
            ws = writer.sheets["Scraped Data"]
            for col in ws.columns:
                max_len = max(len(str(cell.value or "")) for cell in col)
                ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 60)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=webmind_export.xlsx"},
        )

    raise HTTPException(status_code=400, detail=f"Unsupported format: '{fmt}'. Use json, csv, or excel.")


# ── Ask ────────────────────────────────────────────────────────────────────────

@router.post("/ask", response_model=AskResponse, tags=["RAG"])
async def ask_endpoint(body: AskRequest):
    """Answer a natural-language question using the indexed website content."""
    if not app_state.is_indexed:
        raise HTTPException(
            status_code=400,
            detail="No website indexed yet. Please run /scrape first."
        )

    logger.info(f"[API] Ask → {body.question}")

    try:
        answer, sources, sentiment = ask(body.question)
    except Exception as exc:
        logger.exception(f"[API] Ask failed: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))

    source_urls = list({s.get("url") for s in sources if "url" in s})

    return AskResponse(
        answer=answer,
        sentiment=SentimentResult(**sentiment),
        sources=source_urls,
        sources_count=len(source_urls),
    )


# ── History ────────────────────────────────────────────────────────────────────

@router.get("/history", response_model=HistoryResponse, tags=["History"])
async def get_history():
    """Return all past Q&A pairs."""
    history = load_history()
    entries = [HistoryEntry(**h) for h in history]
    return HistoryResponse(history=entries, total=len(entries))


@router.delete("/history", tags=["History"])
async def delete_history():
    """Clear all chat history."""
    clear_history()
    return JSONResponse(content={"success": True, "message": "History cleared."})