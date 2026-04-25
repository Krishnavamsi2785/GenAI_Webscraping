/**
 * utils/api.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised Axios wrapper for all WebMind backend calls.
 * All methods throw normalised Error objects on failure.
 */

import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

const client = axios.create({
  baseURL: BASE,
  timeout: 180_000, // scraping large sites can take time
  headers: { "Content-Type": "application/json" },
});

// ── Response interceptor: normalise error messages ────────────────────────────
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const detail =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      "Unknown error";
    return Promise.reject(new Error(String(detail)));
  }
);

// ── API methods ───────────────────────────────────────────────────────────────

/** Current index status */
export const getStatus = () => client.get("/api/status").then((r) => r.data);

/**
 * Scrape a URL and build the vector index.
 * @param {object} params - ScrapeRequest body
 */
export const scrapeUrl = (params) =>
  client.post("/api/scrape", params).then((r) => r.data);

/**
 * Ask a natural-language question about the indexed content.
 * @param {string} question
 */
export const askQuestion = (question) =>
  client.post("/api/ask", { question }).then((r) => r.data);

/** Full chat history */
export const getHistory = () => client.get("/api/history").then((r) => r.data);

/** Delete all chat history */
export const clearHistory = () =>
  client.delete("/api/history").then((r) => r.data);

/**
 * Export scraped data.
 * Returns a Blob that can be turned into a download link.
 * @param {"json"|"csv"|"excel"} format
 * @param {string[]} [fields] - optional field filter
 */
export const exportData = async (format, fields = null) => {
  const mimeMap = {
    json:  "application/json",
    csv:   "text/csv",
    excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
  const extMap = { json: "json", csv: "csv", excel: "xlsx" };

  const response = await axios.post(
    `${BASE}/api/export`,
    { format, fields },
    { responseType: "blob", timeout: 60_000 }
  );

  const blob = new Blob([response.data], { type: mimeMap[format] });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `webmind_export.${extMap[format]}`;
  a.click();
  URL.revokeObjectURL(url);
};