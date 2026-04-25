/**
 * components/HistoryPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Slide-in history drawer showing past Q&A pairs with sentiment badges.
 */

import { Clock, Trash2, X, MessageSquare } from "lucide-react";

export default function HistoryPanel({ history, onClear, onClose }) {
  return (
    <div className="w-full lg:w-[360px] flex-shrink-0 bg-panel border border-border rounded-2xl flex flex-col overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-accent" />
          <h3 className="font-display font-bold text-sm text-text tracking-wide">HISTORY</h3>
          <span className="bg-accent/10 text-accent text-xs font-mono px-2 py-0.5 rounded-full">
            {history.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={onClear}
              className="flex items-center gap-1 text-dim hover:text-red-400 text-xs transition-colors"
            >
              <Trash2 size={12} />
              Clear
            </button>
          )}
          <button onClick={onClose} className="text-dim hover:text-text transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <MessageSquare size={24} className="text-dim/40" />
            <p className="text-dim text-sm">No history yet</p>
          </div>
        ) : (
          [...history].reverse().map((item, i) => (
            <div
              key={i}
              className="px-5 py-4 border-b border-border/50 last:border-0 hover:bg-void/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-text text-sm font-medium leading-snug">{item.question}</p>
                <span className="text-dim text-xs font-mono flex-shrink-0">
                  {new Date(item.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-dim text-xs leading-relaxed line-clamp-2">
                {item.answer?.replace(/[#*`]/g, "").slice(0, 140)}…
              </p>
              {item.sentiment && (
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${
                  item.sentiment.tone === "positive" ? "bg-emerald-500/10 text-emerald-400" :
                  item.sentiment.tone === "negative" ? "bg-red-500/10 text-red-400" :
                  "bg-dim/10 text-dim"
                }`}>
                  {item.sentiment.tone}
                </span>
              )}
              {item.sources?.length > 0 && (
                <p className="text-dim/50 text-xs mt-1 font-mono truncate">
                  {item.sources[0]}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}