/**
 * hooks/useScraper.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom hook encapsulating all scraping, asking, history, and export state.
 */

import { useState, useCallback, useEffect } from "react";
import {
  getStatus,
  scrapeUrl,
  askQuestion,
  getHistory,
  clearHistory,
  exportData,
} from "../utils/api";

export function useScraper() {
  // ── Status ──────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState({
    indexed: false,
    documents_count: 0,
    last_scraped_url: null,
    message: "",
  });

  // ── Scrape ──────────────────────────────────────────────────────────────────
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeResult, setScrapeResult]   = useState(null);
  const [scrapeError, setScrapeError]     = useState(null);

  // ── Chat ────────────────────────────────────────────────────────────────────
  const [messages, setMessages]   = useState([]);
  const [askLoading, setAskLoading] = useState(false);

  // ── History ──────────────────────────────────────────────────────────────────
  const [history, setHistory] = useState([]);

  // ── Export ───────────────────────────────────────────────────────────────────
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError]     = useState(null);

  // ── Bootstrap: load status + history on mount ────────────────────────────────
  useEffect(() => {
    getStatus().then(setStatus).catch(() => {});
    getHistory()
      .then((d) => setHistory(d.history || []))
      .catch(() => {});
  }, []);

  // ── Scrape ───────────────────────────────────────────────────────────────────
  const scrape = useCallback(async (params) => {
    setScrapeLoading(true);
    setScrapeError(null);
    setScrapeResult(null);

    try {
      const result = await scrapeUrl(params);
      setScrapeResult(result);
      setStatus((prev) => ({
        ...prev,
        indexed:          true,
        documents_count:  result.documents_indexed,
        last_scraped_url: params.url,
      }));
      return result;
    } catch (err) {
      setScrapeError(err.message);
      throw err;
    } finally {
      setScrapeLoading(false);
    }
  }, []);

  // ── Ask ──────────────────────────────────────────────────────────────────────
  const ask = useCallback(async (question) => {
    if (!question.trim()) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setAskLoading(true);

    try {
      const result = await askQuestion(question);
      setMessages((prev) => [
        ...prev,
        {
          role:      "assistant",
          content:   result.answer,
          sentiment: result.sentiment,
          sources:   result.sources,
        },
      ]);
      // Refresh history after each answer
      getHistory()
        .then((d) => setHistory(d.history || []))
        .catch(() => {});
      return result;
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `❌ Error: ${err.message}`, isError: true },
      ]);
    } finally {
      setAskLoading(false);
    }
  }, []);

  // ── Delete history ────────────────────────────────────────────────────────────
  const deleteHistory = useCallback(async () => {
    await clearHistory();
    setHistory([]);
  }, []);

  // ── Export ────────────────────────────────────────────────────────────────────
  const doExport = useCallback(async (format, fields = null) => {
    setExportLoading(true);
    setExportError(null);
    try {
      await exportData(format, fields);
    } catch (err) {
      setExportError(err.message);
    } finally {
      setExportLoading(false);
    }
  }, []);

  return {
    status,
    scrapeLoading, scrapeResult, scrapeError, scrape,
    messages, setMessages, askLoading, ask,
    history, deleteHistory,
    exportLoading, exportError, doExport,
  };
}