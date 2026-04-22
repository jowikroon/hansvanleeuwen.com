import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { blogPosts } from "@/data/content";
import { BlogPost } from "@/data/types";
import {
  Calendar,
  Clock,
  ArrowRight,
  BookOpen,
  Search,
  X,
  TrendingUp,
  PenLine,
} from "lucide-react";

// ── Tag accent system ────────────────────────────────────────────────

const tagAccent: Record<string, { pill: string; dot: string }> = {
  "E-commerce":  { pill: "bg-primary/10 text-primary ring-primary/20",              dot: "bg-primary" },
  "AI":          { pill: "bg-violet-500/10 text-violet-600 ring-violet-500/20",     dot: "bg-violet-500" },
  "UX":          { pill: "bg-blue-500/10 text-blue-600 ring-blue-500/20",           dot: "bg-blue-500" },
  "SaaS":        { pill: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",  dot: "bg-emerald-500" },
  "Engineering": { pill: "bg-amber-500/10 text-amber-600 ring-amber-500/20",        dot: "bg-amber-500" },
  "Architecture":{ pill: "bg-indigo-500/10 text-indigo-600 ring-indigo-500/20",     dot: "bg-indigo-500" },
  "Automation":  { pill: "bg-teal-500/10 text-teal-600 ring-teal-500/20",           dot: "bg-teal-500" },
  "CRO":         { pill: "bg-rose-500/10 text-rose-600 ring-rose-500/20",           dot: "bg-rose-500" },
  "Compliance":  { pill: "bg-red-500/10 text-red-600 ring-red-500/20",              dot: "bg-red-500" },
  "Strategy":    { pill: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/20",           dot: "bg-cyan-500" },
};

const fallbackAccent = { pill: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground" };

const accentFor = (tag: string) => tagAccent[tag] ?? fallbackAccent;

// ── Helpers ──────────────────────────────────────────────────────────

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Lazy image with shimmer ─────────────────────────────────────────

function Img({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div className={`relative overflow-hidden bg-muted ${className}`}>
      {!loaded && <div className="absolute inset-0 animate-pulse bg-muted" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        className={`w-full h-full object-cover transition-all duration-700 ${loaded ? "opacity-100 scale-100" : "opacity-0 scale-105"}`}
      />
    </div>
  );
}

// ── Hero Essay ───────────────────────────────────────────────────────

function HeroEssay({ post }: { post: BlogPost }) {
  const reduce = useReducedMotion();
  return (
    <Link to={`/writing/${post.slug}`} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-4 focus-visible:ring-offset-background rounded-2xl">
      <motion.article
        initial={{ opacity: 0, y: reduce ? 0 : 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl overflow-hidden"
      >
        <div className="aspect-[2/1] sm:aspect-[21/9] min-h-[320px] sm:min-h-[400px]">
          {post.image && <Img src={post.image} alt={post.title} className="absolute inset-0" />}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-black/5" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5 mb-4">
              {post.tags.slice(0, 2).map((tag) => {
                const accent = accentFor(tag);
                return (
                  <span
                    key={tag}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ring-1 ${accent.pill}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                    {tag}
                  </span>
                );
              })}
              <span className="text-[11px] text-white/70 font-medium flex items-center gap-1">
                <Clock className="h-3 w-3" /> {post.readTime}
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-medium text-white leading-[1.15] mb-4 group-hover:text-primary/95 transition-colors duration-300">
              {post.title}
            </h2>
            <p className="text-white/75 text-sm sm:text-base leading-relaxed mb-6 line-clamp-2 max-w-xl">
              {post.excerpt}
            </p>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/20">
                  <span className="font-display text-[11px] font-semibold text-white">HvL</span>
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Hans van Leeuwen</p>
                  <p className="text-white/50 text-[11px]">
                    <time dateTime={post.date}>{formatDateLong(post.date)}</time>
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 ml-auto text-sm font-medium text-white/80 group-hover:text-primary transition-colors">
                Read essay <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        </div>
      </motion.article>
    </Link>
  );
}

// ── Popular Rail ─────────────────────────────────────────────────────

function PopularRail({ posts }: { posts: BlogPost[] }) {
  if (posts.length < 4) return null;
  const items = posts.slice(0, 4);
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
          <TrendingUp className="h-3 w-3" /> Popular
        </span>
        <div className="h-px flex-1 bg-border/60" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
        {items.map((post, i) => {
          const accent = accentFor(post.tags[0] ?? "");
          return (
            <Link
              key={post.id}
              to={`/writing/${post.slug}`}
              className="group flex items-start gap-3 py-2 rounded-lg hover:bg-muted/40 -mx-2 px-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <span className="font-display text-3xl font-black text-primary/15 leading-none tabular-nums select-none">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 pt-1">
                <h4 className="text-[13px] font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                  {post.title}
                </h4>
                <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                  {post.tags[0]} &middot; {post.readTime}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Article Card (3 variants) ────────────────────────────────────────

function ArticleCard({
  post,
  variant = "default",
  index = 0,
}: {
  post: BlogPost;
  variant?: "default" | "compact" | "horizontal";
  index?: number;
}) {
  const reduce = useReducedMotion();
  const primaryTag = post.tags[0];
  const accent = accentFor(primaryTag ?? "");

  if (variant === "horizontal") {
    return (
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: reduce ? 0 : index * 0.05 }}
      >
        <Link
          to={`/writing/${post.slug}`}
          className="group flex gap-4 sm:gap-5 items-start py-5 border-b border-border/60 last:border-0 hover:bg-muted/30 -mx-3 px-3 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          {post.image && (
            <Img src={post.image} alt={post.title} className="w-28 sm:w-36 aspect-[4/3] rounded-lg shrink-0" />
          )}
          <div className="min-w-0 flex-1 py-0.5">
            <div className="flex items-center gap-2 mb-2">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${accent.dot}`} />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{primaryTag}</span>
            </div>
            <h3 className="font-display text-base font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {post.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-1.5 line-clamp-1 hidden sm:block">{post.excerpt}</p>
            <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
              <time dateTime={post.date}>{formatDateShort(post.date)}</time>
              <span className="text-border">|</span>
              <span>{post.readTime}</span>
              {post.tags.length > 1 && (
                <>
                  <span className="text-border">|</span>
                  <span>{post.tags.slice(1, 3).join(", ")}</span>
                </>
              )}
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary/70 group-hover:translate-x-0.5 shrink-0 mt-2 transition-all" />
        </Link>
      </motion.div>
    );
  }

  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: reduce ? 0 : index * 0.06 }}
      >
        <Link
          to={`/writing/${post.slug}`}
          className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-xl"
        >
          <article className="h-full flex flex-col">
            {post.image && (
              <div className="relative rounded-xl overflow-hidden aspect-[3/2]">
                <Img src={post.image} alt={post.title} className="absolute inset-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            )}
            <div className="pt-3.5 flex flex-col flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{primaryTag}</span>
                <span className="text-[11px] text-muted-foreground ml-auto">{post.readTime}</span>
              </div>
              <h3 className="font-display text-[15px] font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors flex-1">
                {post.title}
              </h3>
              <div className="flex items-center gap-2.5 mt-2.5 text-[11px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <time dateTime={post.date}>{formatDateShort(post.date)}</time>
                <span className="ml-auto inline-flex items-center gap-0.5 text-muted-foreground/70 group-hover:text-primary transition-colors">
                  Read <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>
          </article>
        </Link>
      </motion.div>
    );
  }

  // Default variant
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: reduce ? 0 : index * 0.06 }}
    >
      <Link
        to={`/writing/${post.slug}`}
        className="group block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-2xl"
      >
        <article className="h-full flex flex-col rounded-2xl overflow-hidden border border-border/40 bg-card hover:border-border transition-all hover:shadow-md">
          {post.image && (
            <div className="relative aspect-[16/9] overflow-hidden">
              <Img src={post.image} alt={post.title} className="absolute inset-0" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>
          )}
          <div className="p-5 sm:p-6 flex flex-col flex-1">
            <div className="flex items-center gap-2 mb-3">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${accent.pill}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                {primaryTag}
              </span>
              <span className="text-[11px] text-muted-foreground">{post.readTime}</span>
            </div>
            <h3 className="font-display text-lg font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {post.title}
            </h3>
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed flex-1">
              {post.excerpt}
            </p>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/40">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="font-display text-[9px] font-semibold text-primary">HvL</span>
                </div>
                <time dateTime={post.date} className="text-xs text-muted-foreground">
                  {formatDateShort(post.date)}
                </time>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground/70 group-hover:text-primary transition-colors">
                Read essay <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </span>
            </div>
          </div>
        </article>
      </Link>
    </motion.div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────

const Writing = () => {
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const allTags = useMemo(
    () => [...new Set(blogPosts.flatMap((p) => p.tags))],
    []
  );

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = { all: blogPosts.length };
    for (const p of blogPosts) {
      for (const t of p.tags) counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, []);

  // Keyboard shortcut: "/" focuses search, Esc closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inInput = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (e.key === "/" && !inInput) {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      } else if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen]);

  // Filter + search
  const filtered = useMemo(() => {
    let list = blogPosts;
    if (filter !== "all") list = list.filter((p) => p.tags.includes(filter));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.excerpt.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    // Sort by date desc for predictable ordering
    return [...list].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [filter, searchQuery]);

  const isFilteredOrSearching = filter !== "all" || searchQuery.length > 0;

  // Hero = most recent featured (if no filter/search), else skip hero
  const hero = useMemo(() => {
    if (isFilteredOrSearching) return null;
    const featured = blogPosts.filter((p) => p.featured).sort((a, b) => (a.date < b.date ? 1 : -1));
    return featured[0] ?? filtered[0] ?? null;
  }, [filtered, isFilteredOrSearching]);

  const withoutHero = hero ? filtered.filter((p) => p.id !== hero.id) : filtered;

  const popular = !isFilteredOrSearching ? withoutHero.slice(0, 4) : [];
  const gridPosts = !isFilteredOrSearching ? withoutHero.slice(4) : withoutHero;

  const defaultCards = gridPosts.slice(0, 2);
  const compactCards = gridPosts.slice(2, 5);
  const horizontalCards = gridPosts.slice(5);

  const resetAll = useCallback(() => {
    setFilter("all");
    setSearchQuery("");
    setSearchOpen(false);
  }, []);

  const handleFilterChange = useCallback((f: string) => {
    setFilter(f);
    setTimeout(() => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, []);

  // Progressive disclosure: show search once archive is at least 8 posts
  const searchEnabled = blogPosts.length >= 8;

  const filterPills = ["all", ...allTags];

  return (
    <section className="section-container pt-28 pb-20">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mb-8 flex items-start gap-4"
      >
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-1">
          <PenLine className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-primary">Writing</p>
          <h1 className="mb-3 font-display text-4xl font-medium tracking-tight text-foreground md:text-5xl">
            Thoughts &amp; Essays
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
            On e-commerce, AI, design, and the operational realities of scaling marketplace businesses.
            <span className="text-muted-foreground/70"> · {blogPosts.length} essays · {allTags.length} topics</span>
          </p>
        </div>
      </motion.div>

      {/* Hero */}
      {hero && (
        <div className="mt-6">
          <HeroEssay post={hero} />
        </div>
      )}

      {/* Popular rail */}
      {popular.length >= 4 && (
        <div className="mt-10">
          <PopularRail posts={popular} />
        </div>
      )}

      {/* Sticky filter bar — breaks out of section-container padding with -mx-6 */}
      <div className="sticky top-[68px] z-40 bg-background/85 backdrop-blur-xl border-y border-border/60 -mx-6 px-6 mt-8">
        <div className="flex items-center justify-between gap-3 h-14">
          {/* Tag pills */}
          <div className="relative flex-1 min-w-0">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 py-1">
              {filterPills.map((tag) => {
                const isActive = filter === tag;
                const count = tagCounts[tag] ?? 0;
                const accent = tag !== "all" ? accentFor(tag) : null;
                return (
                  <button
                    key={tag}
                    onClick={() => handleFilterChange(tag)}
                    aria-pressed={isActive}
                    className={`relative inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                      isActive
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    {accent && !isActive && <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />}
                    {tag === "all" ? "All" : tag}
                    <span className={`text-[10px] tabular-nums ml-0.5 ${isActive ? "text-background/60" : "text-muted-foreground/50"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Fade-right scroll hint on mobile */}
            <div className="absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
          </div>

          {/* Search */}
          {searchEnabled && (
            <div className="flex items-center gap-2 shrink-0">
              <AnimatePresence mode="wait">
                {searchOpen && (
                  <motion.div
                    key="input"
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 220, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <input
                        ref={searchInputRef}
                        autoFocus
                        placeholder="Search essays..."
                        aria-label="Search essays"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full h-8 rounded-full bg-muted/60 border-0 pl-8 pr-8 text-sm outline-none focus:ring-1 ring-primary/40 placeholder:text-muted-foreground/50"
                      />
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery("")}
                          aria-label="Clear search"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <button
                onClick={() => {
                  setSearchOpen(!searchOpen);
                  if (searchOpen) setSearchQuery("");
                }}
                aria-label={searchOpen ? "Close search" : "Open search"}
                aria-expanded={searchOpen}
                className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                  searchOpen ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                }`}
              >
                {searchOpen ? <X className="h-3.5 w-3.5" /> : <Search className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      <div ref={gridRef} className="scroll-mt-32 pt-8">
        <AnimatePresence mode="wait">
          {gridPosts.length > 0 ? (
            <motion.div
              key={filter + searchQuery}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              {/* Row 1 — default cards */}
              {defaultCards.length > 0 && (
                <div className="grid md:grid-cols-2 gap-5 sm:gap-6 mb-6">
                  {defaultCards.map((post, i) => (
                    <ArticleCard key={post.id} post={post} variant="default" index={i} />
                  ))}
                </div>
              )}

              {/* Row 2 — compact cards */}
              {compactCards.length > 0 && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mb-6">
                  {compactCards.map((post, i) => (
                    <ArticleCard key={post.id} post={post} variant="compact" index={i} />
                  ))}
                </div>
              )}

              {/* Row 3 — horizontal list */}
              {horizontalCards.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-sm font-semibold text-muted-foreground">More Essays</span>
                    <div className="h-px flex-1 bg-border/60" />
                  </div>
                  {horizontalCards.map((post, i) => (
                    <ArticleCard key={post.id} post={post} variant="horizontal" index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-24"
            >
              <BookOpen className="h-10 w-10 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-muted-foreground mb-1">
                No essays match {searchQuery ? `"${searchQuery}"` : "this filter"}.
              </p>
              <button
                onClick={resetAll}
                className="text-primary text-sm mt-1 hover:underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-sm"
              >
                Reset filters
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
};

export default Writing;
