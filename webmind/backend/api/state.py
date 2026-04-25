"""
api/state.py
────────────────────────────────────────────────────────────────────────────
Shared in-memory application state (singleton pattern).
Restored from disk on startup so server restarts don't lose index info.
"""

from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path
import json
import os

INDEX_DIR = Path(os.getenv("INDEX_DIR", "./storage"))
META_FILE = INDEX_DIR / "metadata.json"


@dataclass
class AppState:
    """Mutable singleton that all route handlers read/write."""

    is_indexed:       bool          = False
    documents_count:  int           = 0
    last_scraped_url: Optional[str] = None
    scraped_pages:    list          = field(default_factory=list)  # raw pages cache

    def __post_init__(self):
        """Restore state if a Chroma index exists from a previous run."""
        if META_FILE.exists():
            try:
                pages = json.loads(META_FILE.read_text(encoding="utf-8"))
                if pages:
                    self.is_indexed      = True
                    self.documents_count = len(pages)
                    self.last_scraped_url = pages[0].get("url")
                    self.scraped_pages   = pages
            except Exception:
                pass  # corrupt file – start fresh


# Global singleton shared across all request handlers
app_state = AppState()