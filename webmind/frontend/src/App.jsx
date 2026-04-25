/**
 * App.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Root component. Three-panel layout:
 *   [ScrapePanel] | [ChatPanel] | [HistoryPanel (toggle)]
 * Export controls live inside ScrapePanel after a successful scrape.
 */

import { useState } from "react";
import { useScraper } from "./hooks/useScraper";
import ScrapePanel  from "./components/ScrapePanel";
import ChatPanel    from "./components/ChatPanel";
import HistoryPanel from "./components/HistoryPanel";
import { Brain, Clock, Github, Wifi, WifiOff } from "lucide-react";

export default function App() {
  const {
    status,
    scrapeLoading, scrapeResult, scrapeError, scrape,
    messages, askLoading, ask,
    history, deleteHistory,
    exportLoading, exportError, doExport,
  } = useScraper();

  const [showHistory, setShowHistory] = useState(false);

  return (
    <div className="relative min-h-screen flex flex-col" style={{ zIndex: 1 }}>

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="border-b border-border bg-panel/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-[1500px] mx-auto px-6 py-4 flex items-center justify-between">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center glow-pulse">
              <Brain size={18} className="text-accent" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-text text-lg leading-none tracking-tight">
                Web<span className="text-accent">Mind</span>
              </h1>
              <p className="text-dim text-xs">Agentic Web Scraper + RAG</p>
            </div>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* Connection status badge */}
            <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
              status.indexed
                ? "bg-accent/10 border-accent/30 text-accent"
                : "bg-dim/10 border-dim/20 text-dim"
            }`}>
              {status.indexed ? <Wifi size={11} /> : <WifiOff size={11} />}
              {status.indexed ? `${status.documents_count} docs indexed` : "Not indexed"}
            </div>

            {/* History toggle */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${
                showHistory
                  ? "bg-accent/10 border-accent/30 text-accent"
                  : "bg-panel border-border text-dim hover:text-text hover:border-dim"
              }`}
            >
              <Clock size={11} />
              History {history.length > 0 && `(${history.length})`}
            </button>
          </div>
        </div>
      </header>

      {/* ── Main layout ──────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-[1500px] mx-auto w-full px-6 py-6 flex gap-5">

        {/* Left panel: scrape controls + export */}
        <ScrapePanel
          status={status}
          scrapeLoading={scrapeLoading}
          scrapeResult={scrapeResult}
          scrapeError={scrapeError}
          onScrape={scrape}
          exportLoading={exportLoading}
          exportError={exportError}
          onExport={doExport}
        />

        {/* Centre panel: chat interface */}
        <div className="flex-1 flex flex-col bg-panel border border-border rounded-2xl p-5 min-h-[70vh]">
          <div className="flex items-center gap-2 mb-5 pb-4 border-b border-border">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse-slow" />
            <span className="font-display font-bold text-xs text-dim tracking-wider">CHAT INTERFACE</span>
            {askLoading && (
              <span className="text-dim text-xs font-mono ml-auto animate-pulse">thinking…</span>
            )}
          </div>
          <ChatPanel
            messages={messages}
            askLoading={askLoading}
            status={status}
            onAsk={ask}
          />
        </div>

        {/* Right panel: history (collapsible) */}
        {showHistory && (
          <HistoryPanel
            history={history}
            onClear={deleteHistory}
            onClose={() => setShowHistory(false)}
          />
        )}
      </main>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-4 px-6">
        <div className="max-w-[1500px] mx-auto flex items-center justify-between text-dim text-xs">
          <span className="font-mono">WebMind v2.0 · Gemini Flash · Chroma · Playwright</span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-text transition-colors"
          >
            <Github size={12} />
            Source
          </a>
        </div>
      </footer>
    </div>
  );
}