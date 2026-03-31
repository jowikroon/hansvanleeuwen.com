import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { blogPosts } from "@/data/content";
import { BlogPost } from "@/data/types";
import { Calendar, Clock, ArrowRight } from "lucide-react";

type Filter = "all" | "professional" | "personal";

const tagAccent: Record<string, string> = {
  "E-commerce": "bg-primary/10 text-primary",
  "AI": "bg-violet-500/10 text-violet-600",
  "UX": "bg-blue-500/10 text-blue-600",
  "SaaS": "bg-emerald-500/10 text-emerald-600",
  "Engineering": "bg-amber-500/10 text-amber-600",
  "Architecture": "bg-indigo-500/10 text-indigo-600",
  "Automation": "bg-teal-500/10 text-teal-600",
  "CRO": "bg-rose-500/10 text-rose-600",
  "Compliance": "bg-red-500/10 text-red-600",
  "Strategy": "bg-cyan-500/10 text-cyan-600",
};

function Img({ src, alt, className }: { src: string; alt: string; className?: string }) {
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

function HeroArticle({ post }: { post: BlogPost }) {
  return (
    <Link to={`/writing/${post.slug}`} className="group block">
      <motion.article
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative rounded-2xl overflow-hidden"
      >
        <div className="aspect-[21/9] min-h-[320px] sm:min-h-[400px]">
          {post.image && <Img src={post.image} alt={post.title} className="absolute inset-0" />}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2.5 mb-4">
              {post.tags.slice(0, 2).map((tag) => (
                <span key={tag} className={`inline-block rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${tagAccent[tag] ?? "bg-white/10 text-white/80"}`}>
                  {tag}
                </span>
              ))}
              <span className="text-[11px] text-white/60 flex items-center gap-1">
                <Clock className="h-3 w-3" /> {post.readTime}
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl lg:text-4xl font-medium text-white leading-tight mb-3 group-hover:text-primary transition-colors duration-300">
              {post.title}
            </h2>
            <p className="text-white/70 text-sm sm:text-base leading-relaxed mb-5 line-clamp-2 max-w-xl">
              {post.excerpt}
            </p>
            <div className="flex items-center gap-3">
              <span className="text-xs text-white/50 flex items-center gap-1.5">
                <Calendar className="h-3 w-3" />
                {new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-white/70 group-hover:text-primary ml-auto transition-colors">
                Read essay <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </div>
      </motion.article>
    </Link>
  );
}

function ArticleCard({ post, size = "default" }: { post: BlogPost; size?: "default" | "compact" }) {
  const isCompact = size === "compact";
  return (
    <Link to={`/writing/${post.slug}`} className="group block h-full">
      <article className="h-full flex flex-col rounded-xl overflow-hidden border border-border bg-card hover:border-primary/30 transition-all hover:shadow-sm">
        {post.image && (
          <div className={`relative overflow-hidden ${isCompact ? "aspect-[3/2]" : "aspect-[16/10]"}`}>
            <Img src={post.image} alt={post.title} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
        )}
        <div className="p-5 flex flex-col flex-1">
          <div className="flex items-center gap-2 mb-2.5">
            {post.tags.slice(0, 1).map((tag) => (
              <span key={tag} className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${tagAccent[tag] ?? "bg-muted text-muted-foreground"}`}>
                {tag}
              </span>
            ))}
            <span className="text-[11px] text-muted-foreground">{post.readTime}</span>
          </div>
          <h3 className={`font-display font-medium leading-snug group-hover:text-primary transition-colors ${isCompact ? "text-base line-clamp-2" : "text-lg line-clamp-2"}`}>
            {post.title}
          </h3>
          {!isCompact && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed flex-1">
              {post.excerpt}
            </p>
          )}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </span>
            <span className="text-xs text-muted-foreground capitalize">{post.category}</span>
          </div>
        </div>
      </article>
    </Link>
  );
}

const Writing = () => {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return blogPosts;
    return blogPosts.filter((p) => p.category === filter);
  }, [filter]);

  const featured = filtered.find((p) => p.featured);
  const rest = filtered.filter((p) => p !== featured);

  const allTags = [...new Set(blogPosts.flatMap((p) => p.tags))];

  return (
    <section className="section-container pt-28 pb-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="mb-10"
      >
        <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-primary">Writing</p>
        <h1 className="mb-4 font-display text-4xl font-medium tracking-tight text-foreground md:text-5xl">
          Thoughts &amp; Essays
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
          On e-commerce, AI, design, and the operational realities of scaling marketplace businesses.
        </p>
      </motion.div>

      {/* Hero featured article */}
      {featured && <HeroArticle post={featured} />}

      {/* Filter bar */}
      <div className="flex items-center gap-2 mt-10 mb-8 overflow-x-auto pb-1">
        {(["all", "professional", "personal"] as const).map((f) => {
          const isActive = filter === f;
          const count = f === "all" ? blogPosts.length : blogPosts.filter((p) => p.category === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all ${
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {f === "all" ? "All Essays" : f.charAt(0).toUpperCase() + f.slice(1)}
              <span className={`text-[10px] tabular-nums ${isActive ? "text-background/60" : "text-muted-foreground/50"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Article grid */}
      <AnimatePresence mode="wait">
        <motion.div
          key={filter}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {rest.length > 0 ? (
            <>
              {/* First 2: large cards */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                {rest.slice(0, 2).map((post) => (
                  <ArticleCard key={post.id} post={post} />
                ))}
              </div>

              {/* Next 3: compact */}
              {rest.length > 2 && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {rest.slice(2).map((post) => (
                    <ArticleCard key={post.id} post={post} size="compact" />
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="py-16 text-center text-muted-foreground">No essays match this filter.</p>
          )}
        </motion.div>
      </AnimatePresence>
    </section>
  );
};

export default Writing;
