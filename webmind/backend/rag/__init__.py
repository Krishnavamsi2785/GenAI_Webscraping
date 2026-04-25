"""
rag package – Chroma + Gemini Flash RAG pipeline.
"""
from .pipeline import (
    ask,
    build_index,
    retrieve,
    detect_sentiment,
    load_history,
    clear_history,
)

__all__ = [
    "ask",
    "build_index",
    "retrieve",
    "detect_sentiment",
    "load_history",
    "clear_history",
]