import { useParams, Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { motion, useScroll, useSpring } from "framer-motion";
import { ArrowLeft, ArrowRight, Calendar, Clock, ChevronUp } from "lucide-react";
import { blogPosts as staticBlogPosts } from "@/data/content";
import { blogContent } from "@/data/blogContent";
import { fetchPublishedPostBySlug } from "@/data/publishedPosts";
import { BlogPost } from "@/data/types";

function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });
  return <motion.div className="fixed top-0 left-0 right-0 h-[3px] bg-primary z-[60] origin-left" style={{ scaleX }} />;
}

function BackToTop() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!visible) return null;
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
    >
      <ChevronUp className="h-4 w-4" />
    </motion.button>
  );
}

function RelatedCard({ post }: { post: BlogPost }) {
  return (
    <Link to={`/writing/${post.slug}`} className="group block h-full">
      <article className="h-full rounded-xl overflow-hidden border border-border bg-card hover:border-primary/30 transition-all">
        {post.image && (
          <div className="relative aspect-[3/2] overflow-hidden">
            <img src={post.image} alt={post.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
          </div>
        )}
        <div className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-primary">{post.tags[0]}</span>
          </div>
          <h3 className="font-display font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-2">
            {new Date(post.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {post.readTime}
          </p>
        </div>
      </article>
    </Link>
  );
}

function renderInlineParts(text: string) {
  // Split on bold, italic, code, and wiki links
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\[[^\]]+\]\])/g);
  return parts.map((part, j) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={j}>{part.slice(1, -1)}</em>;
    if (part.startsWith("`") && part.endsWith("`")) return <code key={j} className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{part.slice(1, -1)}</code>;
    if (part.startsWith("[[") && part.endsWith("]]")) {
      const concept = part.slice(2, -2);
      return <span key={j} className="text-primary font-medium border-b border-primary/30 cursor-help" title={`Knowledge Base: ${concept}`}>{concept}</span>;
    }
    return <span key={j}>{part}</span>;
  });
}

function renderContent(raw: string) {
  return raw
    .split("\n")
    .map((line, i) => {
      const trimmed = line.trim();
      // YouTube embed: [youtube:VIDEO_ID]
      if (trimmed.match(/^\[youtube:([a-zA-Z0-9_-]{11})\]$/)) {
        const videoId = trimmed.match(/^\[youtube:([a-zA-Z0-9_-]{11})\]$/)?.[1];
        if (videoId) {
          return (
            <div key={i} className="my-8 rounded-xl overflow-hidden border border-border shadow-sm">
              <div className="relative aspect-video">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                  title="YouTube video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 w-full h-full"
                />
              </div>
            </div>
          );
        }
      }
      // Wiki-style concept link on its own line: [[Concept Name]]
      if (trimmed.match(/^\[\[.*\]\]$/)) {
        const concept = trimmed.match(/^\[\[(.*)\]\]$/)?.[1];
        if (concept) {
          return (
            <div key={i} className="my-4 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex items-center gap-2">
              <span className="text-primary">&#9670;</span>
              <span className="text-sm font-medium text-primary">{concept}</span>
              <span className="text-xs text-muted-foreground ml-1">— Knowledge Base concept</span>
            </div>
          );
        }
      }
      if (trimmed.startsWith("## ")) return <h2 key={i} className="text-xl sm:text-2xl font-display font-medium mt-10 mb-4 text-foreground">{trimmed.slice(3)}</h2>;
      if (trimmed.startsWith("### ")) return <h3 key={i} className="text-lg font-display font-medium mt-8 mb-3 text-foreground">{trimmed.slice(4)}</h3>;
      if (trimmed.startsWith("**") && trimmed.endsWith("**")) return <p key={i} className="text-base leading-relaxed mb-4 font-semibold text-foreground">{trimmed.replace(/\*\*/g, "")}</p>;
      if (trimmed.startsWith("> ")) return <blockquote key={i} className="border-l-[3px] border-primary/40 pl-4 my-4 text-base text-muted-foreground italic">{renderInlineParts(trimmed.slice(2))}</blockquote>;
      if (trimmed.startsWith("- **")) {
        const match = trimmed.match(/\*\*(.*?)\*\*/);
        return <li key={i} className="text-base leading-relaxed mb-2 text-muted-foreground"><strong className="text-foreground">{match?.[1]}</strong>{trimmed.replace(/- \*\*.*?\*\*/, "")}</li>;
      }
      if (trimmed.startsWith("- ")) return <li key={i} className="text-base leading-relaxed mb-2 text-muted-foreground">{renderInlineParts(trimmed.slice(2))}</li>;
      if (/^\d+\.\s/.test(trimmed)) return <li key={i} className="text-base leading-relaxed mb-2 text-muted-foreground list-decimal ml-4">{renderInlineParts(trimmed.replace(/^\d+\.\s/, ""))}</li>;
      if (trimmed === "") return null;
      return (
        <p key={i} className="text-[17px] leading-[1.85] mb-5 text-muted-foreground">
          {renderInlineParts(trimmed)}
        </p>
      );
    })
    .filter(Boolean);
}

const BlogPostPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();

  // Live post + content from Supabase; falls back to the static archive.
  const [livePost, setLivePost] = useState<BlogPost | null>(null);
  const [liveContent, setLiveContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!slug) { setLoading(false); return; }
    setLoading(true);
    fetchPublishedPostBySlug(slug)
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setLivePost(result.post);
          setLiveContent(result.row.content);
        } else {
          setLivePost(null);
          setLiveContent(null);
        }
      })
      .catch(() => { /* fall through to static */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const staticPost = staticBlogPosts.find((p) => p.slug === slug);
  const post: BlogPost | undefined = livePost ?? staticPost;
  const content =
    liveContent ?? (slug ? blogContent[slug] : undefined);

  // Build the related list from the merged archive (live wins on slug collision)
  const mergedArchive = (() => {
    const live = livePost ? [livePost] : [];
    const liveSlugs = new Set(live.map((p) => p.slug));
    return [...live, ...staticBlogPosts.filter((p) => !liveSlugs.has(p.slug))];
  })();

  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);

  if (loading && !staticPost) {
    return (
      <section className="section-container pt-28 text-center">
        <p className="text-muted-foreground">Loading…</p>
      </section>
    );
  }

  if (!post) {
    return (
      <section className="section-container pt-28 text-center">
        <h1 className="font-display text-3xl text-foreground">Post not found</h1>
        <Link to="/writing" className="mt-4 inline-block text-primary hover:underline">← Back to Writing</Link>
      </section>
    );
  }

  const related = mergedArchive
    .filter((p) => p.slug !== slug)
    .sort((a, b) => {
      const aMatch = a.tags.some((t) => post.tags.includes(t)) ? 1 : 0;
      const bMatch = b.tags.some((t) => post.tags.includes(t)) ? 1 : 0;
      return bMatch - aMatch;
    })
    .slice(0, 3);

  return (
    <>
      <ReadingProgress />
      <BackToTop />

      {/* Hero Image */}
      {post.image && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
          <div className="relative w-full aspect-[21/9] max-h-[480px] overflow-hidden">
            <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
          </div>
        </motion.div>
      )}

      <section className={`section-container ${post.image ? "-mt-24 sm:-mt-32 relative" : "pt-28"} pb-20`}>
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="max-w-3xl mx-auto"
        >
          {/* Back link */}
          <Link to="/writing" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground group">
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> Back to Writing
          </Link>

          {/* Tags */}
          <div className="mb-5 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="text-xs font-semibold uppercase tracking-wider text-primary">{tag}</span>
            ))}
          </div>

          {/* Title */}
          <h1 className="mb-5 font-display text-3xl sm:text-4xl lg:text-[2.6rem] font-medium leading-[1.12] tracking-tight text-foreground">
            {post.title}
          </h1>

          {/* Meta */}
          <div className="mb-8 flex items-center gap-4 text-sm text-muted-foreground border-l-[3px] border-primary/40 pl-4">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(post.date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </span>
            <span>·</span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {post.readTime}
            </span>
          </div>

          {/* Content */}
          <div className="prose-custom">
            {content ? renderContent(content) : (
              <p className="text-muted-foreground italic">Full article coming soon.</p>
            )}
          </div>

          {/* Author card */}
          <div className="mt-12 p-5 rounded-2xl bg-card border border-border">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-lg font-display font-medium text-primary">H</span>
              </div>
              <div>
                <p className="font-display font-medium">Hans van Leeuwen</p>
                <p className="text-sm text-muted-foreground mb-2">Freelance E-commerce Manager & Marketplace Consultant</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Building marketplace businesses across Amazon, Bol.com, and the broader EU e-commerce ecosystem.
                  Based in Amersfoort, the Netherlands.
                </p>
              </div>
            </div>
          </div>

          {/* Back */}
          <div className="mt-8">
            <Link to="/writing" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group">
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" /> All essays
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="section-container pb-20 border-t border-border pt-12">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-display text-xl font-medium">Continue Reading</h2>
              <Link to="/writing" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 group transition-colors">
                All essays <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((r) => <RelatedCard key={r.slug} post={r} />)}
            </div>
          </div>
        </section>
      )}
    </>
  );
};

export default BlogPostPage;
