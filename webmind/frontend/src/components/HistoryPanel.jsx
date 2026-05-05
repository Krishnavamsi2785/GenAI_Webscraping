/**
 * components/HistoryPanel.jsx - AuraScrape Redesign
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { X, Trash2, Calendar, MessageSquare, ChevronRight, Hash } from "lucide-react";

export default function HistoryPanel({ history, onClear, onClose }) {
  return (
    <aside className="w-[450px] bg-[#0d1117] border-l border-white/5 flex flex-col h-full shadow-2xl relative animate-fade-left">
      {/* Glow */}
      <div className="absolute top-0 right-0 w-32 h-64 bg-violet-500/10 blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="px-8 py-8 border-b border-white/5 flex items-center justify-between relative bg-white/[0.01]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Hash size={14} className="text-violet-400" />
            <h2 className="font-display font-black text-xs text-white uppercase tracking-[0.3em]">Chat History</h2>
          </div>
          <p className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Your previous questions</p>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
        >
          <X size={20} />
        </button>
      </div>

      {/* History List */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-4 custom-scrollbar">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center opacity-20">
            <Calendar size={48} className="mb-4" />
            <p className="text-xs font-black uppercase tracking-[0.2em]">History Empty</p>
          </div>
        ) : (
          history.slice().reverse().map((item, i) => (
            <div
              key={i}
              className="group p-5 rounded-[24px] bg-white/[0.02] border border-white/5 hover:border-violet-500/30 hover:bg-white/[0.04] transition-all cursor-default"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                  <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">
                    {new Date(item.time).toLocaleDateString()} · {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <ChevronRight size={14} className="text-white/10 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
              </div>
              
              <div className="space-y-3">
                <div className="flex gap-3">
                  <MessageSquare size={12} className="text-white/20 flex-shrink-0 mt-1" />
                  <p className="text-xs text-white/70 font-semibold leading-relaxed line-clamp-2">
                    {item.question}
                  </p>
                </div>
                
                {item.sentiment && (
                  <div className="flex items-center gap-2 pl-6">
                    <div className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${
                      item.sentiment.tone === 'positive' ? 'text-emerald-400 border-emerald-400/20' : 
                      item.sentiment.tone === 'negative' ? 'text-red-400 border-red-400/20' : 'text-white/20 border-white/10'
                    }`}>
                      {item.sentiment.tone}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer / Clear All */}
      {history.length > 0 && (
        <div className="p-8 border-t border-white/5 bg-white/[0.01]">
          <button
            onClick={onClear}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-[0.2em] hover:bg-red-500/20 hover:border-red-500 transition-all"
          >
            <Trash2 size={16} />
            Clear History
          </button>
        </div>
      )}
    </aside>
  );
}