import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { postSave, agentReview, headerImage, type ReviewOutput } from "@/lib/blogApi";

// ─── Types ──────────────────────────────────────────────────────────
interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  content_nl?: string | null;
  category: string;
  tags: string[];
  status: "draft" | "review" | "scheduled" | "published" | "archived";
  voice_template_id: string | null;
  read_time: string | null;
  word_count: number;
  hero_image_url?: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

type View = "write" | "manage" | "analytics";
type LangMode = "split" | "en" | "nl";

// ─── Helpers ────────────────────────────────────────────────────────
const wordCount = (text: string) =>
  text.replace(/<[^>]*>/g, " ").split(/\s+/).filter(Boolean).length;

const readMinutes = (words: number) => Math.max(1, Math.ceil(words / 220));

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

const stripEmDashes = (s: string) => s.replace(/—/g, " - ").replace(/–/g, "-");

const relTime = (iso: string) => {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
};

const STAGE_CLASS: Record<string, string> = {
  draft: "draft",
  review: "review",
  scheduled: "scheduled",
  published: "live",
  archived: "archived",
};

// HTML rendering for gates: turn [HANS: ...] tokens (in markdown content)
// into highlighted gate blocks.
function contentToHtml(content: string): string {
  if (!content) return "";
  // Naive markdown-ish: handle headings, paragraphs, blockquotes, gates.
  const lines = content.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { out.push(""); continue; }
    const gateMatch = line.match(/^\[HANS:\s*(.+?)\]$/);
    if (gateMatch) { out.push(`<div class="gate">${escapeHtml(gateMatch[1])}</div>`); continue; }
    if (line.startsWith("## ")) { out.push(`<h2>${escapeHtml(line.slice(3))}</h2>`); continue; }
    if (line.startsWith("# "))  { out.push(`<h1>${escapeHtml(line.slice(2))}</h1>`); continue; }
    if (line.startsWith("> "))  { out.push(`<blockquote>${escapeHtml(line.slice(2))}</blockquote>`); continue; }
    out.push(`<p>${escapeHtml(line)}</p>`);
  }
  return out.join("\n");
}

function htmlToContent(html: string): string {
  // Inverse of contentToHtml: collapse the editor HTML back to markdown-ish.
  const div = document.createElement("div");
  div.innerHTML = html;
  const lines: string[] = [];
  div.childNodes.forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) {
      const t = (n.textContent ?? "").trim();
      if (t) lines.push(t);
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const el = n as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const txt = (el.textContent ?? "").trim();
    if (!txt) return;
    if (tag === "h1") lines.push(`# ${txt}`);
    else if (tag === "h2") lines.push(`## ${txt}`);
    else if (tag === "blockquote") lines.push(`> ${txt}`);
    else if (el.classList.contains("gate")) lines.push(`[HANS: ${txt}]`);
    else lines.push(txt);
    lines.push("");
  });
  return stripEmDashes(lines.join("\n").trim());
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]!));
}

function extractHeadings(content: string): { level: 1 | 2; text: string }[] {
  return content
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("# ") || l.startsWith("## "))
    .map((l) => l.startsWith("## ")
      ? ({ level: 2 as const, text: l.slice(3) })
      : ({ level: 1 as const, text: l.slice(2) }));
}

// ─── Icons (inline SVG, no extra deps) ──────────────────────────────
const Icon = {
  Search: () => (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  Moon: () => (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 9.5A5.5 5.5 0 016.5 3 5.5 5.5 0 1013 9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>),
  Sun: () => (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  Pen: () => (<svg viewBox="0 0 16 16" fill="none"><path d="M2 14h12M11 3l2 2-7 7H4v-2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  Grid: () => (<svg viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.6"/><rect x="9" y="2" width="5" height="5" stroke="currentColor" strokeWidth="1.6"/><rect x="2" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.6"/><rect x="9" y="9" width="5" height="5" stroke="currentColor" strokeWidth="1.6"/></svg>),
  Bars: () => (<svg viewBox="0 0 16 16" fill="none"><path d="M2 13V3M2 13h12M5 11V8M8 11V5M11 11V7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>),
  Focus: () => (<svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="3" height="3" stroke="currentColor" strokeWidth="1.4"/><rect x="11" y="2" width="3" height="3" stroke="currentColor" strokeWidth="1.4"/><rect x="2" y="11" width="3" height="3" stroke="currentColor" strokeWidth="1.4"/><rect x="11" y="11" width="3" height="3" stroke="currentColor" strokeWidth="1.4"/></svg>),
  Clock: () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>),
  Arrow: () => (<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  Sparkle: ({ c = "currentColor" }: { c?: string }) => (<svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ color: c }}><path d="M6 1.5L7.2 4.8 10.5 6 7.2 7.2 6 10.5 4.8 7.2 1.5 6 4.8 4.8z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>),
  Image: () => (<svg width="13" height="13" viewBox="0 0 16 16" fill="none"><rect x="2" y="3" width="12" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/><circle cx="6" cy="7" r="1" fill="currentColor"/><path d="M3 12l3-3 3 2 3-3 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>),
  Save: () => (<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 2h7l1.5 1.5V10H2zM4 2v3h4V2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>),
};

// ─── Page ───────────────────────────────────────────────────────────
const STORAGE_KEY = "write-cms-theme";

export default function Write() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const initialId = params.get("id") ?? "";
  const initialView = (params.get("view") as View) || "write";

  const [theme, setTheme] = useState<"light" | "dark">(() =>
    (localStorage.getItem(STORAGE_KEY) as "light" | "dark") || "light");
  const [view, setView] = useState<View>(initialView);
  const [langMode, setLangMode] = useState<LangMode>("split");
  const [focus, setFocus] = useState(false);

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Article | null>(null);
  const [titleVal, setTitleVal] = useState("");
  const [enHtml, setEnHtml] = useState("");
  const [nlHtml, setNlHtml] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // for the autosave-relative-time display

  const [review, setReview] = useState<ReviewOutput | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [heroLoading, setHeroLoading] = useState(false);
  const [heroUrl, setHeroUrl] = useState<string | null>(null);

  const [toast, setToast] = useState<{ msg: string; kind?: "ok" | "error" } | null>(null);
  const showToast = useCallback((msg: string, kind: "ok" | "error" = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }, []);

  const enRef = useRef<HTMLDivElement | null>(null);
  const nlRef = useRef<HTMLDivElement | null>(null);

  // theme persist
  useEffect(() => { localStorage.setItem(STORAGE_KEY, theme); }, [theme]);

  // tick relative-time
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 5000);
    return () => clearInterval(t);
  }, []);

  // load articles list
  const loadArticles = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("hvl_blog_articles")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      showToast(`Load failed: ${error.message}`, "error");
      setLoading(false);
      return;
    }
    setArticles((data ?? []) as unknown as Article[]);
    setLoading(false);
  }, [showToast]);

  useEffect(() => { loadArticles(); }, [loadArticles]);

  // load specific draft when ?id= changes
  useEffect(() => {
    if (!initialId) {
      setDraft(null);
      setTitleVal("");
      setEnHtml("");
      setNlHtml("");
      setReview(null);
      setHeroUrl(null);
      return;
    }
    const found = articles.find((a) => a.id === initialId);
    if (found) {
      setDraft(found);
      setTitleVal(found.title);
      setEnHtml(contentToHtml(found.content || ""));
      setNlHtml(contentToHtml(found.content_nl || ""));
      setReview(null); // re-run per draft
      setHeroUrl(found.hero_image_url ?? null);
    }
  }, [initialId, articles]);

  // populate contenteditable refs imperatively (don't fight React reconciler)
  useEffect(() => { if (enRef.current && enRef.current.innerHTML !== enHtml) enRef.current.innerHTML = enHtml; }, [enHtml]);
  useEffect(() => { if (nlRef.current && nlRef.current.innerHTML !== nlHtml) nlRef.current.innerHTML = nlHtml; }, [nlHtml]);

  // word counts
  const enWords = useMemo(() => wordCount(enHtml), [enHtml]);
  const nlWords = useMemo(() => wordCount(nlHtml), [nlHtml]);
  const readMin = readMinutes(enWords);

  // outline
  const outline = useMemo(() => extractHeadings(htmlToContent(enHtml)), [enHtml]);

  // shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); handleSave("draft"); }
      if (mod && e.key === ".") { e.preventDefault(); setFocus((f) => !f); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [titleVal, enHtml, nlHtml, draft]);

  // ─── Review (10-dim agent) ─────────────────────────────────────
  const handleReview = useCallback(async () => {
    const content = htmlToContent(enHtml);
    if (!content.trim()) { showToast("Write something first", "error"); return; }
    setReviewing(true);
    try {
      const out = await agentReview({
        title: titleVal.trim() || "Untitled",
        content,
        category: draft?.category ?? "tech",
        voice_template_id: draft?.voice_template_id ?? null,
      });
      setReview(out);
      showToast(out.publish_ready ? `Review ${out.total_score}/100 · publish ready` : `Review ${out.total_score}/100`);
    } catch (err) {
      showToast(`Review failed: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setReviewing(false);
    }
  }, [titleVal, enHtml, draft, showToast]);

  // ─── Cover (Gemini hero image) ─────────────────────────────────
  const handleCover = useCallback(async () => {
    const prompt = titleVal.trim() || "editorial line art, warm cream and amber accent";
    setHeroLoading(true);
    try {
      const out = await headerImage({
        prompt,
        style: "editorial",
        post_id: draft?.id,
      });
      setHeroUrl(out.image_url);
      showToast("Cover generated");
      // persist on next save automatically; also update draft state for immediate display
      if (draft) setDraft({ ...draft, hero_image_url: out.image_url });
    } catch (err) {
      showToast(`Cover failed: ${err instanceof Error ? err.message : String(err)}`, "error");
    } finally {
      setHeroLoading(false);
    }
  }, [titleVal, draft, showToast]);

  // ─── Save / Publish ────────────────────────────────────────────
  const handleSave = useCallback(async (
    nextStatus: Article["status"] = (draft?.status ?? "draft") as Article["status"]
  ) => {
    const title = titleVal.trim() || "Untitled draft";
    const slug = draft?.slug || slugify(title) || `draft-${Date.now()}`;
    const content = htmlToContent(enHtml);
    const content_nl = htmlToContent(nlHtml);
    if (!content) { showToast("Empty draft", "error"); return; }

    // Auto-derive excerpt from first ~200 chars when none exists yet.
    const derivedExcerpt =
      (draft?.excerpt && draft.excerpt.trim()) ||
      content.replace(/[#*>\n]/g, " ").trim().slice(0, 200);
    const wc = wordCount(enHtml);

    // Common payload used by both the webhook and the direct fallback.
    const fullRow = {
      title,
      slug,
      content,
      content_nl,
      excerpt: derivedExcerpt,
      category: draft?.category || "professional",
      tags: draft?.tags ?? [],
      status: nextStatus,
      voice_template_id: draft?.voice_template_id ?? null,
      hero_image_url: heroUrl ?? draft?.hero_image_url ?? null,
      word_count: wc,
      read_time: `${Math.max(1, Math.ceil(wc / 220))} min read`,
      published_at:
        nextStatus === "published"
          ? (draft?.published_at ?? new Date().toISOString())
          : draft?.published_at ?? null,
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    try {
      const out = await postSave({
        id: draft?.id,
        title,
        slug,
        content,
        content_nl,
        excerpt: derivedExcerpt,
        category: fullRow.category,
        tags: fullRow.tags,
        status: nextStatus,
        voice_template_id: fullRow.voice_template_id,
        hero_image_url: fullRow.hero_image_url,
      });
      setLastSavedAt(new Date().toISOString());
      showToast(nextStatus === "published" ? "Published" : "Saved");
      await loadArticles();
      if (!draft?.id && out?.id) {
        setParams({ id: out.id, view });
      }
    } catch (err) {
      // Webhook unavailable — write directly to Supabase with all NOT NULL
      // fields populated so the row is valid for the public read policy.
      const msg = err instanceof Error ? err.message : String(err);
      try {
        if (draft?.id) {
          const { error } = await supabase
            .from("hvl_blog_articles")
            .update(fullRow)
            .eq("id", draft.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("hvl_blog_articles")
            .insert(fullRow);
          if (error) throw error;
        }
        setLastSavedAt(new Date().toISOString());
        showToast(
          nextStatus === "published" ? "Published (direct)" : "Saved (direct)",
        );
        // Keep the webhook problem visible in the console so it gets fixed.
        console.warn("[Write.tsx] webhook fell through:", msg);
        await loadArticles();
      } catch (fbErr) {
        showToast(`Save failed: ${fbErr instanceof Error ? fbErr.message : String(fbErr)}`, "error");
      }
    } finally {
      setSaving(false);
      setPublishing(false);
    }
  }, [titleVal, enHtml, nlHtml, draft, heroUrl, loadArticles, setParams, showToast, view]);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    await handleSave("published");
  }, [handleSave]);

  // ─── Switch view (keep URL in sync) ────────────────────────────
  const switchView = useCallback((v: View) => {
    setView(v);
    const next = new URLSearchParams(params);
    next.set("view", v);
    setParams(next, { replace: true });
  }, [params, setParams]);

  // open a draft from the manage table
  const openDraft = (a: Article) => {
    const next = new URLSearchParams();
    next.set("id", a.id);
    next.set("view", "write");
    setParams(next);
    setView("write");
  };

  // new draft
  const newDraft = () => {
    setParams({ view: "write" });
    setView("write");
    setDraft(null);
    setTitleVal("");
    setEnHtml("");
    setNlHtml("");
    setTimeout(() => enRef.current?.focus(), 60);
  };

  // ─── Render ────────────────────────────────────────────────────
  const stageClass = STAGE_CLASS[draft?.status ?? "draft"] ?? "draft";
  const stageLabel = draft?.status ?? "drafted";

  // map review dimensions → 3 rail gauges
  const findDim = (needle: string) =>
    review?.dimensions.find((d) => d.name.toLowerCase().includes(needle));
  const voiceScore = findDim("voice") ?? findDim("style") ?? findDim("tone");
  const seoScore = findDim("seo") ?? findDim("findability") ?? findDim("keyword");
  const readScore = findDim("read") ?? findDim("clarity") ?? findDim("flow");
  const totalScore = review?.total_score ?? null;

  // counts for modes sidebar
  const liveCount = articles.filter((a) => a.status === "published").length;
  const draftCount = articles.filter((a) => a.status === "draft").length;
  const scheduledCount = articles.filter((a) => a.status === "scheduled").length;
  const reviewCount = articles.filter((a) => a.status === "review").length;

  return (
    <div
      className={`write-cms ${focus ? "focus-mode" : ""}`}
      data-theme={theme}
    >
      {/* Topbar */}
      <header className="topbar">
        <div className="brand"><span className="mark">h</span><span>Hans van Leeuwen</span></div>
        <nav>
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }}>Home</a>
          <a href="/work" onClick={(e) => { e.preventDefault(); navigate("/work"); }}>Werk</a>
          <a href="/writing" onClick={(e) => { e.preventDefault(); navigate("/writing"); }}>Artikelen</a>
          <a href="/about" onClick={(e) => { e.preventDefault(); navigate("/about"); }}>Over Hans</a>
          <span className="current" aria-current="page">Command Center</span>
        </nav>
        <div className="topbar-end">
          <button className="icon-btn" title="Search" aria-label="Search"><Icon.Search /></button>
          <button
            className="icon-btn"
            onClick={() => setTheme((t) => t === "light" ? "dark" : "light")}
            title="Theme"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Icon.Moon /> : <Icon.Sun />}
          </button>
          <div className="lang-toggle">
            <button className="active">NL</button>
            <button>EN</button>
          </div>
          <button className="profile-chip">
            <span className="avatar">H</span><span>Hans</span>
          </button>
        </div>
      </header>

      {/* Shell */}
      <div className="shell" data-screen-label={`Write · ${view}`}>
        {/* Modes sidebar */}
        <aside className="modes" aria-label="Modes">
          <button
            className="mode"
            aria-current={view === "write" ? "page" : undefined}
            onClick={() => switchView("write")}
          >
            <span className="mode-l"><Icon.Pen /><span>Write</span></span>
            <span className="count">{draft ? "1 open" : "new"}</span>
          </button>
          <button
            className="mode"
            aria-current={view === "manage" ? "page" : undefined}
            onClick={() => switchView("manage")}
          >
            <span className="mode-l"><Icon.Grid /><span>Manage</span></span>
            <span className="count">{articles.length}</span>
          </button>
          <button
            className="mode"
            aria-current={view === "analytics" ? "page" : undefined}
            onClick={() => switchView("analytics")}
          >
            <span className="mode-l"><Icon.Bars /><span>Analytics</span></span>
            <span className="count">7d</span>
          </button>
        </aside>

        {view === "write" && (
          <>
            <main className="main">
              <section className="hero">
                <div className="hero-titleblock">
                  <div className="eyebrow">
                    <span>Draft{draft?.id ? ` #${draft.id.slice(0, 6)}` : " · new"}</span>
                    <span className="sep">·</span>
                    <span className={`stage-pill ${stageClass}`}>{stageLabel}</span>
                    <span className="sep">·</span>
                    {lastSavedAt ? (
                      <span className="save-state" key={tick}>
                        <span className="pulse" /> saved {relTime(lastSavedAt)} ago
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-3)" }}>not saved yet</span>
                    )}
                  </div>
                  <h1 className="h-wordmark">Schrijven<em>.</em></h1>
                  <input
                    className="title-input"
                    type="text"
                    placeholder="Untitled draft"
                    value={titleVal}
                    onChange={(e) => setTitleVal(e.target.value)}
                  />
                </div>
                <div className="hero-actions">
                  <button
                    className="stamp-btn stamp-btn--ghost stamp-btn--sm"
                    onClick={newDraft}
                    title="Start a new draft"
                  >
                    <Icon.Clock /> New
                  </button>
                  <button
                    className="stamp-btn"
                    onClick={handlePublish}
                    disabled={publishing || !titleVal.trim()}
                  >
                    {publishing ? <span className="spinner" /> : <Icon.Arrow />}
                    {publishing ? "Publishing..." : "Publish"}
                  </button>
                </div>
              </section>

              {/* Hero image (placeholder; Phase 2 wires Gemini) */}
              <div
                className={`hero-image ${heroUrl ? "" : "empty"}`}
                onClick={heroLoading ? undefined : handleCover}
                title="Click to generate"
                style={{ cursor: heroLoading ? "wait" : "pointer" }}
              >
                {heroUrl ? (
                  <>
                    <img src={heroUrl} alt="Hero" />
                    <button className="edit-chip" onClick={(e) => { e.stopPropagation(); handleCover(); }}>
                      {heroLoading ? <span className="spinner" /> : <Icon.Pen />} {heroLoading ? "Generating..." : "Regenerate"}
                    </button>
                  </>
                ) : (
                  <div className="empty-cta">
                    <div className="glyph">
                      {heroLoading ? (
                        <span className="spinner" style={{ width: 22, height: 22 }} />
                      ) : (
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <path d="M12 2l2.5 7L22 11l-7.5 2L12 22l-2.5-9L2 11l7.5-2z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <strong>{heroLoading ? "Generating..." : "Add a hero image"}</strong>
                    <span>generated with gemini · always editorial</span>
                  </div>
                )}
              </div>

              {/* Paper / Editor */}
              <section className="paper">
                <div className="paper-head">
                  <div className="l">
                    <div className="lang-tabs" role="tablist">
                      <button className={langMode === "split" ? "on" : ""} onClick={() => setLangMode("split")}>SPLIT</button>
                      <button className={langMode === "en" ? "on" : ""} onClick={() => setLangMode("en")}>EN</button>
                      <button className={langMode === "nl" ? "on" : ""} onClick={() => setLangMode("nl")}>NL</button>
                    </div>
                    <button
                      className={`focus-chip ${focus ? "on" : ""}`}
                      onClick={() => setFocus((f) => !f)}
                      title="Focus mode · ⌘."
                    >
                      <Icon.Focus /> Focus
                    </button>
                  </div>
                  <div className="stats">
                    <span><strong>{enWords.toLocaleString()}</strong> EN</span>
                    <span className="sep">·</span>
                    <span><strong>{nlWords.toLocaleString()}</strong> NL</span>
                    <span className="sep">·</span>
                    <span>~<strong>{readMin}</strong> min</span>
                  </div>
                </div>

                <div className={`editor-body ${langMode === "split" ? "split" : ""}`}>
                  {(langMode === "split" || langMode === "en") && (
                    <div className={`lang-col ${langMode === "split" && false ? "dim" : ""}`}>
                      <span className="lang-tag">EN · primary</span>
                      <div
                        ref={enRef}
                        className="prose"
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck={false}
                        role="textbox"
                        aria-multiline="true"
                        aria-label="English article body"
                        onInput={(e) => setEnHtml((e.target as HTMLDivElement).innerHTML)}
                      />
                    </div>
                  )}
                  {langMode === "split" && <div className="divider" />}
                  {(langMode === "split" || langMode === "nl") && (
                    <div className={`lang-col ${langMode === "split" ? "dim" : ""}`}>
                      <span className={`lang-tag ${langMode === "split" ? "dim" : ""}`}>NL · vertaling</span>
                      <div
                        ref={nlRef}
                        className="prose"
                        contentEditable
                        suppressContentEditableWarning
                        spellCheck={false}
                        role="textbox"
                        aria-multiline="true"
                        aria-label="Dutch translation body"
                        onInput={(e) => setNlHtml((e.target as HTMLDivElement).innerHTML)}
                      />
                    </div>
                  )}
                </div>

                <div className="dock">
                  <div className="dock-stats">
                    <span><strong>{enWords.toLocaleString()}</strong> words</span>
                    <span className="sep">·</span>
                    <span>~<strong>{readMin}</strong> min read</span>
                    <span className="sep">·</span>
                    <span><Icon.Sparkle c="var(--accent)" /> <strong className="ai-amber">{review?.dimensions.reduce((n, d) => n + d.suggestions.length, 0) ?? 0}</strong> tips</span>
                    <span className="sep">·</span>
                    <span style={{ color: saving ? "var(--ink-2)" : lastSavedAt ? "var(--live)" : "var(--ink-3)" }}>
                      {saving ? <><span className="spinner" /> saving...</> : lastSavedAt ? "✓ saved" : "unsaved"}
                    </span>
                  </div>
                  <div className="dock-cta">
                    <button
                      className="dock-tool-btn"
                      onClick={handleCover}
                      disabled={heroLoading}
                      title="Generate cover image"
                    >
                      {heroLoading ? <span className="spinner" /> : <Icon.Image />} Cover
                    </button>
                    <button
                      className="dock-tool-btn"
                      onClick={handleReview}
                      disabled={reviewing}
                      title="Run 10-dimension agent review"
                    >
                      {reviewing ? <span className="spinner" /> : <Icon.Sparkle c="var(--accent)" />} {reviewing ? "Reviewing..." : "Review"}
                    </button>
                    <button
                      className="dock-tool-btn"
                      onClick={() => handleSave()}
                      disabled={saving}
                      style={{ marginLeft: 8 }}
                      title="Save (⌘S)"
                    >
                      <Icon.Save /> Save
                    </button>
                    <span className="kbd">⌘</span><span className="kbd">S</span>
                    <button
                      className="dock-tool-btn"
                      onClick={() => setFocus((f) => !f)}
                      style={{ marginLeft: 8 }}
                      title="Focus mode (⌘.)"
                    >
                      <Icon.Focus /> Focus
                    </button>
                    <span className="kbd">⌘</span><span className="kbd">.</span>
                  </div>
                </div>
              </section>
            </main>

            {/* Right rail (Phase 1: static placeholders; Phase 2 wires real review scores) */}
            <aside className="rail" aria-label="Inspector">
              <h2 className="rail-h">Editors <em>at work</em></h2>

              <div className="card voice-card">
                <div className="card-head">
                  <span>Writing style</span>
                  <span style={{ cursor: "pointer" }}>change</span>
                </div>
                <div className="name">Technical Deep<em> Dive</em></div>
                <div className="fit">
                  {totalScore == null
                    ? "— score pending · run review"
                    : review?.publish_ready
                      ? `${totalScore}/100 · publish ready`
                      : `${totalScore}/100 · keep editing`}
                </div>
              </div>

              <div className="card" style={{ "--pct": `${voiceScore?.score ?? 0}%`, "--gauge-color": "var(--live)" } as React.CSSProperties}>
                <div className="score-row">
                  <span>Sounds like you</span>
                  <span><strong>{voiceScore?.score ?? "—"}</strong><span className="max">/100</span></span>
                </div>
                <div className="gauge" />
                <div className="sub">{voiceScore?.feedback ?? "run review to score"}</div>
              </div>

              <div className="card" style={{ "--pct": `${seoScore?.score ?? 0}%`, "--gauge-color": "var(--accent)" } as React.CSSProperties}>
                <div className="score-row">
                  <span>Will people find it</span>
                  <span><strong>{seoScore?.score ?? "—"}</strong><span className="max">/100</span></span>
                </div>
                <div className="gauge" />
                <div className="sub">{seoScore?.feedback ?? "run review to score"}</div>
              </div>

              <div className="card" style={{ "--pct": `${readScore?.score ?? 0}%`, "--gauge-color": "var(--scheduled)" } as React.CSSProperties}>
                <div className="score-row">
                  <span>Easy to read</span>
                  <span><strong>{readScore?.score ?? "—"}</strong><span className="max">/100</span></span>
                </div>
                <div className="gauge" />
                <div className="sub">{readScore?.feedback ?? "run review to score"}</div>
              </div>

              {review && review.dimensions.length > 0 && (
                <>
                  <div className="rail-sub"><span><strong>All dimensions</strong></span></div>
                  <div className="outline-list">
                    {review.dimensions.map((d, i) => (
                      <div key={i} className="outline-item">
                        <span className="n">{d.score}</span>
                        {d.name}
                      </div>
                    ))}
                  </div>
                  {review.forbidden_terms_found.length > 0 && (
                    <div className="card" style={{ borderColor: "var(--review)" }}>
                      <div className="card-head"><span>Forbidden terms</span></div>
                      <div className="fit">{review.forbidden_terms_found.join(", ")}</div>
                    </div>
                  )}
                </>
              )}

              <div className="rail-sub"><span><strong>Outline</strong></span></div>
              <div className="outline-list">
                {outline.length === 0 && (
                  <div className="outline-item"><span className="n">—</span>Start with ## headings</div>
                )}
                {outline.map((h, i) => (
                  <div key={i} className={`outline-item ${h.level === 2 ? "" : "active"}`}>
                    <span className="n">{String(i).padStart(2, "0")}</span>{h.text}
                  </div>
                ))}
              </div>
            </aside>
          </>
        )}

        {view === "manage" && (
          <main className="main" style={{ gridColumn: "2 / span 2" }}>
            <h1 className="manage-h">Manage<em>.</em></h1>
            <div className="manage-stats">
              <strong>{articles.length}</strong> articles
              <span className="sep">·</span>
              <strong>{liveCount}</strong> live
              <span className="sep">·</span>
              <strong>{draftCount}</strong> drafts
              <span className="sep">·</span>
              <strong>{scheduledCount}</strong> scheduled
              <span className="sep">·</span>
              <strong>{reviewCount}</strong> in review
            </div>
            <ManageTable
              articles={articles}
              loading={loading}
              onOpen={openDraft}
              onNew={newDraft}
            />
          </main>
        )}

        {view === "analytics" && (
          <main className="main" style={{ gridColumn: "2 / span 2" }}>
            <h1 className="manage-h">Analytics<em>.</em></h1>
            <div className="manage-stats">
              <strong>{articles.length}</strong> total <span className="sep">·</span>
              synced just now
            </div>
            <AnalyticsView articles={articles} />
          </main>
        )}
      </div>

      {toast && (
        <div className={`toast ${toast.kind === "error" ? "error" : ""}`}>{toast.msg}</div>
      )}
    </div>
  );
}

// ─── Manage Table ───────────────────────────────────────────────────
function ManageTable({
  articles, loading, onOpen, onNew,
}: {
  articles: Article[];
  loading: boolean;
  onOpen: (a: Article) => void;
  onNew: () => void;
}) {
  const [filter, setFilter] = useState<"all" | Article["status"]>("all");
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    let list = articles;
    if (filter !== "all") list = list.filter((a) => a.status === filter);
    if (q.trim()) {
      const Q = q.toLowerCase();
      list = list.filter((a) =>
        a.title.toLowerCase().includes(Q) ||
        a.slug.toLowerCase().includes(Q) ||
        a.category?.toLowerCase().includes(Q));
    }
    return list;
  }, [articles, filter, q]);

  const counts = useMemo(() => ({
    all: articles.length,
    draft: articles.filter((a) => a.status === "draft").length,
    published: articles.filter((a) => a.status === "published").length,
    scheduled: articles.filter((a) => a.status === "scheduled").length,
    review: articles.filter((a) => a.status === "review").length,
  }), [articles]);

  return (
    <div className="posts-wrap">
      <div className="posts-toolbar">
        <div className="filter-tabs">
          <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All <span style={{ opacity: 0.5, marginLeft: 4 }}>{counts.all}</span></button>
          <button className={filter === "draft" ? "on" : ""} onClick={() => setFilter("draft")}>Draft <span style={{ opacity: 0.5, marginLeft: 4 }}>{counts.draft}</span></button>
          <button className={filter === "published" ? "on" : ""} onClick={() => setFilter("published")}>Live <span style={{ opacity: 0.5, marginLeft: 4 }}>{counts.published}</span></button>
          <button className={filter === "scheduled" ? "on" : ""} onClick={() => setFilter("scheduled")}>Scheduled <span style={{ opacity: 0.5, marginLeft: 4 }}>{counts.scheduled}</span></button>
          <button className={filter === "review" ? "on" : ""} onClick={() => setFilter("review")}>Review <span style={{ opacity: 0.5, marginLeft: 4 }}>{counts.review}</span></button>
        </div>
        <span className="search-mini">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M10 10l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
          <input type="text" placeholder="Filter posts..." value={q} onChange={(e) => setQ(e.target.value)} />
        </span>
        <div className="grow" />
        <button className="dock-tool-btn" onClick={onNew}>+ New draft</button>
      </div>
      <table className="posts-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Status</th>
            <th>Category</th>
            <th className="num">Words</th>
            <th className="num">Updated</th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--ink-2)" }}>Loading...</td></tr>
          )}
          {!loading && filtered.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--ink-2)" }}>No articles match this filter.</td></tr>
          )}
          {filtered.map((a) => (
            <tr key={a.id} onClick={() => onOpen(a)}>
              <td className="title">{a.title}<small>/writing/{a.slug}</small></td>
              <td><span className={`posts-pill ${STAGE_CLASS[a.status] ?? "draft"}`}>{a.status}</span></td>
              <td className="cat">{a.category || "—"}</td>
              <td className="num">{(a.word_count ?? 0).toLocaleString()}</td>
              <td className="num" style={{ color: "var(--ink-2)" }}>{relTime(a.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Analytics ──────────────────────────────────────────────────────
function AnalyticsView({ articles }: { articles: Article[] }) {
  const live = articles.filter((a) => a.status === "published");
  const totalWords = articles.reduce((s, a) => s + (a.word_count ?? 0), 0);
  const avgWords = articles.length ? Math.round(totalWords / articles.length) : 0;
  const last30 = articles.filter((a) => {
    const d = new Date(a.created_at);
    return Date.now() - d.getTime() < 30 * 24 * 3600 * 1000;
  }).length;

  // simple sparkline: drafts created per day for last 30 days
  const buckets = useMemo(() => {
    const arr = new Array(30).fill(0);
    const now = Date.now();
    for (const a of articles) {
      const d = new Date(a.created_at).getTime();
      const days = Math.floor((now - d) / (24 * 3600 * 1000));
      if (days >= 0 && days < 30) arr[29 - days] += 1;
    }
    return arr;
  }, [articles]);

  const max = Math.max(1, ...buckets);
  const points = buckets.map((v, i) => `${(i / 29) * 600},${200 - (v / max) * 180}`).join(" L ");
  const path = `M ${points}`;

  const topByWords = [...articles]
    .filter((a) => a.status === "published")
    .sort((a, b) => (b.word_count ?? 0) - (a.word_count ?? 0))
    .slice(0, 5);

  return (
    <>
      <div className="analytics-grid">
        <div className="metric-cell">
          <div className="k">Total articles</div>
          <div className="v">{articles.length}</div>
          <div className="delta flat">{last30} in last 30d</div>
        </div>
        <div className="metric-cell">
          <div className="k">Live</div>
          <div className="v">{live.length}<span className="unit">/ {articles.length}</span></div>
          <div className="delta flat">published</div>
        </div>
        <div className="metric-cell">
          <div className="k">Avg word count</div>
          <div className="v">{avgWords.toLocaleString()}</div>
          <div className="delta flat">across all drafts</div>
        </div>
        <div className="metric-cell">
          <div className="k">Words written</div>
          <div className="v">{Math.round(totalWords / 1000)}<span className="unit">k</span></div>
          <div className="delta flat">total</div>
        </div>
      </div>

      <div className="chart-card">
        <h3>Drafts created · last 30 days</h3>
        <svg className="chart-svg" viewBox="0 0 600 220" preserveAspectRatio="none">
          <defs>
            <linearGradient id="writeChartFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.4"/>
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <g stroke="var(--line)" strokeWidth="1">
            <line x1="0" y1="40" x2="600" y2="40"/>
            <line x1="0" y1="100" x2="600" y2="100"/>
            <line x1="0" y1="160" x2="600" y2="160"/>
          </g>
          <path d={`${path} L 600,220 L 0,220 Z`} fill="url(#writeChartFill)"/>
          <path d={path} stroke="var(--ink-0)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <div className="chart-card">
        <h3>Top published · by length</h3>
        <div className="top-list">
          {topByWords.length === 0 && (
            <div className="top-row"><span className="rank">—</span><span className="title">No published articles yet</span><span className="val">0</span><span className="trend flat">→</span></div>
          )}
          {topByWords.map((a, i) => (
            <div className="top-row" key={a.id}>
              <span className="rank">{String(i + 1).padStart(2, "0")}</span>
              <span className="title">{a.title}</span>
              <span className="val">{(a.word_count ?? 0).toLocaleString()}</span>
              <span className="trend flat">→</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
