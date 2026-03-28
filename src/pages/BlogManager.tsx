import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  status: string;
  voice_template_id: string | null;
  read_time: string | null;
  word_count: number;
  revision_count: number;
  ai_generated: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface VoiceTemplate {
  id: string;
  name: string;
  category: string;
  is_default: boolean;
  tone: string;
  perspective: string;
  target_audience: string;
  writing_style: string;
  banned_words: string[];
  required_elements: string[];
  content_rules: string;
  opening_examples: string[];
  closing_examples: string[];
}

type Tab = "articles" | "editor" | "voice" | "improve";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-zinc-500/10 text-zinc-400",
  review: "bg-amber-500/10 text-amber-400",
  published: "bg-emerald-500/10 text-emerald-400",
  archived: "bg-zinc-500/10 text-zinc-600",
};

const BlogManager = () => {
  const [tab, setTab] = useState<Tab>("articles");
  const [articles, setArticles] = useState<Article[]>([]);
  const [templates, setTemplates] = useState<VoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingArticle, setEditingArticle] = useState<Article | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<VoiceTemplate | null>(null);
  const [saving, setSaving] = useState(false);

  // Editor state
  const [edTitle, setEdTitle] = useState("");
  const [edExcerpt, setEdExcerpt] = useState("");
  const [edContent, setEdContent] = useState("");
  const [edCategory, setEdCategory] = useState("professional");
  const [edTags, setEdTags] = useState("");
  const [edStatus, setEdStatus] = useState("draft");
  const [edVoiceId, setEdVoiceId] = useState("");
  const [edSlug, setEdSlug] = useState("");

  // AI generation
  const [aiTopic, setAiTopic] = useState("");
  const [aiVoiceId, setAiVoiceId] = useState("");
  const [generating, setGenerating] = useState(false);

  // Improve mode
  const [improveId, setImproveId] = useState("");
  const [improveFeedback, setImproveFeedback] = useState("");
  const [improving, setImproving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [artRes, tmpRes] = await Promise.all([
      supabase.from("hvl_blog_articles").select("*").order("created_at", { ascending: false }),
      supabase.from("hvl_voice_templates").select("*").order("is_default", { ascending: false }),
    ]);
    setArticles((artRes.data as Article[]) ?? []);
    setTemplates((tmpRes.data as VoiceTemplate[]) ?? []);
    setLoading(false);
  }

  function openEditor(article?: Article) {
    if (article) {
      setEditingArticle(article);
      setEdTitle(article.title);
      setEdExcerpt(article.excerpt);
      setEdContent(article.content);
      setEdCategory(article.category);
      setEdTags(article.tags.join(", "));
      setEdStatus(article.status);
      setEdVoiceId(article.voice_template_id ?? "");
      setEdSlug(article.slug);
    } else {
      setEditingArticle(null);
      setEdTitle(""); setEdExcerpt(""); setEdContent(""); setEdCategory("professional");
      setEdTags(""); setEdStatus("draft"); setEdVoiceId(""); setEdSlug("");
    }
    setTab("editor");
  }

  async function saveArticle() {
    setSaving(true);
    const slug = edSlug || edTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const wordCount = edContent.split(/\s+/).filter(Boolean).length;
    const readTime = `${Math.max(1, Math.ceil(wordCount / 200))} min read`;

    const row = {
      title: edTitle.trim(),
      slug,
      excerpt: edExcerpt.trim(),
      content: edContent,
      category: edCategory,
      tags: edTags.split(",").map((t) => t.trim()).filter(Boolean),
      status: edStatus,
      voice_template_id: edVoiceId || null,
      word_count: wordCount,
      read_time: readTime,
      published_at: edStatus === "published" ? new Date().toISOString() : editingArticle?.published_at ?? null,
    };

    if (editingArticle) {
      const { error } = await supabase.from("hvl_blog_articles")
        .update({ ...row, revision_count: editingArticle.revision_count + 1 })
        .eq("id", editingArticle.id);
      if (error) { alert(error.message); setSaving(false); return; }

      // Save revision
      await supabase.from("hvl_blog_revisions").insert({
        article_id: editingArticle.id,
        content: edContent,
        revision_note: "Manual edit",
        word_count: wordCount,
        created_by: "human",
      });
    } else {
      const { error } = await supabase.from("hvl_blog_articles").insert(row);
      if (error) { alert(error.message); setSaving(false); return; }
    }

    await loadData();
    setTab("articles");
    setSaving(false);
  }

  async function deleteArticle(id: string) {
    if (!confirm("Delete this article permanently?")) return;
    await supabase.from("hvl_blog_articles").delete().eq("id", id);
    await loadData();
  }

  async function duplicateArticle(article: Article) {
    await supabase.from("hvl_blog_articles").insert({
      title: article.title + " (copy)",
      slug: article.slug + "-copy-" + Date.now(),
      excerpt: article.excerpt,
      content: article.content,
      category: article.category,
      tags: article.tags,
      status: "draft",
      voice_template_id: article.voice_template_id,
      word_count: article.word_count,
      read_time: article.read_time,
    });
    await loadData();
  }

  const stats = {
    total: articles.length,
    published: articles.filter((a) => a.status === "published").length,
    drafts: articles.filter((a) => a.status === "draft").length,
    totalWords: articles.reduce((s, a) => s + a.word_count, 0),
  };

  return (
    <section className="section-container pt-28 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="mb-2 text-sm font-medium uppercase tracking-[0.2em] text-primary">Blog Manager</p>
        <h1 className="mb-4 font-display text-4xl font-medium tracking-tight text-foreground md:text-5xl">
          Write, Build, Improve
        </h1>
        <p className="mb-8 max-w-xl text-base leading-relaxed text-muted-foreground">
          Manage articles with voice-consistent AI generation and editorial control.
        </p>

        {/* Tabs */}
        <div className="mb-8 flex gap-1 rounded-lg border border-border bg-card/50 p-1 w-fit">
          {([
            ["articles", "Articles"],
            ["editor", editingArticle ? "Edit" : "New Article"],
            ["voice", "Voice Templates"],
            ["improve", "AI Improve"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id as Tab)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ─── ARTICLES TAB ─── */}
        {tab === "articles" && (
          <div>
            {/* Stats */}
            <div className="mb-6 grid grid-cols-4 gap-4">
              {[
                ["Articles", stats.total],
                ["Published", stats.published],
                ["Drafts", stats.drafts],
                ["Total Words", stats.totalWords.toLocaleString()],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-border bg-card/50 p-4">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-semibold text-foreground">{value}</p>
                </div>
              ))}
            </div>

            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-foreground">All Articles</h2>
              <button
                onClick={() => openEditor()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                + New Article
              </button>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            ) : articles.length === 0 ? (
              <div className="py-16 text-center rounded-lg border border-dashed border-border">
                <p className="text-muted-foreground mb-2">No articles yet</p>
                <button onClick={() => openEditor()} className="text-primary text-sm hover:underline">
                  Create your first article →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {articles.map((article) => (
                  <div
                    key={article.id}
                    className="group flex items-center gap-4 rounded-lg border border-border bg-card/30 p-4 hover:border-primary/20 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3
                          className="font-medium text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                          onClick={() => openEditor(article)}
                        >
                          {article.title}
                        </h3>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${STATUS_COLORS[article.status]}`}>
                          {article.status}
                        </span>
                        {article.ai_generated && (
                          <span className="text-[10px] text-violet-400 font-medium">AI</span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">{article.excerpt}</p>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{article.category}</span>
                        <span>·</span>
                        <span>{article.word_count} words</span>
                        <span>·</span>
                        <span>{article.read_time}</span>
                        <span>·</span>
                        <span>v{article.revision_count}</span>
                        {article.tags.length > 0 && (
                          <>
                            <span>·</span>
                            {article.tags.slice(0, 3).map((t) => (
                              <span key={t} className="text-primary/70">{t}</span>
                            ))}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEditor(article)} className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Edit</button>
                      <button onClick={() => duplicateArticle(article)} className="rounded px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">Duplicate</button>
                      <button onClick={() => deleteArticle(article.id)} className="rounded px-2 py-1 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── EDITOR TAB ─── */}
        {tab === "editor" && (
          <div className="max-w-3xl space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-foreground">
                {editingArticle ? `Editing: ${editingArticle.title}` : "New Article"}
              </h2>
              <div className="flex gap-2">
                <select value={edStatus} onChange={(e) => setEdStatus(e.target.value)} className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm">
                  <option value="draft">Draft</option>
                  <option value="review">Review</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
                <button onClick={saveArticle} disabled={saving || !edTitle.trim()} className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {/* Voice template selector */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Voice Template</label>
              <select value={edVoiceId} onChange={(e) => setEdVoiceId(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <option value="">No template (freeform)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} — {t.tone.slice(0, 60)}</option>
                ))}
              </select>
              {edVoiceId && (() => {
                const tmpl = templates.find((t) => t.id === edVoiceId);
                if (!tmpl) return null;
                return (
                  <div className="mt-2 rounded-lg border border-border/50 bg-card/30 p-3 text-xs text-muted-foreground space-y-1">
                    <p><strong className="text-foreground">Tone:</strong> {tmpl.tone}</p>
                    <p><strong className="text-foreground">Audience:</strong> {tmpl.target_audience}</p>
                    <p><strong className="text-foreground">Style:</strong> {tmpl.writing_style.slice(0, 150)}...</p>
                    {tmpl.banned_words.length > 0 && (
                      <p><strong className="text-foreground">Banned:</strong> {tmpl.banned_words.join(", ")}</p>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Title</label>
                <input value={edTitle} onChange={(e) => { setEdTitle(e.target.value); if (!editingArticle) setEdSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")); }} placeholder="Article title" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Slug</label>
                <input value={edSlug} onChange={(e) => setEdSlug(e.target.value)} placeholder="article-slug" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Category</label>
                <select value={edCategory} onChange={(e) => setEdCategory(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                  <option value="professional">Professional</option>
                  <option value="personal">Personal</option>
                  <option value="technical">Technical</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tags (comma separated)</label>
                <input value={edTags} onChange={(e) => setEdTags(e.target.value)} placeholder="SaaS, Engineering, AI" className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Excerpt</label>
              <textarea value={edExcerpt} onChange={(e) => setEdExcerpt(e.target.value)} placeholder="Brief description for listing cards and SEO..." rows={2} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y" />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground">Content (Markdown)</label>
                <span className="text-xs text-muted-foreground">
                  {edContent.split(/\s+/).filter(Boolean).length} words · {Math.max(1, Math.ceil(edContent.split(/\s+/).filter(Boolean).length / 200))} min read
                </span>
              </div>
              <textarea
                value={edContent}
                onChange={(e) => setEdContent(e.target.value)}
                placeholder="Write your article content here...&#10;&#10;## Section Heading&#10;&#10;Paragraph text with **bold** and specific data points.&#10;&#10;- Bullet point 1&#10;- Bullet point 2"
                rows={20}
                className="w-full rounded-lg border border-border bg-card px-4 py-3 text-sm font-mono leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              />
            </div>
          </div>
        )}

        {/* ─── VOICE TEMPLATES TAB ─── */}
        {tab === "voice" && (
          <div>
            <h2 className="mb-4 text-lg font-medium text-foreground">Voice Templates</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              These templates define exactly how your articles should sound. Select one when writing to get AI assistance that matches your voice.
            </p>

            {templates.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No templates found.</div>
            ) : (
              <div className="space-y-4">
                {templates.map((tmpl) => (
                  <div key={tmpl.id} className="rounded-xl border border-border bg-card/30 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <h3 className="font-medium text-foreground">{tmpl.name}</h3>
                        {tmpl.is_default && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">DEFAULT</span>
                        )}
                        <span className="text-xs text-muted-foreground capitalize">{tmpl.category}</span>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Tone</p>
                        <p className="text-sm text-foreground/80 leading-relaxed">{tmpl.tone}</p>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Target Audience</p>
                        <p className="text-sm text-foreground/80 leading-relaxed">{tmpl.target_audience}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Writing Style</p>
                        <p className="text-sm text-foreground/80 leading-relaxed">{tmpl.writing_style}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Content Rules</p>
                        <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{tmpl.content_rules}</p>
                      </div>
                    </div>

                    {tmpl.banned_words.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Banned Words</p>
                        <div className="flex flex-wrap gap-1.5">
                          {tmpl.banned_words.map((w) => (
                            <span key={w} className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] text-red-400 line-through">{w}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    {tmpl.required_elements.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Required in Every Article</p>
                        <div className="space-y-1">
                          {tmpl.required_elements.map((el) => (
                            <p key={el} className="text-sm text-foreground/70 flex items-start gap-2">
                              <span className="text-primary mt-0.5">✓</span> {el}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {tmpl.opening_examples.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Opening Examples</p>
                        <div className="space-y-2">
                          {tmpl.opening_examples.map((ex, i) => (
                            <p key={i} className="text-sm text-foreground/60 italic border-l-2 border-primary/30 pl-3">"{ex}"</p>
                          ))}
                        </div>
                      </div>
                    )}

                    {tmpl.closing_examples.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Closing Examples</p>
                        <div className="space-y-2">
                          {tmpl.closing_examples.map((ex, i) => (
                            <p key={i} className="text-sm text-foreground/60 italic border-l-2 border-primary/30 pl-3">"{ex}"</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── AI IMPROVE TAB ─── */}
        {tab === "improve" && (
          <div className="max-w-2xl">
            <h2 className="mb-2 text-lg font-medium text-foreground">AI Improve</h2>
            <p className="mb-6 text-sm text-muted-foreground">
              Select an article and describe what you want to improve. The AI will rewrite sections while maintaining your voice template.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Select Article</label>
                <select value={improveId} onChange={(e) => setImproveId(e.target.value)} className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm">
                  <option value="">Choose an article...</option>
                  {articles.map((a) => (
                    <option key={a.id} value={a.id}>{a.title} ({a.status})</option>
                  ))}
                </select>
              </div>

              {improveId && (() => {
                const article = articles.find((a) => a.id === improveId);
                if (!article) return null;
                const tmpl = templates.find((t) => t.id === article.voice_template_id);
                return (
                  <div className="rounded-lg border border-border bg-card/30 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-foreground">{article.title}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[article.status]}`}>{article.status}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{article.word_count} words · {article.revision_count} revisions · {article.category}</p>
                    {tmpl && <p className="text-xs text-primary">Voice: {tmpl.name}</p>}
                    <div className="mt-3 max-h-32 overflow-y-auto rounded border border-border/50 bg-card p-3 text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                      {article.content.slice(0, 500)}{article.content.length > 500 ? "..." : ""}
                    </div>
                  </div>
                );
              })()}

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">What should be improved?</label>
                <textarea
                  value={improveFeedback}
                  onChange={(e) => setImproveFeedback(e.target.value)}
                  placeholder="e.g. Make the opening more hook-like. Add more specific data points in section 2. Shorten the conclusion. The tone drifts into marketing-speak in paragraph 4 — make it more direct."
                  rows={4}
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={async () => {
                    if (!improveId || !improveFeedback.trim()) return;
                    setImproving(true);
                    // In production, this calls an Edge Function with Claude
                    // For now, simulate the improvement
                    await new Promise((r) => setTimeout(r, 2000));
                    const article = articles.find((a) => a.id === improveId);
                    if (article) {
                      openEditor(article);
                      setTab("editor");
                    }
                    setImproving(false);
                  }}
                  disabled={improving || !improveId || !improveFeedback.trim()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {improving ? "Improving..." : "Improve with AI"}
                </button>
                <p className="text-xs text-muted-foreground">Uses the article's voice template for consistent tone.</p>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </section>
  );
};

export default BlogManager;
