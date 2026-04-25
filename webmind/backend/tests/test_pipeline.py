"""
tests/test_pipeline.py
────────────────────────────────────────────────────────────────────────────
Unit & integration tests for the WebMind RAG pipeline and scraper utilities.

Run:
    pytest tests/ -v
"""

import json
import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock


# ── Scraper utility tests ──────────────────────────────────────────────────────

class TestExtractors:
    """Tests for HTML extraction helpers."""

    SAMPLE_HTML = """
    <html>
    <head>
        <title>Test Product Page</title>
        <meta name="description" content="Best product ever">
        <meta property="og:title" content="OG Test Title">
        <script type="application/ld+json">
            {"@type": "Product", "name": "Widget Pro", "price": "29.99"}
        </script>
    </head>
    <body>
        <h1>Widget Pro</h1>
        <span class="price">$29.99</span>
        <span class="rating" aria-label="4.5 out of 5">★★★★½</span>
        <p>This is a great product for testing purposes.</p>
        <img src="/img/product.jpg" alt="Widget Pro Image">
    </body>
    </html>
    """

    def test_extract_metadata(self):
        from scraper.playwright_scraper import _extract_metadata
        meta = _extract_metadata(self.SAMPLE_HTML)
        assert meta["title"] == "Test Product Page"
        assert meta["description"] == "Best product ever"
        assert meta["og_title"] == "OG Test Title"

    def test_extract_images(self):
        from scraper.playwright_scraper import _extract_images
        images = _extract_images(self.SAMPLE_HTML, "https://example.com")
        assert len(images) == 1
        assert images[0]["caption"] == "Widget Pro Image"
        assert "example.com" in images[0]["src"]

    def test_extract_structured_data_jsonld(self):
        from scraper.playwright_scraper import _extract_structured_data
        data = _extract_structured_data(self.SAMPLE_HTML)
        assert data.get("name") == "Widget Pro"

    def test_extract_structured_data_price_fallback(self):
        """Price extracted via CSS selector when JSON-LD is absent."""
        from scraper.playwright_scraper import _extract_structured_data
        html = '<html><body><span class="price">$49.99</span></body></html>'
        data = _extract_structured_data(html)
        assert "price" in data
        assert "49.99" in data["price"]

    def test_extract_text_bs4_removes_boilerplate(self):
        from scraper.playwright_scraper import _extract_text_bs4
        html = """
        <html><body>
        <nav>Navigation junk</nav>
        <main><p>This is the main content paragraph about products.</p></main>
        <footer>Footer junk</footer>
        </body></html>
        """
        text = _extract_text_bs4(html)
        assert "main content" in text
        assert "Navigation" not in text
        assert "Footer" not in text

    def test_build_page_result_structure(self):
        from scraper.playwright_scraper import _build_page_result
        result = _build_page_result("https://example.com", self.SAMPLE_HTML, 1.0)
        assert result["url"] == "https://example.com"
        assert result["title"] == "Test Product Page"
        assert isinstance(result["images"], list)
        assert isinstance(result["metadata"], dict)
        assert isinstance(result["structured_data"], dict)
        assert result["page_number"] == 1.0


# ── RAG pipeline tests ─────────────────────────────────────────────────────────

class TestRAGPipeline:
    """Tests for RAG utility functions."""

    def test_combine_page_content_all_fields(self):
        from rag.pipeline import _combine_page_content
        page = {
            "title": "Test Page",
            "metadata": {"description": "A test page"},
            "text": "Main body content.",
            "structured_data": {"price": "$10.00", "rating": "4/5"},
            "images": [{"caption": "Product image", "src": "img.jpg"}],
        }
        content = _combine_page_content(page)
        assert "TITLE: Test Page" in content
        assert "DESCRIPTION: A test page" in content
        assert "Main body content." in content
        assert "price: $10.00" in content
        assert "Product image" in content

    def test_detect_sentiment_positive(self):
        from rag.pipeline import detect_sentiment
        result = detect_sentiment("This is an absolutely fantastic product, highly recommended!")
        assert result["tone"] == "positive"
        assert result["polarity"] > 0

    def test_detect_sentiment_negative(self):
        from rag.pipeline import detect_sentiment
        result = detect_sentiment("This is terrible, awful, completely broken and useless.")
        assert result["tone"] == "negative"
        assert result["polarity"] < 0

    def test_detect_sentiment_neutral(self):
        from rag.pipeline import detect_sentiment
        result = detect_sentiment("The product has a blue color and weighs 500 grams.")
        assert result["tone"] == "neutral"

    def test_chat_history_save_load_clear(self, tmp_path, monkeypatch):
        """Full save/load/clear cycle for chat history."""
        import rag.pipeline as pipeline
        monkeypatch.setattr(pipeline, "CHAT_FILE", tmp_path / "chat_history.json")

        pipeline.save_history([{"time": "2024-01-01", "question": "Q", "answer": "A"}])
        loaded = pipeline.load_history()
        assert len(loaded) == 1
        assert loaded[0]["question"] == "Q"

        pipeline.clear_history()
        assert pipeline.load_history() == []

    def test_build_context_respects_budget(self):
        from rag.pipeline import _build_context
        # Create docs that together exceed a small budget
        docs = [{"_text": "A" * 1000, "url": "https://a.com"},
                {"_text": "B" * 1000, "url": "https://b.com"}]
        context, sources = _build_context(docs, max_chars=500)
        assert len(context) <= 600   # small buffer for formatting
        assert "https://a.com" in sources


# ── API route tests ────────────────────────────────────────────────────────────

class TestAPIRoutes:
    """Integration-level tests using TestClient (no live browser)."""

    @pytest.fixture
    def client(self):
        from fastapi.testclient import TestClient
        from main import app
        return TestClient(app)

    def test_status_endpoint_not_indexed(self, client):
        resp = client.get("/api/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "indexed" in data
        assert "documents_count" in data

    def test_ask_without_index_returns_400(self, client):
        from api.state import app_state
        app_state.is_indexed = False
        resp = client.post("/api/ask", json={"question": "What products are here?"})
        assert resp.status_code == 400

    def test_history_endpoints(self, client):
        resp = client.get("/api/history")
        assert resp.status_code == 200
        data = resp.json()
        assert "history" in data
        assert "total" in data

    def test_export_without_data_returns_400(self, client):
        from api.state import app_state
        app_state.is_indexed = False
        app_state.scraped_pages = []
        resp = client.post("/api/export", json={"format": "json"})
        assert resp.status_code == 400

    def test_export_invalid_format(self, client):
        from api.state import app_state
        app_state.is_indexed = True
        app_state.scraped_pages = [{"url": "x", "text": "y", "title": "z",
                                     "metadata": {}, "structured_data": {}}]
        resp = client.post("/api/export", json={"format": "xml"})
        assert resp.status_code == 400

    def test_root_endpoint(self, client):
        resp = client.get("/")
        assert resp.status_code == 200
        assert resp.json()["name"] == "WebMind API"