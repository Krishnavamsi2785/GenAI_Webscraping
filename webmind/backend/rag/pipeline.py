"""
rag/pipeline.py
────────────────────────────────────────────────────────────────────────────
RAG pipeline:
  – Chroma vector store  (persistent, auto-persists in ./storage/chroma_db)
  – HuggingFace embeddings  (all-MiniLM-L6-v2, runs locally, free)
  – Google Gemini 1.5 Flash  (free tier: 15 req/min, 1M token context)
  – TextBlob sentiment analysis
  – JSON chat history with timestamps

Why Gemini Flash over Groq llama3-70b?
  • 1 million token context window vs 8 192 tokens
  • 15 RPM free vs ~30 RPM but with hard daily cap
  • Better instruction following for extraction tasks
  • gemini-1.5-flash is free via Google AI Studio key
"""

import json
import logging
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import google.generativeai as genai
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
from textblob import TextBlob
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL   = os.getenv("GEMINI_MODEL", "gemini-flash-latest")

INDEX_DIR  = Path(os.getenv("INDEX_DIR", "./storage"))
CHROMA_DIR = INDEX_DIR / "chroma_db"
META_FILE  = INDEX_DIR / "metadata.json"
CHAT_FILE  = INDEX_DIR / "chat_history.json"

INDEX_DIR.mkdir(parents=True, exist_ok=True)

# ── Embedding model (local, no API key needed) ─────────────────────────────────
hf_embeddings = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2",
    model_kwargs={"device": "cpu"},
    encode_kwargs={"normalize_embeddings": True},
)

# ── Configure Gemini ───────────────────────────────────────────────────────────
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
else:
    logger.warning("[RAG] GEMINI_API_KEY not set – LLM calls will fail.")


# ── Text preparation ───────────────────────────────────────────────────────────

def _combine_page_content(page: Dict) -> str:
    """
    Combine all content fields of a page into a single indexed string.
    Structured data (price, rating, etc.) is included so the LLM can answer
    factual product questions.
    """
    parts: List[str] = []

    if page.get("title"):
        parts.append(f"TITLE: {page['title']}")

    meta = page.get("metadata") or {}
    if meta.get("description"):
        parts.append(f"DESCRIPTION: {meta['description']}")

    if page.get("text"):
        parts.append(page["text"])

    # Include structured product/article data
    structured = page.get("structured_data") or {}
    if structured:
        data_lines = [f"{k}: {v}" for k, v in structured.items() if v]
        if data_lines:
            parts.append("STRUCTURED DATA:\n" + "\n".join(data_lines))

    # Include image captions
    captions = [img["caption"] for img in (page.get("images") or []) if img.get("caption")]
    if captions:
        parts.append("IMAGE CAPTIONS: " + " | ".join(captions[:10]))

    return "\n\n".join(parts)


# ── Vector index ───────────────────────────────────────────────────────────────

def build_index(pages: List[Dict]) -> int:
    """
    Build (or rebuild) the Chroma vector index from scraped pages.
    Clears any existing collection first.
    Returns the number of documents indexed.
    """
    valid_pages = [p for p in pages if p.get("text") or p.get("structured_data")]
    if not valid_pages:
        raise ValueError("No extractable content found in scraped pages.")

    # ── Clear existing collection ──────────────────────────────────────────────
    try:
        import chromadb
        client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        try:
            client.delete_collection("langchain")
        except Exception:
            pass
    except Exception as exc:
        logger.warning(f"[RAG] Could not clear old Chroma collection: {exc}")

    # ── Prepare texts and clean metadata ──────────────────────────────────────
    texts: List[str] = []
    metadatas: List[Dict] = []

    for page in valid_pages:
        text = _combine_page_content(page)
        texts.append(text)

        # Chroma only accepts str/int/float/bool in metadata
        clean: Dict = {}
        for k, v in page.items():
            if isinstance(v, (str, int, float, bool)):
                clean[k] = v
            elif isinstance(v, dict):
                clean[k] = json.dumps(v)
            elif isinstance(v, list):
                clean[k] = json.dumps(v)
            else:
                clean[k] = str(v)
        metadatas.append(clean)

    # ── Create new Chroma collection ───────────────────────────────────────────
    Chroma.from_texts(
        texts=texts,
        embedding=hf_embeddings,
        persist_directory=str(CHROMA_DIR),
        metadatas=metadatas,
    )

    # ── Persist metadata for state restore on restart ──────────────────────────
    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump(valid_pages, f, ensure_ascii=False, indent=2)

    logger.info(f"[RAG] Indexed {len(valid_pages)} pages → Chroma DB at {CHROMA_DIR}")
    return len(valid_pages)


def _load_db() -> Optional[Chroma]:
    """Load existing Chroma DB from disk. Returns None if not built yet."""
    if not CHROMA_DIR.exists():
        return None
    try:
        return Chroma(
            persist_directory=str(CHROMA_DIR),
            embedding_function=hf_embeddings,
        )
    except Exception as exc:
        logger.error(f"[RAG] Failed to load Chroma DB: {exc}")
        return None


def retrieve(query: str, k: int = 5) -> List[Dict]:
    """
    Retrieve the top-k most relevant documents for a query.
    Returns list of metadata dicts with '_text' key added.
    """
    db = _load_db()
    if db is None:
        logger.warning("[RAG] No index found. Run build_index first.")
        return []

    try:
        results = db.similarity_search_with_relevance_scores(query, k=k)
    except Exception as exc:
        logger.error(f"[RAG] Similarity search failed: {exc}")
        return []

    pages: List[Dict] = []
    for doc, score in results:
        meta = dict(doc.metadata)
        meta["_text"]  = doc.page_content
        meta["_score"] = round(score, 4)
        pages.append(meta)

    return pages


# ── Sentiment ──────────────────────────────────────────────────────────────────

def detect_sentiment(text: str) -> Dict:
    """Return polarity score and tone label for a given text."""
    polarity = TextBlob(text).sentiment.polarity
    if polarity > 0.15:
        tone = "positive"
    elif polarity < -0.15:
        tone = "negative"
    else:
        tone = "neutral"
    return {"polarity": round(polarity, 4), "tone": tone}


# ── Gemini LLM ─────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are WebMind, an expert AI assistant that answers questions \
STRICTLY based on the provided website context below.

Rules:
1. Answer ONLY from the provided context. Do NOT hallucinate.
2. If the answer is not in the context, say: "This information was not found in the scraped content."
3. Format your answer using clear Markdown: use tables for comparisons, bullet lists for items, bold for key facts.
4. For product data: always include price, rating, and availability if present in context.
5. For comparisons: use a Markdown table.
6. Always end with a "📌 Sources" section listing the source URLs.
7. Be concise but complete.
"""


def _build_context(results: List[Dict], max_chars: int = 80_000) -> Tuple[str, List[str]]:
    """
    Build context string from retrieved docs.
    Uses a generous character budget (Gemini Flash has 1M token context).
    Returns (context_string, list_of_source_urls).
    """
    parts: List[str] = []
    sources: List[str] = []
    total = 0

    for r in results:
        text = r.get("_text", "")
        url  = r.get("url", "")
        if url and url not in sources:
            sources.append(url)

        chunk = f"[Source: {url}]\n{text}\n"
        if total + len(chunk) > max_chars:
            # Truncate last chunk to fit budget
            remaining = max_chars - total
            if remaining > 200:
                parts.append(chunk[:remaining])
            break

        parts.append(chunk)
        total += len(chunk)

    return "\n---\n".join(parts), sources


def generate_answer(question: str, context: str, sources: List[str]) -> str:
    """
    Call Gemini Flash to generate an answer grounded in the provided context.
    """
    if not GEMINI_API_KEY:
        raise EnvironmentError(
            "GEMINI_API_KEY not set. Get a free key at https://aistudio.google.com/app/apikey"
        )

    model = genai.GenerativeModel(
        model_name=GEMINI_MODEL,
        system_instruction=SYSTEM_PROMPT,
        generation_config=genai.GenerationConfig(
            temperature=0.15,
            max_output_tokens=2048,
        ),
    )

    user_prompt = f"""Website Context:
{context}

Question: {question}

Answer based only on the context above:"""

    try:
        response = model.generate_content(user_prompt)
        answer = response.text.strip()
    except Exception as exc:
        logger.exception(f"[RAG] Gemini call failed: {exc}")
        raise RuntimeError(f"LLM generation failed: {exc}") from exc

    if sources:
        answer += "\n\n📌 **Sources:**\n" + "\n".join(f"- {s}" for s in sources)

    return answer


# ── Chat history ───────────────────────────────────────────────────────────────

def load_history() -> List[Dict]:
    """Load Q&A history from disk."""
    if CHAT_FILE.exists():
        try:
            with open(CHAT_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            return []
    return []


def save_history(history: List[Dict]) -> None:
    """Persist Q&A history to disk."""
    with open(CHAT_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, ensure_ascii=False, indent=2)


def clear_history() -> None:
    """Delete chat history file."""
    if CHAT_FILE.exists():
        CHAT_FILE.unlink()


# ── Main ask entrypoint ────────────────────────────────────────────────────────

def ask(question: str) -> Tuple[str, List[Dict], Dict]:
    """
    Full RAG pipeline:
      1. Retrieve top-k relevant chunks from Chroma
      2. Build context string
      3. Generate answer with Gemini Flash
      4. Detect sentiment
      5. Save to history

    Returns: (answer, source_docs, sentiment_dict)
    """
    results = retrieve(question, k=5)

    if not results:
        return (
            "⚠️ No relevant content found. Please scrape a website first.",
            [],
            {"polarity": 0.0, "tone": "neutral"},
        )

    context, sources = _build_context(results)
    answer    = generate_answer(question, context, sources)
    sentiment = detect_sentiment(answer)

    # Persist to history
    history = load_history()
    history.append({
        "time":      datetime.now().isoformat(),
        "question":  question,
        "answer":    answer,
        "sentiment": sentiment,
        "sources":   sources,
    })
    save_history(history)

    return answer, results, sentiment