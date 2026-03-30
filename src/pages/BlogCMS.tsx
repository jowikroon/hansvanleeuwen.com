import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LayoutDashboard, FileText, PlusCircle, Image, Search, Mic, Settings,
  Languages, Target, Shield, BookCheck, Crown, ChevronRight, ChevronDown,
  ChevronLeft, X, Save, Eye, Trash2, Clock, Menu, BarChart3, Sparkles,
  ExternalLink, ArrowUpDown, Filter, Grid3X3, List, RefreshCw, Copy, Calendar,
  ClipboardList, Pen, CheckCircle2,
} from "lucide-react";

// -- Types --
interface BlogPost {
  id: string; title: string; slug: string; content: string; excerpt: string;
  category: string; tags: string[]; cover_image_url: string | null;
  published: boolean; scheduled_at: string | null; meta_title: string | null;
  meta_description: string | null; og_image: string | null; og_title: string | null;
  og_description: string | null; canonical_url: string | null; primary_keyword: string | null;
  content_nl: string | null; title_nl: string | null; excerpt_nl: string | null;
  meta_title_nl: string | null; meta_description_nl: string | null;
  status: string; author_id: string | null; created_at: string; updated_at: string;
  article_type: string | null; editorial_stage: string | null;
  brief_json: Record<string, unknown> | null; rewrite_count: number | null;
  quality_score: Record<string, QualityDimension> | null;
}
interface QualityDimension { score: number; weight: number; weighted: number; feedback: string; }
interface VoiceTemplate {
  id: string; name: string; category: string; tone: string; perspective: string;
  target_audience: string; banned_words: string[]; required_elements: string[];
  opening_examples: string[]; transition_examples: string[]; closing_examples: string[];
  content_rules: string; seo_guidelines: string; created_at: string;
}
interface BlogMemory { content_category: string; brand_voice_context: string; narrative_history: string; updated_at: string; }
interface MediaItem {
  id: string; file_name: string; storage_path: string; public_url: string;
  mime_type: string; file_size: number; alt_text: string | null; folder: string | null;
  created_at: string; updated_at: string;
}
interface AgentReview {
  agent_id: string; agent_name: string; icon: string; score: number | null;
  verdict: string; feedback: string; suggestions: string[]; loading: boolean;
}
interface HeaderImage { variant: string; label: string; url: string; alt_text: string; prompt: string; success: boolean; }
interface GhostWriterResponse {
  success: boolean; post_id: string; title: string; slug: string; draft_content: string;
  word_count: number; reading_time: string; gaps_count: number; editorial_stage: string;
  article_type: string; review_scores: { taal: number | null; ai_detect: number | null; hoofdredacteur: number | null };
  quality_breakdown: Record<string, QualityDimension>;
  brief: Record<string, unknown>; rewrite_count: number;
  seo: Record<string, unknown>; cost: { input_tokens: number; output_tokens: number; estimated_usd: number };
}

type NavSection = "dashboard" | "posts" | "new-post" | "media" | "seo" | "voice" | "settings";
type SortField = "created_at" | "title" | "status" | "updated_at";
type PostLanguage = "en" | "nl";
type ArticleType = "insight" | "practical-guide" | "comparison" | "trend-analysis" | "case-study" | "framework" | "thought-leadership";
type StylePreset = "premium-editorial" | "minimal" | "futuristic" | "abstract";

// -- Helpers --
const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const wc = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
const rt = (w: number) => `${Math.ceil(w / 230)} min read`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const charColor = (len: number, min: number, max: number) => len >= min && len <= max ? "text-emerald-400" : len > 0 ? "text-amber-400" : "text-red-400";
const scoreClr = (s: number) => s >= 80 ? "text-emerald-400" : s >= 50 ? "text-amber-400" : "text-red-400";
const scoreBg = (s: number) => s >= 80 ? "bg-emerald-500/10 border-emerald-500/20" : s >= 50 ? "bg-amber-500/10 border-amber-500/20" : "bg-red-500/10 border-red-500/20";
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  published: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  scheduled: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};
const BG = "hsl(220,18%,5%)";
const BG2 = "hsl(220,18%,8%)";
const BG3 = "hsl(220,18%,10%)";

const ARTICLE_TYPES: { value: ArticleType; label: string }[] = [
  { value: "insight", label: "Opinion/Insight" },
  { value: "practical-guide", label: "Practical Guide" },
  { value: "comparison", label: "Comparison" },
  { value: "trend-analysis", label: "Trend Analysis" },
  { value: "case-study", label: "Case Study" },
  { value: "framework", label: "Framework" },
  { value: "thought-leadership", label: "Thought Leadership" },
];

const STYLE_PRESETS: { value: StylePreset; label: string }[] = [
  { value: "premium-editorial", label: "Premium Editorial" },
  { value: "minimal", label: "Minimal" },
  { value: "futuristic", label: "Futuristic" },
  { value: "abstract", label: "Abstract" },
];

const PIPELINE_STAGES = [
  { key: "brief", label: "Brief opstellen...", icon: <ClipboardList className="w-4 h-4" /> },
  { key: "draft", label: "Concept schrijven...", icon: <Pen className="w-4 h-4" /> },
  { key: "review", label: "Redactie review...", icon: <Eye className="w-4 h-4" /> },
  { key: "polish", label: "Aanscherpen...", icon: <Sparkles className="w-4 h-4" /> },
];

const NAV_ITEMS: { key: NavSection; label: string; icon: React.ReactNode }[] = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
  { key: "posts", label: "Posts", icon: <FileText className="w-4 h-4" /> },
  { key: "new-post", label: "New Post", icon: <PlusCircle className="w-4 h-4" /> },
  { key: "media", label: "Media", icon: <Image className="w-4 h-4" /> },
  { key: "seo", label: "SEO Tools", icon: <Target className="w-4 h-4" /> },
  { key: "voice", label: "Voice & Style", icon: <Mic className="w-4 h-4" /> },
  { key: "settings", label: "Settings", icon: <Settings className="w-4 h-4" /> },
];

const AGENTS = [
  { id: "taal", name: "Taalagent", icon: "languages", prompt: "You are a language quality agent. Review grammar, spelling, readability, and natural flow." },
  { id: "structuur", name: "Structuuragent", icon: "filetext", prompt: "You are a structure agent. Evaluate heading hierarchy, paragraph flow, and content organization." },
  { id: "seo", name: "SEO-agent", icon: "target", prompt: "You are an SEO agent. Evaluate keyword usage, meta data quality, and search intent alignment." },
  { id: "ai-detect", name: "AI-detectieagent", icon: "shield", prompt: "You are an AI detection agent. Assess how human-like the writing sounds." },
  { id: "reviewer", name: "Reviewer", icon: "bookcheck", prompt: "You are a content reviewer. Evaluate factual accuracy, depth of insight, and value." },
  { id: "hoofdredacteur", name: "Hoofdredacteur", icon: "crown", prompt: "You are the chief editor. Give a final holistic assessment." },
];

const AGENT_ICONS: Record<string, React.ReactNode> = {
  languages: <Languages className="w-5 h-5" />, filetext: <FileText className="w-5 h-5" />,
  target: <Target className="w-5 h-5" />, shield: <Shield className="w-5 h-5" />,
  bookcheck: <BookCheck className="w-5 h-5" />, crown: <Crown className="w-5 h-5" />,
};

const EMPTY_POST = (): Omit<BlogPost, "id" | "created_at" | "updated_at"> => ({
  title: "", slug: "", content: "", excerpt: "", category: "e-commerce", tags: [],
  cover_image_url: null, published: false, scheduled_at: null, meta_title: null,
  meta_description: null, og_image: null, og_title: null, og_description: null,
  canonical_url: null, primary_keyword: null, content_nl: null, title_nl: null,
  excerpt_nl: null, meta_title_nl: null, meta_description_nl: null, status: "draft", author_id: null,
  article_type: "insight", editorial_stage: "draft", brief_json: null, rewrite_count: 0, quality_score: null,
});

// -- Reusable small components --
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl border border-white/[0.06] ${className}`} style={{ background: BG3 }}>{children}</div>
);
const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="text-white/40 text-xs uppercase tracking-wider mb-2 block">{children}</label>
);
const Inp = ({ value, onChange, placeholder = "", className = "" }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) => (
  <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
    className={`w-full rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/80 text-sm px-3 py-2 focus:outline-none ${className}`} />
);

// -- Quality Score Bar --
const QualityBar = ({ label, score, weight }: { label: string; score: number; weight: number }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="text-white/50 w-28 truncate">{label}</span>
    <div className="flex-1 h-2 rounded-full bg-white/[0.06] overflow-hidden">
      <div className={`h-full rounded-full transition-all ${score >= 0.8 ? "bg-emerald-500" : score >= 0.6 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${score * 100}%` }} />
    </div>
    <span className={`w-8 text-right ${score >= 0.8 ? "text-emerald-400" : score >= 0.6 ? "text-amber-400" : "text-red-400"}`}>{Math.round(score * 100)}</span>
    <span className="text-white/30 w-6 text-right">{weight}%</span>
  </div>
);

// -- Main Component --
const BlogCMS = () => {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [activeNav, setActiveNav] = useState<NavSection>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortField, setSortField] = useState<SortField>("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [selectedPosts, setSelectedPosts] = useState<Set<string>>(new Set());
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [draftPost, setDraftPost] = useState(EMPTY_POST());
  const [isNewPost, setIsNewPost] = useState(false);
  const [editorLang, setEditorLang] = useState<PostLanguage>("en");
  const [metaSidebarOpen, setMetaSidebarOpen] = useState(true);
  const [seoExpanded, setSeoExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveTimer, setAutoSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [slugManual, setSlugManual] = useState(false);
  const [reviewDrawerOpen, setReviewDrawerOpen] = useState(false);
  const [agentReviews, setAgentReviews] = useState<AgentReview[]>([]);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [voiceTemplates, setVoiceTemplates] = useState<VoiceTemplate[]>([]);
  const [blogMemory, setBlogMemory] = useState<BlogMemory[]>([]);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [loadingVoice, setLoadingVoice] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

  // Ghost writer pipeline state
  const [ghostWriterOpen, setGhostWriterOpen] = useState(false);
  const [ghostWriterRunning, setGhostWriterRunning] = useState(false);
  const [ghostWriterStage, setGhostWriterStage] = useState(0);
  const [ghostWriterArticleType, setGhostWriterArticleType] = useState<ArticleType>("insight");
  const [ghostWriterTopic, setGhostWriterTopic] = useState("");
  const [ghostWriterLang, setGhostWriterLang] = useState<PostLanguage>("nl");
  const [ghostWriterResult, setGhostWriterResult] = useState<GhostWriterResponse | null>(null);

  // Header image state
  const [headerImageLoading, setHeaderImageLoading] = useState(false);
  const [headerImages, setHeaderImages] = useState<HeaderImage[]>([]);
  const [selectedHeaderImage, setSelectedHeaderImage] = useState<number>(-1);
  const [headerStylePreset, setHeaderStylePreset] = useState<StylePreset>("premium-editorial");
  const [headerAltText, setHeaderAltText] = useState("");

  // -- Data fetching --
  const fetchPosts = useCallback(async () => {
    setLoadingPosts(true);
    try {
      const { data, error } = await supabase.from("blog_posts").select("*").order(sortField, { ascending: sortDir === "asc" });
      if (error) throw error;
      setPosts((data as unknown as BlogPost[]) ?? []);
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to load posts", variant: "destructive" });
    } finally { setLoadingPosts(false); }
  }, [sortField, sortDir, toast]);

  const fetchVoice = useCallback(async () => {
    setLoadingVoice(true);
    try {
      const { data, error } = await supabase.from("hvl_voice_templates").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setVoiceTemplates((data as unknown as VoiceTemplate[]) ?? []);
    } catch { /* empty */ } finally { setLoadingVoice(false); }
  }, []);

  const fetchMemory = useCallback(async () => {
    try {
      const { data, error } = await supabase.from("hans_blog_memory").select("*");
      if (error) throw error;
      setBlogMemory((data as unknown as BlogMemory[]) ?? []);
    } catch { /* empty */ }
  }, []);

  const fetchMedia = useCallback(async () => {
    setLoadingMedia(true);
    try {
      const { data, error } = await supabase.from("media_library").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      setMediaItems((data as unknown as MediaItem[]) ?? []);
    } catch { /* empty */ } finally { setLoadingMedia(false); }
  }, []);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);
  useEffect(() => {
    if (activeNav === "voice") { fetchVoice(); fetchMemory(); }
    if (activeNav === "media") fetchMedia();
  }, [activeNav, fetchVoice, fetchMemory, fetchMedia]);

  // -- CRUD --
  const savePost = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        title: draftPost.title, slug: draftPost.slug, content: draftPost.content,
        excerpt: draftPost.excerpt, category: draftPost.category, tags: draftPost.tags,
        cover_image_url: draftPost.cover_image_url, published: draftPost.status === "published",
        scheduled_at: draftPost.scheduled_at, meta_title: draftPost.meta_title,
        meta_description: draftPost.meta_description, og_image: draftPost.og_image,
        og_title: draftPost.og_title, og_description: draftPost.og_description,
        canonical_url: draftPost.canonical_url, primary_keyword: draftPost.primary_keyword,
        content_nl: draftPost.content_nl, title_nl: draftPost.title_nl, excerpt_nl: draftPost.excerpt_nl,
        meta_title_nl: draftPost.meta_title_nl, meta_description_nl: draftPost.meta_description_nl,
        status: draftPost.status, author_id: user?.id ?? null,
      };
      if (editingPost) {
        const { error } = await supabase.from("blog_posts").update(payload).eq("id", editingPost.id);
        if (error) throw error;
        toast({ title: "Saved", description: "Post updated." });
      } else {
        const { error } = await supabase.from("blog_posts").insert(payload);
        if (error) throw error;
        toast({ title: "Created", description: "New post created." });
        setIsNewPost(false);
      }
      setLastSaved(new Date().toISOString());
      await fetchPosts();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  }, [draftPost, editingPost, user, toast, fetchPosts]);

  const deletePost = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("blog_posts").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Deleted", description: "Post removed." });
      if (editingPost?.id === id) { setEditingPost(null); setActiveNav("posts"); }
      await fetchPosts();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Delete failed", variant: "destructive" });
    }
  }, [editingPost, toast, fetchPosts]);

  const bulkAction = useCallback(async (action: "publish" | "unpublish" | "delete") => {
    const ids = Array.from(selectedPosts);
    if (!ids.length) return;
    try {
      if (action === "delete") {
        const { error } = await supabase.from("blog_posts").delete().in("id", ids);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("blog_posts").update({ status: action === "publish" ? "published" : "draft", published: action === "publish" }).in("id", ids);
        if (error) throw error;
      }
      setSelectedPosts(new Set());
      toast({ title: "Done", description: `${action} applied to ${ids.length} posts.` });
      await fetchPosts();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Bulk action failed", variant: "destructive" });
    }
  }, [selectedPosts, toast, fetchPosts]);

  // -- Editor helpers --
  const openEditor = (post: BlogPost) => {
    setEditingPost(post);
    setDraftPost({ title: post.title, slug: post.slug, content: post.content, excerpt: post.excerpt,
      category: post.category, tags: post.tags ?? [], cover_image_url: post.cover_image_url,
      published: post.published, scheduled_at: post.scheduled_at, meta_title: post.meta_title,
      meta_description: post.meta_description, og_image: post.og_image, og_title: post.og_title,
      og_description: post.og_description, canonical_url: post.canonical_url,
      primary_keyword: post.primary_keyword, content_nl: post.content_nl, title_nl: post.title_nl,
      excerpt_nl: post.excerpt_nl, meta_title_nl: post.meta_title_nl,
      meta_description_nl: post.meta_description_nl, status: post.status, author_id: post.author_id,
      article_type: post.article_type, editorial_stage: post.editorial_stage,
      brief_json: post.brief_json, rewrite_count: post.rewrite_count, quality_score: post.quality_score,
    });
    setIsNewPost(false); setSlugManual(true); setActiveNav("new-post");
    setHeaderImages([]); setSelectedHeaderImage(-1);
  };

  const startNewPost = () => { setEditingPost(null); setDraftPost(EMPTY_POST()); setIsNewPost(true); setSlugManual(false); setActiveNav("new-post"); setHeaderImages([]); setSelectedHeaderImage(-1); };

  const updateDraft = (field: string, value: unknown) => {
    setDraftPost((prev) => ({ ...prev, [field]: value }));
    if (field === "title" && !slugManual) setDraftPost((prev) => ({ ...prev, slug: slugify(value as string) }));
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    const timer = setTimeout(() => { if (editingPost) savePost(); }, 3000);
    setAutoSaveTimer(timer);
  };

  // -- Ghost Writer 4-Stage Pipeline --
  const runGhostWriter = useCallback(async () => {
    if (!ghostWriterTopic.trim()) return;
    setGhostWriterRunning(true);
    setGhostWriterStage(1);
    setGhostWriterResult(null);

    try {
      // Simulate stage progression with polling
      const stageTimer1 = setTimeout(() => setGhostWriterStage(2), 4000);
      const stageTimer2 = setTimeout(() => setGhostWriterStage(3), 12000);
      const stageTimer3 = setTimeout(() => setGhostWriterStage(4), 25000);

      const res = await fetch("https://n8n.srv1402218.hstgr.cloud/webhook/blog-ghost-write", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ghostWriterTopic,
          primary_keyword: ghostWriterTopic.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim(),
          category: "professional",
          language: ghostWriterLang,
          article_type: ghostWriterArticleType,
        }),
      });

      clearTimeout(stageTimer1);
      clearTimeout(stageTimer2);
      clearTimeout(stageTimer3);

      const data = (await res.json()) as GhostWriterResponse;
      setGhostWriterResult(data);
      setGhostWriterStage(5); // complete

      if (data.success) {
        // Load the draft into the editor
        setDraftPost((prev) => ({
          ...prev,
          title: data.title || ghostWriterTopic,
          title_nl: data.title || ghostWriterTopic,
          slug: data.slug || slugify(ghostWriterTopic),
          content: data.draft_content || "",
          content_nl: data.draft_content || "",
          primary_keyword: ghostWriterTopic.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim(),
          article_type: data.article_type || ghostWriterArticleType,
          editorial_stage: data.editorial_stage || "drafted",
          quality_score: data.quality_breakdown ? data.quality_breakdown as unknown as Record<string, QualityDimension> : null,
          rewrite_count: data.rewrite_count || 0,
          brief_json: data.brief ? data.brief as Record<string, unknown> : null,
        }));
        setIsNewPost(false);
        toast({ title: "Draft generated", description: `${data.word_count || 0} words, stage: ${data.editorial_stage || "drafted"}` });

        // Reload posts to get the saved one
        await fetchPosts();
      }
    } catch (err: unknown) {
      toast({ title: "Ghost writer failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setGhostWriterRunning(false);
    }
  }, [ghostWriterTopic, ghostWriterLang, ghostWriterArticleType, toast, fetchPosts]);

  // -- Header Image Generation --
  const generateHeaderImages = useCallback(async () => {
    setHeaderImageLoading(true);
    setHeaderImages([]);
    setSelectedHeaderImage(-1);
    try {
      const res = await fetch("https://n8n.srv1402218.hstgr.cloud/webhook/blog-header-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_id: editingPost?.id || "draft",
          title: draftPost.title || "Untitled",
          summary: (draftPost.excerpt || draftPost.content || "").substring(0, 200),
          category: draftPost.category || "professional",
          tone: "premium editorial",
          style_preset: headerStylePreset,
          count: 3,
        }),
      });
      const data = (await res.json()) as { success: boolean; images: HeaderImage[] };
      if (data.success && data.images) {
        setHeaderImages(data.images);
        toast({ title: "Images generated", description: `${data.images.filter(i => i.success).length} header images ready.` });
      }
    } catch (err: unknown) {
      toast({ title: "Image generation failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally { setHeaderImageLoading(false); }
  }, [editingPost, draftPost, headerStylePreset, toast]);

  const selectHeaderImage = (index: number) => {
    setSelectedHeaderImage(index);
    const img = headerImages[index];
    if (img) {
      setHeaderAltText(img.alt_text || "");
      updateDraft("cover_image_url", img.url);
    }
  };

  // -- AI Reviews --
  const runAgentReview = useCallback(async (agent: (typeof AGENTS)[number]) => {
    setAgentReviews((prev) => prev.map((r) => r.agent_id === agent.id ? { ...r, loading: true } : r));
    try {
      const res = await fetch("https://n8n.srv1402218.hstgr.cloud/webhook/blog-agent-review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agent.id, agent_system_prompt: agent.prompt, post_title: draftPost.title, post_content: draftPost.content, post_category: draftPost.category, post_keyword: draftPost.primary_keyword ?? "", post_language: editorLang }),
      });
      const data = (await res.json()) as Record<string, unknown>;
      setAgentReviews((prev) => prev.map((r) => r.agent_id === agent.id ? { ...r,
        score: typeof data.score === "number" ? data.score : null,
        verdict: typeof data.verdict === "string" ? data.verdict : "",
        feedback: typeof data.feedback === "string" ? data.feedback : "",
        suggestions: Array.isArray(data.suggestions) ? (data.suggestions as string[]) : [], loading: false,
      } : r));
    } catch { setAgentReviews((prev) => prev.map((r) => r.agent_id === agent.id ? { ...r, loading: false, feedback: "Review failed." } : r)); }
  }, [draftPost, editorLang]);

  const runAllReviews = useCallback(() => {
    const init: AgentReview[] = AGENTS.map((a) => ({ agent_id: a.id, agent_name: a.name, icon: a.icon, score: null, verdict: "", feedback: "", suggestions: [], loading: true }));
    setAgentReviews(init); setReviewDrawerOpen(true);
    AGENTS.forEach((a) => runAgentReview(a));
  }, [runAgentReview]);

  // -- Derived --
  const filtered = posts
    .filter((p) => (statusFilter === "all" || p.status === statusFilter) && (categoryFilter === "all" || p.category === categoryFilter) && (!searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase())))
    .sort((a, b) => { const av = a[sortField] ?? ""; const bv = b[sortField] ?? ""; return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av)); });
  const categories = [...new Set(posts.map((p) => p.category).filter(Boolean))];
  const stats = { draft: posts.filter((p) => p.status === "draft").length, published: posts.filter((p) => p.status === "published").length, scheduled: posts.filter((p) => p.status === "scheduled" || p.scheduled_at).length, total: posts.length };
  const curTitle = editorLang === "nl" ? draftPost.title_nl ?? "" : draftPost.title;
  const curContent = editorLang === "nl" ? draftPost.content_nl ?? "" : draftPost.content;
  const curExcerpt = editorLang === "nl" ? draftPost.excerpt_nl ?? "" : draftPost.excerpt;
  const curMetaTitle = editorLang === "nl" ? draftPost.meta_title_nl ?? "" : draftPost.meta_title ?? "";
  const curMetaDesc = editorLang === "nl" ? draftPost.meta_description_nl ?? "" : draftPost.meta_description ?? "";
  const words = wc(curContent);

  // -- Auth guard --
  if (authLoading) return <div className="pt-20 min-h-screen flex items-center justify-center" style={{ background: BG }}><div className="text-white/60 text-lg">Loading...</div></div>;
  if (!user) return <div className="pt-20 min-h-screen flex items-center justify-center" style={{ background: BG }}><div className="text-white/60 text-lg">Please sign in to access the CMS.</div></div>;

  // -- Sidebar --
  const navBtn = (item: (typeof NAV_ITEMS)[number], onClick: () => void) => (
    <button key={item.key} onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${activeNav === item.key ? "text-blue-400 bg-blue-500/10 border-r-2 border-blue-400" : "text-white/60 hover:text-white/90 hover:bg-white/[0.04]"}`}>
      {item.icon}{sidebarOpen && <span>{item.label}</span>}
    </button>
  );

  // -- Ghost Writer Modal --
  const renderGhostWriterModal = () => (
    <AnimatePresence>{ghostWriterOpen && (<>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/70" onClick={() => { if (!ghostWriterRunning) setGhostWriterOpen(false); }} />
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg rounded-2xl border border-white/[0.08] p-6 space-y-5" style={{ background: BG2 }}>
          {!ghostWriterRunning && ghostWriterStage < 5 && (<>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white/90">Ghost Writer</h2>
              <button onClick={() => setGhostWriterOpen(false)} className="text-white/40 hover:text-white/80"><X className="w-5 h-5" /></button>
            </div>
            <div>
              <Label>Onderwerp of URL</Label>
              <Inp value={ghostWriterTopic} onChange={setGhostWriterTopic} placeholder="Retourpercentage verlagen..." />
            </div>
            <div>
              <Label>Taal</Label>
              <div className="flex gap-2">
                {(["nl", "en"] as const).map(l => (
                  <button key={l} onClick={() => setGhostWriterLang(l)} className={`px-4 py-2 rounded-lg text-sm ${ghostWriterLang === l ? "bg-blue-600 text-white" : "bg-white/[0.04] text-white/60 border border-white/[0.06]"}`}>
                    {l === "nl" ? "Nederlands" : "English"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Artikeltype</Label>
              <div className="grid grid-cols-2 gap-2">
                {ARTICLE_TYPES.map(t => (
                  <button key={t.value} onClick={() => setGhostWriterArticleType(t.value)}
                    className={`px-3 py-2 rounded-lg text-xs text-left ${ghostWriterArticleType === t.value ? "bg-blue-600/20 text-blue-400 border border-blue-500/30" : "bg-white/[0.04] text-white/60 border border-white/[0.06]"}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={() => { setGhostWriterOpen(false); startNewPost(); }} variant="ghost" className="text-white/60">Handmatig schrijven</Button>
              <Button onClick={runGhostWriter} disabled={!ghostWriterTopic.trim()} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white">
                <Sparkles className="w-4 h-4 mr-2" /> Genereer
              </Button>
            </div>
          </>)}

          {(ghostWriterRunning || ghostWriterStage >= 1) && ghostWriterStage < 5 && (
            <div className="space-y-4 py-4">
              <h2 className="text-lg font-semibold text-white/90 text-center">Pipeline actief</h2>
              <div className="space-y-3">
                {PIPELINE_STAGES.map((s, i) => {
                  const stageNum = i + 1;
                  const isActive = ghostWriterStage === stageNum;
                  const isComplete = ghostWriterStage > stageNum;
                  const isHidden = stageNum === 4 && ghostWriterStage < 4;
                  if (isHidden) return null;
                  return (
                    <div key={s.key} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${isActive ? "border-blue-500/40 bg-blue-500/10" : isComplete ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/[0.06] bg-white/[0.02]"}`}>
                      <div className={`${isActive ? "text-blue-400 animate-pulse" : isComplete ? "text-emerald-400" : "text-white/20"}`}>
                        {isComplete ? <CheckCircle2 className="w-4 h-4" /> : s.icon}
                      </div>
                      <span className={`text-sm ${isActive ? "text-blue-400" : isComplete ? "text-emerald-400" : "text-white/30"}`}>{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {ghostWriterStage === 5 && ghostWriterResult && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white/90">Gereed</h2>
                <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{ghostWriterResult.editorial_stage}</Badge>
              </div>
              {ghostWriterResult.review_scores && (
                <div className="grid grid-cols-3 gap-3">
                  {[["Taal", ghostWriterResult.review_scores.taal], ["AI-detect", ghostWriterResult.review_scores.ai_detect], ["Hoofdredacteur", ghostWriterResult.review_scores.hoofdredacteur]].map(([label, score]) => (
                    <div key={label as string} className="text-center">
                      <div className={`text-2xl font-bold ${typeof score === "number" ? scoreClr(score) : "text-white/30"}`}>{typeof score === "number" ? score : "-"}</div>
                      <div className="text-white/40 text-xs">{label as string}</div>
                    </div>
                  ))}
                </div>
              )}
              {ghostWriterResult.cost && (
                <div className="text-white/30 text-xs text-center">{ghostWriterResult.cost.input_tokens + ghostWriterResult.cost.output_tokens} tokens, ${ghostWriterResult.cost.estimated_usd.toFixed(4)}</div>
              )}
              <Button onClick={() => { setGhostWriterOpen(false); setGhostWriterStage(0); setActiveNav("new-post"); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white">Open in editor</Button>
            </div>
          )}
        </div>
      </motion.div>
    </>)}</AnimatePresence>
  );

  // -- Metadata panel --
  const metaPanel = () => (
    <div className="p-5 space-y-4">
      <div><Label>Status</Label><select value={draftPost.status} onChange={(e) => updateDraft("status", e.target.value)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/80 text-sm px-3 py-2 focus:outline-none"><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option></select></div>
      {draftPost.status === "scheduled" && <div><Label>Schedule Date</Label><input type="datetime-local" value={draftPost.scheduled_at ?? ""} onChange={(e) => updateDraft("scheduled_at", e.target.value || null)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/80 text-sm px-3 py-2 focus:outline-none" /></div>}
      <div><Label>Category</Label><Inp value={draftPost.category} onChange={(v) => updateDraft("category", v)} placeholder="e-commerce" /></div>
      <div>
        <Label>Tags (comma-separated)</Label>
        <Inp value={draftPost.tags?.join(", ") ?? ""} onChange={(v) => updateDraft("tags", v.split(",").map((t) => t.trim()).filter(Boolean))} placeholder="seo, marketing" />
        {draftPost.tags?.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{draftPost.tags.map((t) => <Badge key={t} className="bg-white/[0.06] text-white/60 text-xs">{t}</Badge>)}</div>}
      </div>
      <div>
        <Label>Cover Image URL</Label>
        <Inp value={draftPost.cover_image_url ?? ""} onChange={(v) => updateDraft("cover_image_url", v || null)} placeholder="https://..." />
        {draftPost.cover_image_url && <img src={draftPost.cover_image_url} alt="Cover" className="mt-2 rounded-lg max-h-32 w-full object-cover" />}
      </div>
      <div><Label>Voice Template</Label><select className="w-full rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/80 text-sm px-3 py-2 focus:outline-none" defaultValue=""><option value="">None</option>{voiceTemplates.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
      <div className="border border-white/[0.06] rounded-lg overflow-hidden">
        <button onClick={() => setSeoExpanded(!seoExpanded)} className="w-full flex items-center justify-between px-4 py-3 text-white/60 text-sm hover:bg-white/[0.02]">
          <span className="flex items-center gap-2"><Target className="w-4 h-4" /> SEO Settings</span>
          {seoExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {seoExpanded && (
          <div className="px-4 pb-4 space-y-3">
            <div><label className="text-white/30 text-xs mb-1 block">Primary Keyword</label><Inp value={draftPost.primary_keyword ?? ""} onChange={(v) => updateDraft("primary_keyword", v || null)} /></div>
            <div><div className="flex justify-between"><label className="text-white/30 text-xs mb-1">Meta Title</label><span className={`text-xs ${charColor(curMetaTitle.length, 50, 60)}`}>{curMetaTitle.length}/60</span></div><Inp value={curMetaTitle} onChange={(v) => updateDraft(editorLang === "nl" ? "meta_title_nl" : "meta_title", v || null)} /></div>
            <div><div className="flex justify-between"><label className="text-white/30 text-xs mb-1">Meta Description</label><span className={`text-xs ${charColor(curMetaDesc.length, 120, 160)}`}>{curMetaDesc.length}/160</span></div><textarea value={curMetaDesc} onChange={(e) => updateDraft(editorLang === "nl" ? "meta_description_nl" : "meta_description", e.target.value || null)} rows={3} className="w-full rounded border border-white/[0.06] bg-white/[0.04] text-white/80 text-sm px-2 py-1.5 focus:outline-none resize-none" /></div>
            <div className="rounded-lg p-3 bg-white/[0.02] border border-white/[0.04]">
              <div className="text-xs text-white/30 mb-2">Google Preview</div>
              <div className="text-blue-400 text-sm truncate">{curMetaTitle || curTitle || "Page title"}</div>
              <div className="text-emerald-500 text-xs truncate">hansvanleeuwen.com/{draftPost.slug || "post-slug"}</div>
              <div className="text-white/50 text-xs line-clamp-2 mt-1">{curMetaDesc || curExcerpt || "Description..."}</div>
            </div>
            <div><label className="text-white/30 text-xs mb-1 block">Canonical URL</label><Inp value={draftPost.canonical_url ?? ""} onChange={(v) => updateDraft("canonical_url", v || null)} /></div>
          </div>
        )}
      </div>
      <div><Label>OG Title</Label><Inp value={draftPost.og_title ?? ""} onChange={(v) => updateDraft("og_title", v || null)} /></div>
      <div><Label>OG Description</Label><textarea value={draftPost.og_description ?? ""} onChange={(e) => updateDraft("og_description", e.target.value || null)} rows={2} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/80 text-sm px-3 py-2 focus:outline-none resize-none" /></div>
      <div className="flex gap-2 pt-2">
        <Button onClick={savePost} disabled={saving} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" size="sm">
          {draftPost.status === "published" ? <><Eye className="w-4 h-4 mr-1" /> Publish</> : <><Save className="w-4 h-4 mr-1" /> Save Draft</>}
        </Button>
        {editingPost && <Button variant="ghost" size="sm" className="text-red-400" onClick={() => deletePost(editingPost.id)}><Trash2 className="w-4 h-4" /></Button>}
      </div>
    </div>
  );

  // -- View renderers --
  const renderDashboard = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white/90">Dashboard</h1>
        <div className="flex gap-2">
          <Button onClick={() => { setGhostWriterOpen(true); setGhostWriterStage(0); setGhostWriterResult(null); }} className="bg-purple-600 hover:bg-purple-700 text-white"><Sparkles className="w-4 h-4 mr-2" /> Ghost Writer</Button>
          <Button onClick={startNewPost} className="bg-blue-600 hover:bg-blue-700 text-white"><PlusCircle className="w-4 h-4 mr-2" /> New Post</Button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([["Total", stats.total, "text-white/90"], ["Published", stats.published, "text-emerald-400"], ["Drafts", stats.draft, "text-zinc-400"], ["Scheduled", stats.scheduled, "text-blue-400"]] as const).map(([l, v, c]) => (
          <Card key={l} className="p-5"><div className={`text-3xl font-bold ${c}`}>{v}</div><div className="text-white/40 text-sm mt-1">{l}</div></Card>
        ))}
      </div>
      <div><h2 className="text-lg font-semibold text-white/80 mb-3">Recent Drafts</h2>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {posts.filter((p) => p.status === "draft").slice(0, 6).map((p) => (
            <button key={p.id} onClick={() => openEditor(p)} className="text-left rounded-xl border border-white/[0.06] p-4 hover:border-white/[0.12] transition-colors" style={{ background: BG3 }}>
              <div className="text-white/90 font-medium truncate">{p.title || "Untitled"}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-white/40 text-sm">{fmtDate(p.updated_at)}</span>
                {p.editorial_stage && <Badge className="bg-blue-500/10 text-blue-400 text-xs border-blue-500/20">{p.editorial_stage}</Badge>}
              </div>
              <div className="text-white/30 text-xs mt-2 line-clamp-2">{p.excerpt}</div>
            </button>
          ))}
        </div>
        {posts.filter((p) => p.status === "draft").length === 0 && <div className="text-white/30 text-sm">No drafts yet.</div>}
      </div>
      <div><h2 className="text-lg font-semibold text-white/80 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" /> Editorial Calendar</h2>
        <div className="space-y-2">
          {posts.filter((p) => p.scheduled_at).sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? "")).slice(0, 5).map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg border border-white/[0.06] px-4 py-3" style={{ background: BG3 }}>
              <div><div className="text-white/90 text-sm font-medium">{p.title}</div><div className="text-white/40 text-xs">{p.category}</div></div>
              <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">{p.scheduled_at ? fmtDate(p.scheduled_at) : ""}</Badge>
            </div>
          ))}
          {!posts.some((p) => p.scheduled_at) && <div className="text-white/30 text-sm">No scheduled posts.</div>}
        </div>
      </div>
    </div>
  );

  const renderPostsList = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3"><h1 className="text-2xl font-bold text-white/90">Posts</h1><Button onClick={startNewPost} className="bg-blue-600 hover:bg-blue-700 text-white"><PlusCircle className="w-4 h-4 mr-2" /> New Post</Button></div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" /><input type="text" placeholder="Search posts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/90 text-sm placeholder:text-white/30 focus:outline-none focus:border-blue-500/40" /></div>
        <div className="flex items-center gap-2"><Filter className="w-4 h-4 text-white/30" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/80 text-sm px-3 py-2 focus:outline-none"><option value="all">All status</option><option value="draft">Draft</option><option value="published">Published</option><option value="scheduled">Scheduled</option></select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/80 text-sm px-3 py-2 focus:outline-none"><option value="all">All categories</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={() => setViewMode("table")} className={`p-2 rounded ${viewMode === "table" ? "bg-white/10 text-white" : "text-white/30"}`}><List className="w-4 h-4" /></button>
          <button onClick={() => setViewMode("card")} className={`p-2 rounded ${viewMode === "card" ? "bg-white/10 text-white" : "text-white/30"}`}><Grid3X3 className="w-4 h-4" /></button>
        </div>
      </div>
      {selectedPosts.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <span className="text-blue-400 text-sm">{selectedPosts.size} selected</span>
          <Button size="sm" variant="ghost" className="text-emerald-400 text-xs" onClick={() => bulkAction("publish")}>Publish</Button>
          <Button size="sm" variant="ghost" className="text-zinc-400 text-xs" onClick={() => bulkAction("unpublish")}>Unpublish</Button>
          <Button size="sm" variant="ghost" className="text-red-400 text-xs" onClick={() => bulkAction("delete")}>Delete</Button>
          <Button size="sm" variant="ghost" className="text-white/40 text-xs ml-auto" onClick={() => setSelectedPosts(new Set())}>Clear</Button>
        </div>
      )}
      {loadingPosts && <div className="text-white/40 text-sm py-8 text-center">Loading posts...</div>}
      {!loadingPosts && viewMode === "table" && (
        <div className="rounded-xl border border-white/[0.06] overflow-hidden" style={{ background: BG3 }}>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.06]">
              <th className="px-4 py-3 text-left w-8"><input type="checkbox" checked={selectedPosts.size === filtered.length && filtered.length > 0} onChange={(e) => setSelectedPosts(e.target.checked ? new Set(filtered.map((p) => p.id)) : new Set())} className="accent-blue-500" /></th>
              <th className="px-4 py-3 text-left text-white/40 font-medium"><button className="flex items-center gap-1 hover:text-white/70" onClick={() => { setSortField("title"); setSortDir(sortField === "title" && sortDir === "asc" ? "desc" : "asc"); }}>Title <ArrowUpDown className="w-3 h-3" /></button></th>
              <th className="px-4 py-3 text-left text-white/40 font-medium hidden md:table-cell">Status</th>
              <th className="px-4 py-3 text-left text-white/40 font-medium hidden lg:table-cell">Category</th>
              <th className="px-4 py-3 text-left text-white/40 font-medium hidden lg:table-cell">Words</th>
              <th className="px-4 py-3 text-left text-white/40 font-medium"><button className="flex items-center gap-1 hover:text-white/70" onClick={() => { setSortField("updated_at"); setSortDir(sortField === "updated_at" && sortDir === "desc" ? "asc" : "desc"); }}>Date <ArrowUpDown className="w-3 h-3" /></button></th>
              <th className="px-4 py-3 w-12"></th>
            </tr></thead>
            <tbody>{filtered.map((p) => (
              <tr key={p.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors cursor-pointer" onClick={() => openEditor(p)}>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedPosts.has(p.id)} onChange={(e) => { const n = new Set(selectedPosts); if (e.target.checked) n.add(p.id); else n.delete(p.id); setSelectedPosts(n); }} className="accent-blue-500" /></td>
                <td className="px-4 py-3 text-white/90 font-medium">{p.title || "Untitled"}</td>
                <td className="px-4 py-3 hidden md:table-cell"><Badge className={STATUS_COLORS[p.status] ?? STATUS_COLORS.draft}>{p.status}</Badge></td>
                <td className="px-4 py-3 text-white/50 hidden lg:table-cell">{p.category}</td>
                <td className="px-4 py-3 text-white/40 hidden lg:table-cell">{wc(p.content)}</td>
                <td className="px-4 py-3 text-white/40">{fmtDate(p.updated_at)}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><button onClick={() => deletePost(p.id)} className="text-white/20 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /></button></td>
              </tr>
            ))}</tbody>
          </table>
          {filtered.length === 0 && <div className="text-white/30 text-sm py-8 text-center">No posts found.</div>}
        </div>
      )}
      {!loadingPosts && viewMode === "card" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-white/[0.06] p-5 cursor-pointer hover:border-white/[0.12] transition-colors" style={{ background: BG3 }} onClick={() => openEditor(p)}>
              <div className="flex items-start justify-between mb-2"><Badge className={STATUS_COLORS[p.status] ?? STATUS_COLORS.draft}>{p.status}</Badge><span className="text-white/30 text-xs">{fmtDate(p.updated_at)}</span></div>
              <h3 className="text-white/90 font-medium mb-1">{p.title || "Untitled"}</h3>
              <p className="text-white/40 text-sm line-clamp-2">{p.excerpt}</p>
              <div className="flex items-center gap-3 mt-3 text-white/30 text-xs"><span>{p.category}</span><span>{wc(p.content)} words</span></div>
            </motion.div>
          ))}
          {filtered.length === 0 && <div className="col-span-full text-white/30 text-sm py-8 text-center">No posts found.</div>}
        </div>
      )}
    </div>
  );

  // -- Header Image Studio --
  const renderHeaderImageStudio = () => (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-white/80 font-medium flex items-center gap-2"><Image className="w-4 h-4 text-purple-400" /> Header Image Studio</h3>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Label>Style Preset</Label>
          <select value={headerStylePreset} onChange={(e) => setHeaderStylePreset(e.target.value as StylePreset)} className="w-full rounded-lg border border-white/[0.06] bg-white/[0.04] text-white/80 text-sm px-3 py-2 focus:outline-none">
            {STYLE_PRESETS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div className="pt-5">
          <Button onClick={generateHeaderImages} disabled={headerImageLoading} className="bg-purple-600 hover:bg-purple-700 text-white" size="sm">
            {headerImageLoading ? <><RefreshCw className="w-4 h-4 mr-1 animate-spin" /> Generating...</> : <><Image className="w-4 h-4 mr-1" /> Generate</>}
          </Button>
        </div>
      </div>
      {headerImages.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {headerImages.map((img, i) => (
            <button key={i} onClick={() => selectHeaderImage(i)} className={`rounded-xl overflow-hidden border-2 transition-all ${selectedHeaderImage === i ? "border-blue-500 ring-2 ring-blue-500/20" : "border-white/[0.06] hover:border-white/[0.12]"}`}>
              {img.success && img.url ? (
                <img src={img.url} alt={img.alt_text} className="w-full h-24 object-cover" />
              ) : (
                <div className="w-full h-24 flex items-center justify-center bg-white/[0.02] text-white/20 text-xs">Failed</div>
              )}
              <div className="p-2 text-xs text-white/50 text-center">{img.label}</div>
            </button>
          ))}
        </div>
      )}
      {selectedHeaderImage >= 0 && headerImages[selectedHeaderImage] && (
        <div>
          <Label>Alt Text</Label>
          <Inp value={headerAltText} onChange={(v) => setHeaderAltText(v)} placeholder="Describe the image..." />
        </div>
      )}
    </Card>
  );

  // -- Quality Score Display --
  const renderQualityScore = () => {
    const qs = draftPost.quality_score;
    if (!qs || Object.keys(qs).length === 0) return null;
    const dimensions = [
      ["titel", "Titelkracht", 8], ["intro", "Intro en hook", 8], ["structuur", "Structuur", 12],
      ["leesbaarheid", "Leesbaarheid", 10], ["taalkwaliteit", "Taalkwaliteit", 12], ["toon", "Toon", 8],
      ["helderheid", "Helderheid", 10], ["diepgang", "Diepgang", 10], ["consistentie", "Consistentie", 6],
      ["overtuigingskracht", "Overtuigingskracht", 6], ["toepasbaarheid", "Toepasbaarheid", 5], ["afsluiting", "Afsluiting", 5],
    ] as const;
    const totalWeighted = dimensions.reduce((sum, [key, , weight]) => {
      const dim = qs[key];
      return sum + (dim ? dim.score * weight : 0);
    }, 0);
    const isPublishReady = totalWeighted >= 75;

    return (
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-white/80 font-medium flex items-center gap-2"><BarChart3 className="w-4 h-4 text-blue-400" /> Quality Score</h3>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${totalWeighted >= 75 ? "text-emerald-400" : totalWeighted >= 60 ? "text-amber-400" : "text-red-400"}`}>{Math.round(totalWeighted)}</span>
            <Badge className={isPublishReady ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}>
              {isPublishReady ? "Publish ready" : "Needs work"}
            </Badge>
          </div>
        </div>
        <div className="space-y-2">
          {dimensions.map(([key, label, weight]) => {
            const dim = qs[key];
            return <QualityBar key={key} label={label} score={dim ? dim.score : 0} weight={weight} />;
          })}
        </div>
      </Card>
    );
  };

  const renderEditor = () => (
    <div className="flex flex-col lg:flex-row gap-0 h-full">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveNav("posts")} className="text-white/40 hover:text-white/80"><ChevronLeft className="w-5 h-5" /></button>
            <h1 className="text-xl font-bold text-white/90">{isNewPost ? "New Post" : "Edit Post"}</h1>
            {lastSaved && <span className="text-white/30 text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Saved {new Date(lastSaved).toLocaleTimeString()}</span>}
            {draftPost.editorial_stage && <Badge className="bg-blue-500/10 text-blue-400 text-xs border-blue-500/20">{draftPost.editorial_stage}</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="text-white/60" onClick={() => setReviewDrawerOpen(true)}><Sparkles className="w-4 h-4 mr-1" /> AI Review</Button>
            <Button variant="ghost" size="sm" className="text-white/60 hidden lg:flex" onClick={() => setMetaSidebarOpen(!metaSidebarOpen)}><Settings className="w-4 h-4" /></Button>
            <Button onClick={savePost} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white" size="sm"><Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
        <Tabs value={editorLang} onValueChange={(v) => setEditorLang(v as PostLanguage)}>
          <TabsList className="bg-white/[0.04] border border-white/[0.06]">
            <TabsTrigger value="en" className="text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">English</TabsTrigger>
            <TabsTrigger value="nl" className="text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">Nederlands</TabsTrigger>
          </TabsList>
        </Tabs>
        <input type="text" placeholder="Post title..." value={curTitle} onChange={(e) => updateDraft(editorLang === "nl" ? "title_nl" : "title", e.target.value)} className="w-full text-3xl font-bold bg-transparent border-none outline-none text-white/90 placeholder:text-white/20" />
        <div className="flex items-center gap-2 text-sm">
          <span className="text-white/30">Slug:</span>
          <input type="text" value={draftPost.slug} onChange={(e) => { setSlugManual(true); updateDraft("slug", e.target.value); }} className="flex-1 bg-transparent border-b border-white/[0.06] text-white/60 text-sm outline-none focus:border-blue-500/40 py-1" />
          <button onClick={() => { setSlugManual(false); updateDraft("slug", slugify(draftPost.title)); }} className="text-white/30 hover:text-white/60" title="Regenerate"><RefreshCw className="w-3 h-3" /></button>
        </div>
        <div className="relative">
          <textarea ref={contentRef} placeholder="Write your content in markdown..." value={curContent} onChange={(e) => updateDraft(editorLang === "nl" ? "content_nl" : "content", e.target.value)} className="w-full min-h-[400px] lg:min-h-[500px] rounded-xl border border-white/[0.06] p-6 text-white/90 text-sm leading-relaxed placeholder:text-white/20 focus:outline-none focus:border-blue-500/20 font-mono resize-y" style={{ background: BG2 }} />
          <div className="absolute bottom-3 right-4 flex items-center gap-4 text-white/30 text-xs"><span>{words} words</span><span>{rt(words)}</span></div>
        </div>
        <div><label className="text-white/40 text-sm mb-1 block">Excerpt</label><textarea placeholder="Brief summary..." value={curExcerpt} onChange={(e) => updateDraft(editorLang === "nl" ? "excerpt_nl" : "excerpt", e.target.value)} rows={3} className="w-full rounded-lg border border-white/[0.06] p-3 text-white/80 text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/20 resize-y" style={{ background: BG2 }} /></div>
        {renderHeaderImageStudio()}
        {renderQualityScore()}
      </div>
      <AnimatePresence>{metaSidebarOpen && (
        <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 320, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="hidden lg:block border-l border-white/[0.06] overflow-y-auto flex-shrink-0" style={{ background: BG2 }}>{metaPanel()}</motion.div>
      )}</AnimatePresence>
      <div className="lg:hidden border-t border-white/[0.06] pt-4">
        <button onClick={() => setMetaSidebarOpen(!metaSidebarOpen)} className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-white/[0.06] text-white/60 text-sm" style={{ background: BG3 }}>
          <span>Post Settings & SEO</span>{metaSidebarOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        {metaSidebarOpen && <Card className="mt-2">{metaPanel()}</Card>}
      </div>
    </div>
  );

  const renderReviewDrawer = () => (
    <AnimatePresence>{reviewDrawerOpen && (<>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/50" onClick={() => setReviewDrawerOpen(false)} />
      <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 25 }} className="fixed top-16 right-0 z-50 w-full max-w-md h-[calc(100vh-64px)] border-l border-white/[0.06] overflow-y-auto" style={{ background: BG2 }}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-semibold text-white/90 flex items-center gap-2"><Sparkles className="w-5 h-5 text-blue-400" /> AI Review Panel</h2><button onClick={() => setReviewDrawerOpen(false)} className="text-white/40 hover:text-white/80"><X className="w-5 h-5" /></button></div>
          <Button onClick={runAllReviews} className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-5"><RefreshCw className="w-4 h-4 mr-2" /> Run All Reviews</Button>
          <div className="space-y-3">
            {(agentReviews.length > 0 ? agentReviews : AGENTS.map((a) => ({ agent_id: a.id, agent_name: a.name, icon: a.icon, score: null, verdict: "", feedback: "", suggestions: [], loading: false }))).map((r) => (
              <div key={r.agent_id} className={`rounded-xl border ${r.score !== null ? scoreBg(r.score) : "border-white/[0.06]"} overflow-hidden`} style={r.score === null ? { background: BG3 } : undefined}>
                <button onClick={() => setExpandedAgent(expandedAgent === r.agent_id ? null : r.agent_id)} className="w-full flex items-center gap-3 p-4 text-left">
                  <div className="text-white/60">{AGENT_ICONS[r.icon]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white/90 font-medium text-sm">{r.agent_name}</div>
                    {r.loading && <div className="text-white/30 text-xs flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Analyzing...</div>}
                    {!r.loading && r.verdict && <div className="text-white/50 text-xs truncate">{r.verdict}</div>}
                  </div>
                  {r.score !== null && <div className={`text-2xl font-bold ${scoreClr(r.score)}`}>{r.score}</div>}
                  <ChevronRight className={`w-4 h-4 text-white/30 transition-transform ${expandedAgent === r.agent_id ? "rotate-90" : ""}`} />
                </button>
                {expandedAgent === r.agent_id && r.feedback && (
                  <div className="px-4 pb-4 border-t border-white/[0.06] pt-3">
                    <p className="text-white/70 text-sm whitespace-pre-wrap">{r.feedback}</p>
                    {r.suggestions.length > 0 && <div className="mt-3"><div className="text-white/40 text-xs uppercase mb-1">Suggestions</div><ul className="space-y-1">{r.suggestions.map((s, i) => <li key={i} className="text-white/60 text-sm flex items-start gap-2"><span className="text-blue-400 mt-0.5">-</span> {s}</li>)}</ul></div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </>)}</AnimatePresence>
  );

  const renderMedia = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between"><h1 className="text-2xl font-bold text-white/90">Media Library</h1><Button variant="ghost" className="text-white/60" onClick={fetchMedia}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button></div>
      {loadingMedia && <div className="text-white/40 text-sm">Loading media...</div>}
      {!loadingMedia && mediaItems.length === 0 && <div className="text-white/30 text-sm py-12 text-center">No media files yet.</div>}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {mediaItems.map((m) => (
          <div key={m.id} className="rounded-xl border border-white/[0.06] overflow-hidden group cursor-pointer hover:border-white/[0.12]" style={{ background: BG3 }}>
            {m.mime_type?.startsWith("image/") ? <img src={m.public_url} alt={m.alt_text ?? m.file_name} className="w-full h-32 object-cover" /> : <div className="w-full h-32 flex items-center justify-center text-white/20"><FileText className="w-8 h-8" /></div>}
            <div className="p-3"><div className="text-white/80 text-xs truncate">{m.file_name}</div><div className="text-white/30 text-xs mt-1">{m.folder ?? "root"}</div>
              <button onClick={() => { navigator.clipboard.writeText(m.public_url).catch(() => { /* empty */ }); toast({ title: "Copied", description: "URL copied." }); }} className="text-blue-400 text-xs mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100"><Copy className="w-3 h-3" /> Copy URL</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSEO = () => {
    const kw = draftPost.primary_keyword ?? "";
    const kwCount = kw && curContent ? (curContent.toLowerCase().match(new RegExp(kw.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length : 0;
    const kwDens = words > 0 ? ((kwCount / words) * 100).toFixed(1) : "0.0";
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white/90">SEO Tools</h1>
        {!editingPost && !isNewPost && <Card className="p-8 text-center text-white/40 text-sm">Open a post in the editor first to use SEO tools.</Card>}
        {(editingPost || isNewPost) && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-5"><h3 className="text-white/80 font-medium mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-blue-400" /> Keyword Density</h3>
              {kw ? <><div className="text-white/60 text-sm">Keyword: <span className="text-white/90 font-medium">{kw}</span></div><div className="text-white/60 text-sm mt-1">Occurrences: <span className="text-white/90">{kwCount}</span></div><div className="text-white/60 text-sm mt-1">Density: <span className={parseFloat(kwDens) >= 1 && parseFloat(kwDens) <= 3 ? "text-emerald-400" : "text-amber-400"}>{kwDens}%</span></div><div className="text-white/30 text-xs mt-2">Target: 1-3%</div></> : <div className="text-white/30 text-sm">Set a primary keyword first.</div>}
            </Card>
            <Card className="p-5"><h3 className="text-white/80 font-medium mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-400" /> Readability</h3>
              <div className="text-white/60 text-sm">Words: <span className="text-white/90">{words}</span></div>
              <div className="text-white/60 text-sm mt-1">Reading time: <span className="text-white/90">{rt(words)}</span></div>
              <div className="text-white/60 text-sm mt-1">Paragraphs: <span className="text-white/90">{curContent.split(/\n\n+/).filter(Boolean).length}</span></div>
              <div className="text-white/60 text-sm mt-1">Avg words/sentence: <span className="text-white/90">{curContent ? Math.round(words / Math.max(1, (curContent.match(/[.!?]+/g) ?? []).length)) : 0}</span></div>
            </Card>
            <Card className="p-5 md:col-span-2"><h3 className="text-white/80 font-medium mb-3 flex items-center gap-2"><ExternalLink className="w-4 h-4 text-blue-400" /> SERP Preview</h3>
              <div className="rounded-lg p-4 bg-white/[0.02] border border-white/[0.04]">
                <div className="text-blue-400 text-lg truncate">{curMetaTitle || curTitle || "Page Title"}</div>
                <div className="text-emerald-500 text-sm truncate">hansvanleeuwen.com/{draftPost.slug || "post-slug"}</div>
                <div className="text-white/50 text-sm line-clamp-2 mt-1">{curMetaDesc || curExcerpt || "Description..."}</div>
              </div>
              <div className="mt-3 flex gap-4 text-xs"><span className={charColor(curMetaTitle.length, 50, 60)}>Title: {curMetaTitle.length}/60</span><span className={charColor(curMetaDesc.length, 120, 160)}>Desc: {curMetaDesc.length}/160</span></div>
            </Card>
          </div>
        )}
      </div>
    );
  };

  const renderVoice = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white/90">Voice & Style</h1>
      <div><h2 className="text-lg font-semibold text-white/80 mb-3">Voice Templates</h2>
        {loadingVoice && <div className="text-white/40 text-sm">Loading...</div>}
        {!loadingVoice && voiceTemplates.length === 0 && <div className="text-white/30 text-sm">No voice templates found.</div>}
        <div className="grid gap-4 md:grid-cols-2">{voiceTemplates.map((v) => (
          <Card key={v.id} className="p-5">
            <div className="flex items-center justify-between mb-2"><h3 className="text-white/90 font-medium">{v.name}</h3><Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">{v.category}</Badge></div>
            <div className="space-y-1 text-sm"><div className="text-white/50">Tone: <span className="text-white/70">{v.tone}</span></div><div className="text-white/50">Perspective: <span className="text-white/70">{v.perspective}</span></div><div className="text-white/50">Audience: <span className="text-white/70">{v.target_audience}</span></div></div>
            {v.banned_words?.length > 0 && <div className="mt-3"><div className="text-white/30 text-xs uppercase mb-1">Banned Words</div><div className="flex flex-wrap gap-1">{v.banned_words.slice(0, 8).map((w) => <Badge key={w} className="bg-red-500/10 text-red-400 text-xs">{w}</Badge>)}{v.banned_words.length > 8 && <Badge className="bg-white/[0.04] text-white/40 text-xs">+{v.banned_words.length - 8}</Badge>}</div></div>}
            {v.content_rules && <div className="mt-3"><div className="text-white/30 text-xs uppercase mb-1">Content Rules</div><div className="text-white/50 text-xs line-clamp-3">{v.content_rules}</div></div>}
          </Card>
        ))}</div>
      </div>
      <div><h2 className="text-lg font-semibold text-white/80 mb-3">Editorial Memory</h2>
        {blogMemory.length === 0 && <div className="text-white/30 text-sm">No editorial memory entries.</div>}
        <div className="space-y-3">{blogMemory.map((m) => (
          <Card key={m.content_category} className="p-5">
            <div className="flex items-center justify-between mb-2"><h3 className="text-white/90 font-medium capitalize">{m.content_category}</h3><span className="text-white/30 text-xs">{fmtDate(m.updated_at)}</span></div>
            {m.brand_voice_context && <div className="mb-2"><div className="text-white/30 text-xs uppercase mb-1">Brand Voice</div><div className="text-white/60 text-sm whitespace-pre-wrap">{m.brand_voice_context}</div></div>}
            {m.narrative_history && <div><div className="text-white/30 text-xs uppercase mb-1">Narrative History</div><div className="text-white/50 text-sm whitespace-pre-wrap line-clamp-4">{m.narrative_history}</div></div>}
          </Card>
        ))}</div>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white/90">Settings</h1>
      <Card className="p-6"><h3 className="text-white/80 font-medium mb-4">CMS Preferences</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between"><span className="text-white/60 text-sm">Default editor language</span><select value={editorLang} onChange={(e) => setEditorLang(e.target.value as PostLanguage)} className="rounded border border-white/[0.06] bg-white/[0.04] text-white/80 text-sm px-3 py-1.5"><option value="en">English</option><option value="nl">Nederlands</option></select></div>
          <div className="flex items-center justify-between"><span className="text-white/60 text-sm">Default view mode</span><select value={viewMode} onChange={(e) => setViewMode(e.target.value as "table" | "card")} className="rounded border border-white/[0.06] bg-white/[0.04] text-white/80 text-sm px-3 py-1.5"><option value="table">Table</option><option value="card">Cards</option></select></div>
        </div>
      </Card>
      <Card className="p-6"><h3 className="text-white/80 font-medium mb-2">Signed in as</h3><div className="text-white/60 text-sm">{user?.email ?? "Unknown"}</div></Card>
    </div>
  );

  const renderContent = () => {
    switch (activeNav) {
      case "dashboard": return renderDashboard();
      case "posts": return renderPostsList();
      case "new-post": return renderEditor();
      case "media": return renderMedia();
      case "seo": return renderSEO();
      case "voice": return renderVoice();
      case "settings": return renderSettings();
      default: return renderDashboard();
    }
  };

  return (
    <div className="pt-20 min-h-screen" style={{ background: BG }}>
      {renderGhostWriterModal()}
      <aside className={`fixed top-16 left-0 z-30 h-[calc(100vh-64px)] border-r border-white/[0.06] transition-all duration-300 ${sidebarOpen ? "w-[280px]" : "w-[60px]"} hidden lg:flex flex-col`} style={{ background: BG2 }}>
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          {sidebarOpen && <span className="text-white/90 font-semibold text-sm tracking-wide">Editorial CMS</span>}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-white/40 hover:text-white/80">{sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</button>
        </div>
        <nav className="flex-1 py-2 overflow-y-auto">{NAV_ITEMS.map((item) => navBtn(item, () => { if (item.key === "new-post") startNewPost(); else setActiveNav(item.key); }))}</nav>
      </aside>
      <AnimatePresence>{mobileSidebarOpen && (<>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />
        <motion.aside initial={{ x: -280 }} animate={{ x: 0 }} exit={{ x: -280 }} transition={{ type: "spring", damping: 25 }} className="fixed top-16 left-0 z-50 w-[280px] h-[calc(100vh-64px)] border-r border-white/[0.06] flex flex-col lg:hidden" style={{ background: BG2 }}>
          <div className="flex items-center justify-between p-4 border-b border-white/[0.06]"><span className="text-white/90 font-semibold text-sm">Editorial CMS</span><button onClick={() => setMobileSidebarOpen(false)} className="text-white/40 hover:text-white/80"><X className="w-4 h-4" /></button></div>
          <nav className="flex-1 py-2">{NAV_ITEMS.map((item) => <button key={item.key} onClick={() => { if (item.key === "new-post") startNewPost(); else setActiveNav(item.key); setMobileSidebarOpen(false); }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${activeNav === item.key ? "text-blue-400 bg-blue-500/10" : "text-white/60 hover:text-white/90"}`}>{item.icon}<span>{item.label}</span></button>)}</nav>
        </motion.aside>
      </>)}</AnimatePresence>
      {renderReviewDrawer()}
      <div className="lg:hidden fixed top-16 left-0 right-0 z-20 border-b border-white/[0.06] px-4 py-2 flex items-center gap-3" style={{ background: BG2 }}>
        <button onClick={() => setMobileSidebarOpen(true)} className="text-white/60"><Menu className="w-5 h-5" /></button>
        <span className="text-white/80 text-sm font-medium">{NAV_ITEMS.find((n) => n.key === activeNav)?.label ?? "CMS"}</span>
      </div>
      <main className={`transition-all duration-300 ${sidebarOpen ? "lg:ml-[280px]" : "lg:ml-[60px]"} pt-12 lg:pt-0`}>
        <div className="p-4 md:p-6 lg:p-8 max-w-7xl">
          <AnimatePresence mode="wait">
            <motion.div key={activeNav} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.15 }}>{renderContent()}</motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
};

export default BlogCMS;
