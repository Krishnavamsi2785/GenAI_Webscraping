/**
 * components/ScrapePanel.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Left panel: URL input, scrape options, status, scraped pages list, export.
 */

import { useState } from "react";
import {
  Globe, Zap, Settings, ChevronDown, ChevronUp,
  CheckCircle, AlertCircle, Loader, FileText,
  Link, Download, Search, Eye,
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
    detail_selector:      "h3 > a, .product_pod a, article a, a[href*='product'], a[href*='item'], a[href*='job']",
    click_selector:       "",
    max_details_per_page: 5,
    use_search:           false,
    search_query:         "",
    fields:               "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!url.trim()) return;

    // Parse fields string into array
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
    <aside className="w-full lg:w-[390px] flex-shrink-0 flex flex-col gap-4">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
          <Globe size={16} className="text-accent" />
        </div>
        <div>
          <h2 className="font-display font-bold text-sm text-text tracking-wide">SCRAPE TARGET</h2>
          <p className="text-dim text-xs">Enter any website URL to begin</p>
        </div>
      </div>

      {/* ── URL Form ──────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">

        {/* URL input */}
        <div className="relative">
          <Link size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://books.toscrape.com"
            required
            className="w-full bg-panel border border-border rounded-xl pl-9 pr-4 py-3 text-sm text-text placeholder:text-muted focus:outline-none focus:border-accent/60 transition-colors font-mono"
          />
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-1.5">
          {[
            { label: "Books",    url: "https://books.toscrape.com" },
            { label: "GFG",      url: "https://www.geeksforgeeks.org" },
          ].map(({ label, url: presetUrl }) => (
            <button
              key={label}
              type="button"
              onClick={() => setUrl(presetUrl)}
              className="text-xs px-2.5 py-1 bg-void border border-border rounded-lg text-dim hover:text-accent hover:border-accent/40 transition-all font-mono"
            >
              {label}
            </button>
          ))}
        </div>

        {/* Advanced toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-dim text-xs hover:text-accent transition-colors w-fit"
        >
          <Settings size={12} />
          Advanced options
          {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {/* ── Advanced panel ────────────────────────────────────────────────── */}
        {showAdvanced && (
          <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-4 animate-fade-up">

            {/* Max pages */}
            <Field label="MAX PAGES" hint="Max listing/pagination pages to visit">
              <input
                type="number" min={1} max={100}
                value={opts.max_pages}
                onChange={(e) => setOpts((o) => ({ ...o, max_pages: +e.target.value }))}
                className={inputCls}
              />
            </Field>

            {/* Search-first toggle */}
            <Toggle
              checked={opts.use_search}
              onChange={(v) => setOpts((o) => ({ ...o, use_search: v }))}
              label="Search-first strategy"
              hint="Type a query into the site's search box before scraping"
            />

            {opts.use_search && (
              <Field label="SEARCH QUERY">
                <input
                  type="text"
                  value={opts.search_query}
                  onChange={(e) => setOpts((o) => ({ ...o, search_query: e.target.value }))}
                  placeholder="e.g. software engineer jobs"
                  className={inputCls}
                />
              </Field>
            )}

            {/* Deep crawl toggle */}
            <Toggle
              checked={opts.scrape_detail_pages}
              onChange={(v) => setOpts((o) => ({ ...o, scrape_detail_pages: v }))}
              label="Deep crawl (visit product/article pages)"
              hint="Navigate into each detail page for full content"
            />

            {opts.scrape_detail_pages && (
              <>
                <Field label="DETAIL LINK SELECTOR" hint="CSS selector for links to detail pages">
                  <input
                    type="text"
                    value={opts.detail_selector}
                    onChange={(e) => setOpts((o) => ({ ...o, detail_selector: e.target.value }))}
                    className={`${inputCls} text-xs`}
                  />
                </Field>
                <Field label="MAX DETAILS PER PAGE">
                  <input
                    type="number" min={1} max={30}
                    value={opts.max_details_per_page}
                    onChange={(e) => setOpts((o) => ({ ...o, max_details_per_page: +e.target.value }))}
                    className={inputCls}
                  />
                </Field>
              </>
            )}

            {/* Click selector */}
            <Field
              label="CLICK SELECTOR (optional)"
              hint="Click this element before scraping (cookie banner, career tab, etc.)"
            >
              <input
                type="text"
                value={opts.click_selector}
                onChange={(e) => setOpts((o) => ({ ...o, click_selector: e.target.value }))}
                placeholder='button:has-text("Accept"), a:has-text("Career")'
                className={`${inputCls} text-xs`}
              />
            </Field>

            {/* Target fields */}
            <Field
              label="TARGET FIELDS (optional)"
              hint="Comma-separated fields to extract: price, rating, title, availability"
            >
              <input
                type="text"
                value={opts.fields}
                onChange={(e) => setOpts((o) => ({ ...o, fields: e.target.value }))}
                placeholder="price, rating, title, availability"
                className={`${inputCls} text-xs`}
              />
            </Field>
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={scrapeLoading}
          className="flex items-center justify-center gap-2 bg-accent/10 border border-accent/40 hover:bg-accent/20 hover:border-accent text-accent font-display font-bold text-sm py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-pulse"
        >
          {scrapeLoading
            ? <><Loader size={15} className="animate-spin" /> SCRAPING…</>
            : <><Zap size={15} /> SCRAPE & INDEX</>
          }
        </button>
      </form>

      {/* ── Scrape error ──────────────────────────────────────────────────── */}
      {scrapeError && (
        <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-3 animate-fade-up">
          <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-red-300 text-xs leading-relaxed">{scrapeError}</p>
        </div>
      )}

      {/* ── Index ready badge ────────────────────────────────────────────── */}
      {status.indexed && (
        <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3 animate-fade-up">
          <div className="flex items-center gap-2">
            <CheckCircle size={14} className="text-accent" />
            <span className="text-accent text-xs font-display font-bold tracking-wider">INDEX READY</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="DOCS"   value={status.documents_count} />
            <Stat label="STATUS" value="Ready" accent />
          </div>
          {status.last_scraped_url && (
            <p className="text-dim text-xs font-mono truncate">{status.last_scraped_url}</p>
          )}
        </div>
      )}

      {/* ── Export panel (shown after successful scrape) ──────────────────── */}
      {status.indexed && (
        <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-3 animate-fade-up">
          <div className="flex items-center gap-2">
            <Download size={14} className="text-accent" />
            <span className="text-accent text-xs font-display font-bold tracking-wider">EXPORT DATA</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["json", "csv", "excel"].map((fmt) => (
              <button
                key={fmt}
                onClick={() => onExport(fmt)}
                disabled={exportLoading}
                className="flex flex-col items-center gap-1 py-2 px-1 bg-void border border-border rounded-lg text-dim hover:text-accent hover:border-accent/40 transition-all disabled:opacity-40 text-xs font-mono"
              >
                {exportLoading ? <Loader size={12} className="animate-spin" /> : <Download size={12} />}
                .{fmt === "excel" ? "xlsx" : fmt}
              </button>
            ))}
          </div>
          {exportError && (
            <p className="text-red-400 text-xs">{exportError}</p>
          )}
        </div>
      )}

      {/* ── Scraped pages list ───────────────────────────────────────────── */}
      {scrapeResult?.pages?.length > 0 && (
        <div className="bg-panel border border-border rounded-xl p-4 flex flex-col gap-2 animate-fade-up max-h-72 overflow-y-auto">
          <p className="text-dim text-xs font-display tracking-wider mb-1">
            SCRAPED PAGES ({scrapeResult.pages.length})
          </p>
          {scrapeResult.pages.map((page, i) => (
            <div key={i} className="flex items-start gap-2 py-2 border-t border-border first:border-0">
              <FileText size={12} className="text-dim mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-text text-xs truncate font-medium">{page.title || "Untitled"}</p>
                <a
                  href={page.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-dim text-xs font-mono truncate block hover:text-accent transition-colors"
                >
                  {page.url}
                </a>
                {page.structured_data && Object.keys(page.structured_data).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(page.structured_data).slice(0, 3).map(([k, v]) => (
                      <span key={k} className="text-xs bg-accent/5 border border-accent/20 text-accent px-1.5 py-0.5 rounded font-mono">
                        {k}: {String(v).slice(0, 20)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

// ── Reusable sub-components ───────────────────────────────────────────────────

const inputCls =
  "bg-void border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent/60 font-mono w-full";

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-dim text-xs font-display tracking-wider">{label}</label>
      {hint && <p className="text-dim/70 text-xs leading-snug -mt-0.5">{hint}</p>}
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="relative mt-0.5 flex-shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-10 h-5 rounded-full transition-colors ${checked ? "bg-accent" : "bg-border"}`}>
          <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
        </div>
      </div>
      <div>
        <p className="text-sm text-text">{label}</p>
        {hint && <p className="text-xs text-dim mt-0.5">{hint}</p>}
      </div>
    </label>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="bg-void rounded-lg p-2">
      <p className="text-dim text-xs font-display tracking-wider">{label}</p>
      <p className={`text-sm font-bold font-mono mt-0.5 ${accent ? "text-accent" : "text-text"}`}>{value}</p>
    </div>
  );
}