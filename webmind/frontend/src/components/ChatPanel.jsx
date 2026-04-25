/**
 * components/ChatPanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Chat interface: message thread + input bar.
 * Suggestion buttons are wired to onAsk so they actually send.
 */

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send, Bot, User, TrendingUp, TrendingDown, Minus,
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

  const handleSuggestion = (text) => {
    if (!status.indexed || askLoading) return;
    onAsk(text);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">

      {/* ── Message thread ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-4 pr-1">
        {messages.length === 0 && (
          <EmptyState indexed={status.indexed} onSuggestion={handleSuggestion} />
        )}
        {messages.map((msg, i) => (
          <Message key={i} msg={msg} />
        ))}
        {askLoading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ───────────────────────────────────────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="mt-4 flex gap-3 items-center bg-panel border border-border rounded-2xl p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            status.indexed
              ? "Ask anything about the scraped website…"
              : "Scrape a website first to start chatting"
          }
          disabled={!status.indexed || askLoading}
          className="flex-1 bg-transparent text-sm text-text placeholder:text-muted focus:outline-none disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={!input.trim() || !status.indexed || askLoading}
          className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/30 hover:bg-accent/25 hover:border-accent flex items-center justify-center text-accent transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 animate-fade-up ${isUser ? "flex-row-reverse" : ""}`}>

      {/* Avatar */}
      <div className={`w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center border ${
        isUser
          ? "bg-glow/10 border-glow/30 text-glow"
          : msg.isError
          ? "bg-red-500/10 border-red-500/30 text-red-400"
          : "bg-accent/10 border-accent/30 text-accent"
      }`}>
        {isUser ? <User size={14} /> : <Bot size={14} />}
      </div>

      {/* Bubble */}
      <div className={`flex flex-col gap-2 max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-glow/10 border border-glow/20 text-text rounded-tr-sm"
            : msg.isError
            ? "bg-red-500/10 border border-red-500/20 text-red-300 rounded-tl-sm"
            : "bg-panel border border-border text-text rounded-tl-sm"
        }`}>
          {isUser ? (
            <p>{msg.content}</p>
          ) : (
            <div className="answer-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Sentiment + source count */}
        {!isUser && !msg.isError && msg.sentiment && (
          <div className="flex items-center gap-3 px-1">
            <SentimentBadge sentiment={msg.sentiment} />
            {msg.sources?.length > 0 && (
              <span className="text-dim text-xs">
                {msg.sources.length} source{msg.sources.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sentiment badge ────────────────────────────────────────────────────────────

function SentimentBadge({ sentiment }) {
  const map = {
    positive: { icon: TrendingUp,   color: "text-emerald-400", label: "Positive" },
    negative: { icon: TrendingDown, color: "text-red-400",     label: "Negative" },
    neutral:  { icon: Minus,        color: "text-dim",         label: "Neutral"  },
  };
  const { icon: Icon, color, label } = map[sentiment?.tone] || map.neutral;
  return (
    <div className={`flex items-center gap-1 text-xs ${color}`}>
      <Icon size={10} />
      <span>{label}</span>
    </div>
  );
}

// ── Typing indicator ───────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex gap-3 animate-fade-up">
      <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center">
        <Bot size={14} className="text-accent" />
      </div>
      <div className="bg-panel border border-border rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="typing flex items-center gap-1 h-4">
          <span /><span /><span />
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ indexed, onSuggestion }) {
  const suggestions = [
    "What products are available on this website?",
    "Summarise the main topics covered",
    "What is the price of the most expensive item?",
    "Find all items with a 5-star rating",
    "List all job positions available",
    "What is the company's main service?",
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 py-12 text-center">
      <div className="w-16 h-16 rounded-2xl bg-accent/5 border border-accent/20 flex items-center justify-center">
        <Bot size={28} className="text-accent/60" />
      </div>
      <div>
        <h3 className="font-display font-bold text-text text-lg">
          {indexed ? "Ask anything" : "Ready when you are"}
        </h3>
        <p className="text-dim text-sm mt-1 max-w-xs leading-relaxed">
          {indexed
            ? "The website is indexed. Click a suggestion or type your own question."
            : "Scrape a website using the panel on the left to start chatting."}
        </p>
      </div>

      {indexed && (
        <div className="flex flex-col gap-2 w-full max-w-md">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => onSuggestion(s)}
              className="text-left text-xs text-dim bg-panel border border-border hover:border-accent/40 hover:text-text rounded-xl px-4 py-2.5 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}