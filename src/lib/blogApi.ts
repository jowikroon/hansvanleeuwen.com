// Typed wrappers for the 7 n8n blog webhooks.
// Per CLAUDE.md: frontend never calls AI directly — all reasoning routes through n8n.
// Backend pipeline lives in n8n on VPS1 (n8n.srv1402218.hstgr.cloud).

const N8N_BASE =
  (import.meta.env.VITE_N8N_BASE as string | undefined) ??
  "https://n8n.srv1402218.hstgr.cloud";

type Json = Record<string, unknown>;

async function post<T = Json>(path: string, body: Json, timeoutMs = 60_000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const resp = await fetch(`${N8N_BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`${path} ${resp.status}: ${text.slice(0, 200)}`);
    }
    return (await resp.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

// ─── /webhook/blog-ghost-write ──────────────────────────────────────
// Generates a 500-word skeleton draft with 7 [HANS:] gates.
export interface GhostWriteInput {
  topic: string;
  category?: string;
  voice_template_id?: string | null;
  target_words?: number;
  language?: "en" | "nl";
}
export interface GhostWriteOutput {
  title: string;
  excerpt: string;
  content: string;          // markdown with [HANS:] gates
  suggested_slug: string;
  suggested_tags: string[];
  word_count: number;
}
export const ghostWrite = (input: GhostWriteInput) =>
  post<GhostWriteOutput>("/webhook/blog-ghost-write", input as unknown as Json, 90_000);

// ─── /webhook/blog-agent-review ─────────────────────────────────────
// Single-call 10-dimension review with burstiness check. Returns weighted total.
export interface ReviewInput {
  title: string;
  content: string;
  category?: string;
  voice_template_id?: string | null;
}
export interface ReviewDimension {
  name: string;
  score: number;        // 0-100
  weight: number;       // 0-1
  feedback: string;
  suggestions: string[];
}
export interface ReviewOutput {
  total_score: number;             // 0-100 (weighted)
  publish_ready: boolean;          // true if >= 85
  dimensions: ReviewDimension[];
  burstiness: number;              // sentence-length variance
  forbidden_terms_found: string[];
}
export const agentReview = (input: ReviewInput) =>
  post<ReviewOutput>("/webhook/blog-agent-review", input as unknown as Json, 90_000);

// ─── /webhook/blog-auto-seo ─────────────────────────────────────────
// SEO metadata, JSON-LD, tags.
export interface AutoSeoInput {
  title: string;
  content: string;
  slug?: string;
}
export interface AutoSeoOutput {
  meta_title: string;     // ends with " | Hans van Leeuwen"
  meta_description: string;
  canonical_url: string;  // /writing/{slug}
  og_title: string;
  og_description: string;
  json_ld: Json;
  tags: string[];
  reading_time_min: number;
}
export const autoSeo = (input: AutoSeoInput) =>
  post<AutoSeoOutput>("/webhook/blog-auto-seo", input as unknown as Json, 60_000);

// ─── /webhook/blog-post-save ────────────────────────────────────────
// Save/update post in Supabase. Strips em-dashes server-side.
export interface PostSaveInput {
  id?: string;
  title: string;
  slug: string;
  excerpt?: string;
  content: string;
  content_nl?: string;
  category?: string;
  tags?: string[];
  status: "draft" | "review" | "scheduled" | "published" | "archived";
  voice_template_id?: string | null;
  hero_image_url?: string | null;
  hero_image_prompt?: string | null;
  meta_title?: string;
  meta_description?: string;
  scheduled_at?: string | null;
}
export interface PostSaveOutput {
  id: string;
  slug: string;
  updated_at: string;
  status: string;
}
export const postSave = (input: PostSaveInput) =>
  post<PostSaveOutput>("/webhook/blog-post-save", input as unknown as Json, 30_000);

// ─── /webhook/blog-init ─────────────────────────────────────────────
// Load editorial memory for a category (recent narratives, recurring claims).
export interface BlogInitInput {
  category: string;
}
export interface BlogInitOutput {
  narrative_history: string[];
  recurring_claims: string[];
  recent_titles: string[];
  forbidden_terms: string[];
}
export const blogInit = (input: BlogInitInput) =>
  post<BlogInitOutput>("/webhook/blog-init", input as unknown as Json, 20_000);

// ─── /webhook/blog-memory-update ────────────────────────────────────
// Update narrative history after publishing.
export interface MemoryUpdateInput {
  post_id: string;
  category: string;
  title: string;
  key_claims: string[];
}
export const memoryUpdate = (input: MemoryUpdateInput) =>
  post<{ ok: true }>("/webhook/blog-memory-update", input as unknown as Json, 20_000);

// ─── /webhook/blog-header-image ─────────────────────────────────────
// Generate header image (Gemini, style-locked: warm cream + black + amber #F5C400, editorial line-art, 21:9).
export interface HeaderImageInput {
  prompt: string;
  style?: "editorial" | "technical" | "abstract" | "duotone" | "minimal" | "riso" | "geo" | "newsprint" | "swiss";
  post_id?: string;
}
export interface HeaderImageOutput {
  image_url: string;
  variants?: string[];
  cost_usd?: number;
  model?: string;
}
export const headerImage = (input: HeaderImageInput) =>
  post<HeaderImageOutput>("/webhook/blog-header-image", input as unknown as Json, 120_000);
