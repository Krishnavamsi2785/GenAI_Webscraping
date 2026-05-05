/**
 * App.jsx - AuraScrape Redesign
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import { useScraper } from "./hooks/useScraper";
import ScrapePanel  from "./components/ScrapePanel";
import ChatPanel    from "./components/ChatPanel";
import HistoryPanel from "./components/HistoryPanel";
import { Sparkles, Clock, Github, Shield, ShieldAlert, Cpu } from "lucide-react";

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
    <div className="relative min-h-screen flex flex-col font-sans">
      {/* ── Background elements ── */}
      <div className="nebula-bg" />
      <div className="grid-overlay" />
      <div className="glow-spot top-[-10%] left-[-10%] bg-violet-600" />
      <div className="glow-spot bottom-[-10%] right-[-10%] bg-cyan-600" />

      {/* ── Top bar ── */}
      <header className="glass-panel sticky top-0 z-50 border-b border-white/5 px-8 py-4 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          
          {/* Logo */}
          <div className="flex items-center gap-4 group cursor-default">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500 blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
              <div className="relative w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-white shadow-2xl shadow-violet-500/20">
                <Cpu size={22} className="animate-pulse" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-white/70">Aura</span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-cyan-400">Scrape</span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
                <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Smart Web Assistant</span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-4">
            {/* Status */}
            <div className={`hidden md:flex items-center gap-2.5 px-4 py-2 rounded-2xl border transition-all duration-500 ${
              status.indexed 
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.05)]"
                : "bg-white/5 border-white/10 text-white/40"
            }`}>
              {status.indexed ? <Shield size={14} /> : <ShieldAlert size={14} />}
              <span className="text-xs font-semibold tracking-wide">
                {status.indexed ? `${status.documents_count} Pages Saved` : "Not Ready"}
              </span>
            </div>

            {/* History Toggle */}
            <button
              onClick={() => setShowHistory(!showHistory)}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl border transition-all duration-300 font-medium text-xs tracking-wide ${
                showHistory
                  ? "bg-violet-500/20 border-violet-500/30 text-violet-300"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Clock size={14} />
              Recent Chats
            </button>
            
            <a 
              href="https://github.com" 
              className="p-2.5 rounded-2xl bg-white/5 border border-white/10 text-white/40 hover:text-white hover:bg-white/10 transition-all"
            >
              <Github size={18} />
            </a>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full p-8 flex flex-col lg:flex-row gap-8 relative z-10">
        
        {/* Left: Scraper Controls */}
        <div className="lg:w-[400px] flex-shrink-0">
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
        </div>

        {/* Right: Chat Section */}
        <div className="flex-1 flex flex-col glass-panel rounded-[32px] overflow-hidden min-h-[75vh]">
          {/* Panel Header */}
          <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              <h2 className="font-display font-bold text-xs text-white/40 uppercase tracking-[0.2em]">Chat Support</h2>
            </div>
            {askLoading && (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce" />
                </div>
                <span className="text-[10px] font-bold text-cyan-400/60 uppercase tracking-widest">Processing</span>
              </div>
            )}
          </div>

          <ChatPanel
            messages={messages}
            askLoading={askLoading}
            status={status}
            onAsk={ask}
          />
        </div>

        {/* Floating Overlays */}
        {showHistory && (
          <div className="fixed inset-0 z-[60] flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowHistory(false)} />
            <HistoryPanel
              history={history}
              onClear={deleteHistory}
              onClose={() => setShowHistory(false)}
            />
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="px-12 py-6 border-t border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-violet-400" />
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em]">AuraScrape</span>
          </div>
          <div className="h-4 w-[1px] bg-white/5" />
          <span className="text-[10px] text-white/20 font-medium">L-RAG · Gemini 1.5 Flash · ChromaDB</span>
        </div>
        <div className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em]">
          Designed for excellence
        </div>
      </footer>
    </div>
  );
}