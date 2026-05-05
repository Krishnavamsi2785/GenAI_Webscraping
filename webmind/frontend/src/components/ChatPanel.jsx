/**
 * components/ChatPanel.jsx - AuraScrape Redesign
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Bot, User, Zap, Activity, MessageSquare, 
  ChevronRight, Share2, CornerDownRight
} from "lucide-react";

export default function ChatPanel({ messages, askLoading, status, onAsk }) {
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, askLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || askLoading || !status.indexed) return;
    onAsk(input.trim());
    setInput("");
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">

      {/* ── Chat Flow ── */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 custom-scrollbar">
        {messages.length === 0 && (
          <EmptyState indexed={status.indexed} onSuggestion={onAsk} />
        )}
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        {askLoading && <ThinkingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Interface Bar ── */}
      <div className="p-8 bg-white/[0.02] border-t border-white/5">
        <form
          onSubmit={handleSubmit}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/20 to-cyan-500/20 blur-xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
          <div className="relative flex items-center bg-white/[0.03] border border-white/10 rounded-[24px] p-2 pr-4 focus-within:border-violet-500/50 focus-within:bg-white/[0.06] transition-all">
            <div className="w-10 h-10 flex items-center justify-center text-white/20">
              <CornerDownRight size={18} />
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                status.indexed
                  ? "Ask a question about the website..."
                  : "Please scrape a website first..."
              }
              disabled={!status.indexed || askLoading}
              className="flex-1 bg-transparent py-4 text-sm text-white placeholder:text-white/20 focus:outline-none disabled:opacity-40 font-medium"
            />
            <button
              type="submit"
              disabled={!input.trim() || !status.indexed || askLoading}
              className="w-12 h-12 rounded-2xl bg-violet-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-20 disabled:grayscale"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
        <div className="mt-4 flex items-center justify-center gap-6">
          <p className="text-[9px] font-bold text-white/10 uppercase tracking-[0.3em]">Neural Link Stable</p>
          <div className="w-1 h-1 rounded-full bg-white/10" />
          <p className="text-[9px] font-bold text-white/10 uppercase tracking-[0.3em]">Encrypted Session</p>
        </div>
      </div>
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-6 animate-fade-up ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className={`w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center border shadow-2xl transition-transform hover:scale-110 ${
        isUser
          ? "bg-white/5 border-white/10 text-white shadow-white/5"
          : msg.isError
          ? "bg-red-500/10 border-red-500/20 text-red-400"
          : "bg-violet-500/10 border-violet-500/20 text-violet-400"
      }`}>
        {isUser ? <User size={20} /> : <Bot size={20} />}
      </div>

      {/* Bubble */}
      <div className={`flex flex-col gap-3 max-w-[80%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-[28px] px-7 py-5 text-[15px] leading-relaxed shadow-xl ${
          isUser
            ? "bg-white/[0.06] border border-white/10 text-white rounded-tr-sm"
            : msg.isError
            ? "bg-red-500/5 border border-red-500/20 text-red-300 rounded-tl-sm"
            : "glass-card text-white/90 rounded-tl-sm"
        }`}>
          {isUser ? (
            <p className="font-medium">{msg.content}</p>
          ) : (
            <div className="answer-body prose prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Meta info */}
        {!isUser && !msg.isError && (
          <div className="flex items-center gap-4 px-2">
            {msg.sentiment && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                <Activity size={10} className="text-violet-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{msg.sentiment.tone}</span>
              </div>
            )}
            {msg.sources?.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5">
                <Share2 size={10} className="text-cyan-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40">{msg.sources.length} Sources</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingIndicator() {
  return (
    <div className="flex gap-6 animate-fade-up">
      <div className="w-12 h-12 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
        <Bot size={20} className="text-violet-400 animate-pulse" />
      </div>
      <div className="glass-card rounded-[28px] rounded-tl-sm px-7 py-5 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.3s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce [animation-delay:-0.15s]" />
        <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" />
      </div>
    </div>
  );
}

function EmptyState({ indexed, onSuggestion }) {
  const suggestions = [
    "What is this website about?",
    "Summarize the main content",
    "List key products or services",
    "Find contact information"
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-10 py-20 text-center animate-fade-up">
      <div className="relative">
        <div className="absolute inset-0 bg-violet-500 blur-[80px] opacity-20" />
        <div className="relative w-24 h-24 rounded-[40px] bg-white/[0.02] border border-white/10 flex items-center justify-center text-white/10">
          <MessageSquare size={48} />
        </div>
      </div>
      
      <div className="space-y-3">
        <h3 className="font-display font-extrabold text-3xl text-white tracking-tight italic">
          {indexed ? "Ready to Help" : "Awaiting Data"}
        </h3>
        <p className="text-white/30 text-sm max-w-sm mx-auto font-medium leading-relaxed uppercase tracking-widest">
          {indexed
            ? "Website saved. Ask me anything about it below."
            : "Scrape a website to start asking questions."}
        </p>
      </div>

      {indexed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full max-w-2xl px-8">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSuggestion(s)}
              className="group flex items-center justify-between text-left text-[11px] font-bold uppercase tracking-widest text-white/40 bg-white/[0.02] border border-white/10 hover:border-violet-500/50 hover:bg-white/[0.05] hover:text-white rounded-[20px] px-6 py-5 transition-all"
            >
              {s}
              <ChevronRight size={14} className="text-white/20 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}