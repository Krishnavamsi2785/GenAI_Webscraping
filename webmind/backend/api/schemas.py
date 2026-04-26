"""
api/schemas.py
────────────────────────────────────────────────────────────────────────────
Pydantic v2 request/response models for all API endpoints.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ── Scrape ────────────────────────────────────────────────────────────────────

class ScrapeRequest(BaseModel):
    """Body for POST /api/scrape"""

    url: str = Field(..., description="Target URL to scrape")

    max_pages: int = Field(
        default=10, ge=1, le=100,
        description="Maximum listing/pagination pages to visit"
    )
    scrape_detail_pages: bool = Field(
        default=False,
        description="Navigate into each product/article link for full detail"
    )
    detail_selector: str = Field(
        default="h3 > a, .product_pod a, article a, a[href*='product'], a[href*='item']",
        description="CSS selector for detail-page links on listing pages"
    )
    click_selector: Optional[str] = Field(
        default=None,
        description="CSS selector to click before scraping (e.g. cookie banners, career tabs)"
    )
    max_details_per_page: int = Field(
        default=5, ge=1, le=30,
        description="Maximum detail pages to visit per listing page"
    )
    use_search: bool = Field(
        default=False,
        description="Attempt to use the site's own search box before scraping"
    )
    search_query: Optional[str] = Field(
        default=None,
        description="Query to type into the site's search box"
    )
    fields: Optional[List[str]] = Field(
        default=None,
        description="Specific data fields to extract (e.g. ['price', 'title', 'rating'])"
    )


class PageResult(BaseModel):
    """Single scraped page result."""
    url: str
    title: str
    text: str
    metadata: Dict[str, Any]
    images: List[Dict[str, str]]
    page_number: float
    structured_data: Optional[Dict[str, Any]] = None


class ScrapeResponse(BaseModel):
    """Response for POST /api/scrape"""
    success: bool
    pages_scraped: int
    documents_indexed: int
    pages: List[PageResult]
    message: str


# ── Export ────────────────────────────────────────────────────────────────────

class ExportRequest(BaseModel):
    """Body for POST /api/export"""
    format: str = Field(..., description="Export format: json | csv | excel")
    fields: Optional[List[str]] = Field(
        default=None,
        description="Specific fields to include in export"
    )


# ── Ask ───────────────────────────────────────────────────────────────────────

class AskRequest(BaseModel):
    """Body for POST /api/ask"""
    question: str = Field(..., min_length=3, description="Question about the scraped website")


class SentimentResult(BaseModel):
    polarity: float
    tone: str


class AskResponse(BaseModel):
    """Response for POST /api/ask"""
    answer: str
    sentiment: SentimentResult
    sources: List[str]
    sources_count: int


# ── History ───────────────────────────────────────────────────────────────────

class HistoryEntry(BaseModel):
    time: str
    question: str
    answer: str
    sentiment: Optional[Dict] = None
    sources: Optional[List[str]] = None


class HistoryResponse(BaseModel):
    history: List[HistoryEntry]
    total: int


# ── Status ────────────────────────────────────────────────────────────────────

class StatusResponse(BaseModel):
    indexed: bool
    documents_count: int
    last_scraped_url: Optional[str]
    message: str


# ── Smart Scrape ──────────────────────────────────────────────────────────────

class SmartScrapeRequest(BaseModel):
    """Body for POST /api/smart-scrape"""
    url: str = Field(..., description="Target website URL")
    search_query: str = Field(..., description="What to search for (e.g. book name)")
    extraction_prompt: str = Field(
        default="Extract the context and description of this item based on the text.",
        description="Prompt telling the LLM what to extract from the scraped page."
    )

class SmartScrapeResponse(BaseModel):
    """Response for POST /api/smart-scrape"""
    success: bool
    extracted_data: str
    source_url: str
    message: str