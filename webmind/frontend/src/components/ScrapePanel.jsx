/**
 * components/ScrapePanel.jsx - AuraScrape Redesign
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState } from "react";
import {
  Globe, Zap, Settings2, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Loader2, FileCode,
  Link2, Download, Search, Layout, Database, Terminal
} from "lucide-react";

export default function ScrapePanel({
  status, scrapeLoading, scrapeResult, scrapeError, onScrape,
  exportLoading, exportError, onExport,
}) {
  const [url, setUrl]                   = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [opts, setOpts] = useState({
    max_pages:            5,
    scrape_detail_pages:  false,
    detail_selector:      "h3 > a, .product_pod a, article a, a[href*='product'], a[href*='item']",
    click_selector:       "",
    max_details_per_page: 5,
    use_search:           false,
    search_query:         "",
    fields:               "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    const fieldsArr = opts.fields
      ? opts.fields.split(",").map((f) => f.trim()).filter(Boolean)
      : null;

    onScrape({
      url:                  url.trim(),
      max_pages:            opts.max_pages,
      scrape_detail_pages:  opts.scrape_detail_pages,
      detail_selector:      opts.detail_selector,
      click_selector:       opts.click_selector || null,
      max_details_per_page: opts.max_details_per_page,
      use_search:           opts.use_search,
      search_query:         opts.use_search ? opts.search_query || null : null,
      fields:               fieldsArr,
    });
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-up">

      {/* ── Extraction Engine ── */}
      <section className="glass-panel rounded-[32px] p-6 border-white/5">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-violet-400">
            <Database size={20} />
          </div>
          <div>
            <h2 className="font-display font-extrabold text-sm text-white tracking-widest uppercase">Website Scraper</h2>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest mt-0.5">Enter URL to start</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/20 group-focus-within:text-violet-400 transition-colors">
              <Link2 size={18} />
            </div>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Enter Origin URL..."
              required
              className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 focus:bg-white/10 transition-all font-mono"
            />
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-white/40 text-[10px] font-bold uppercase tracking-[0.2em] hover:text-white transition-colors pl-2"
          >
            <Settings2 size={12} className={showAdvanced ? "text-violet-400" : ""} />
            Settings
            {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {showAdvanced && (
            <div className="space-y-5 pt-2 animate-fade-up">
              <Field label="Total Pages" hint="How many pages to visit">
                <input
                  type="number" min={1} max={100}
                  value={opts.max_pages}
                  onChange={(e) => setOpts((o) => ({ ...o, max_pages: +e.target.value }))}
                  className={inputCls}
                />
              </Field>

              <Toggle
                checked={opts.use_search}
                onChange={(v) => setOpts((o) => ({ ...o, use_search: v }))}
                label="Site Search"
                hint="Search inside the website"
              />

              {opts.use_search && (
                <Field label="Query Parameters">
                  <input
                    type="text"
                    value={opts.search_query}
                    onChange={(e) => setOpts((o) => ({ ...o, search_query: e.target.value }))}
                    placeholder="Search query..."
                    className={inputCls}
                  />
                </Field>
              )}

              <Toggle
                checked={opts.scrape_detail_pages}
                onChange={(v) => setOpts((o) => ({ ...o, scrape_detail_pages: v }))}
                label="Scrape More Links"
                hint="Follow links for more info"
              />

              {opts.scrape_detail_pages && (
                <div className="space-y-4 pl-4 border-l border-white/5">
                  <Field label="Page Selector">
                    <input
                      type="text"
                      value={opts.detail_selector}
                      onChange={(e) => setOpts((o) => ({ ...o, detail_selector: e.target.value }))}
                      className={`${inputCls} text-xs`}
                    />
                  </Field>
                  <Field label="Max Items">
                    <input
                      type="number" min={1} max={30}
                      value={opts.max_details_per_page}
                      onChange={(e) => setOpts((o) => ({ ...o, max_details_per_page: +e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                </div>
              )}

              <Field label="Fields to Find" hint="e.g. price, title (comma separated)">
                <input
                  type="text"
                  value={opts.fields}
                  onChange={(e) => setOpts((o) => ({ ...o, fields: e.target.value }))}
                  placeholder="e.g. price, rating, sku"
                  className={`${inputCls} text-xs`}
                />
              </Field>
            </div>
          )}

          <button
            type="submit"
            disabled={scrapeLoading}
            className="w-full relative group overflow-hidden rounded-2xl p-[1px] disabled:opacity-50"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-violet-500 to-cyan-500 animate-gradient-x" />
            <div className="relative bg-black/80 hover:bg-transparent transition-colors rounded-2xl flex items-center justify-center gap-3 py-4 text-xs font-black uppercase tracking-[0.3em] text-white">
              {scrapeLoading
                ? <><Loader2 size={16} className="animate-spin text-cyan-400" /> Working…</>
                : <><Zap size={16} className="text-violet-400" /> Start Scrape</>
              }
            </div>
          </button>
        </form>
      </section>

      {/* ── Status & Results ── */}
      {(status.indexed || scrapeResult?.pages?.length > 0) && (
        <section className="glass-panel rounded-[32px] p-6 border-white/5 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 size={16} className="text-emerald-400" />
              <h3 className="font-display font-bold text-[10px] text-white/60 uppercase tracking-widest">Saved Data</h3>
            </div>
            <div className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase">Online</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Pages Found</p>
              <p className="text-xl font-display font-extrabold text-white mt-1">{status.documents_count}</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
              <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest">Type</p>
              <p className="text-xl font-display font-extrabold text-violet-400 mt-1">Chroma</p>
            </div>
          </div>

          {/* Export */}
          <div className="space-y-3">
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-widest pl-2">Download File</p>
            <div className="grid grid-cols-3 gap-2">
              {["json", "csv", "excel"].map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => onExport(fmt)}
                  disabled={exportLoading}
                  className="flex flex-col items-center gap-2 py-3 bg-white/5 border border-white/10 rounded-2xl text-white/60 hover:text-white hover:border-violet-500/50 transition-all text-[9px] font-black uppercase tracking-widest"
                >
                  {exportLoading ? <Loader2 size={12} className="animate-spin" /> : <Download size={14} />}
                  {fmt}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-violet-500/50 transition-all font-mono";

function Field({ label, hint, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <label className="text-[9px] font-black text-white/40 uppercase tracking-[0.2em]">{label}</label>
        {hint && <span className="text-[8px] text-white/20 font-medium">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/[0.08] transition-all group">
      <div>
        <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest">{label}</p>
        <p className="text-[9px] text-white/30 mt-0.5">{hint}</p>
      </div>
      <div className="relative">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
        <div className={`w-9 h-5 rounded-full transition-colors duration-300 ${checked ? "bg-violet-500" : "bg-white/10"}`}>
          <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.75 transition-transform duration-300 shadow-lg ${checked ? "translate-x-5" : "translate-x-0.75"}`} />
        </div>
      </div>
    </label>
  );
}