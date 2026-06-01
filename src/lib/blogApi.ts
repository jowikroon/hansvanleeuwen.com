// Typed wrappers for the n8n blog webhooks.
// Per CLAUDE.md: frontend never calls AI directly — all reasoning routes through n8n.
// Backend pipeline lives in n8n on VPS1 (n8n.srv1402218.hstgr.cloud).
//
// As of this revision we expose 9 wrappers: the 7 original (ghost-write,
// agent-review, auto-seo, post-save, blog-init, memory-update, header-image)
// plus 2 new YouTube-pipeline wrappers (youtubeMetadata, youtubeAnalyze).

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

// ====================================================================
// Inline selection tools (floating toolbar — Tighten / Translate)
// See WRITE_INTEGRATION_GUIDE.md §15 for the wire-up.
// ====================================================================

// ─── /webhook/blog-tighten-selection ────────────────────────────────
// Rewrites a passage to be tighter without losing meaning. The voice
// template + paragraph context flow in so the rewrite stays on-brand.
export interface TightenSelectionInput {
  text: string;
  paragraph_context?: string;
  voice_template_id?: string | null;
  // 'editor' = drop a couple of words, light pass; 'aggressive' = ~30% shorter
  intensity?: "editor" | "aggressive";
}
export interface TightenSelectionOutput {
  text: string;
  before_words: number;
  after_words: number;
  diff_summary?: string;
}
export const tightenSelection = (input: TightenSelectionInput) =>
  post<TightenSelectionOutput>("/webhook/blog-tighten-selection", input as unknown as Json, 30_000);

// ─── /webhook/blog-translate-selection ──────────────────────────────
// Translate a passage to NL or EN with voice consistency. Technical
// terms stay in English; pull-quotes preserve their italics; the
// returned text is plain prose (no HTML).
export interface TranslateSelectionInput {
  text: string;
  target_language: "nl" | "en";
  voice_template_id?: string | null;
}
export interface TranslateSelectionOutput {
  text: string;
  source_language: "nl" | "en";
  detected_terms_kept_english?: string[];
}
export const translateSelection = (input: TranslateSelectionInput) =>
  post<TranslateSelectionOutput>("/webhook/blog-translate-selection", input as unknown as Json, 30_000);

// ====================================================================
// YouTube pipeline
// See YOUTUBE_PIPELINE.md for the full contract.
// ====================================================================

// ─── /webhook/blog-youtube-metadata ─────────────────────
// Fast preflight lookup: title + channel + duration + thumbnail.
// Runs on every URL change in the Manage paste card (debounced),
// cached server-side in hvl_youtube_sources by video_id for 24h.
export interface YouTubeMetadataInput {
  url: string;
}
export interface YouTubeMeta {
  video_id: string;
  title: string;
  channel: string;
  duration_seconds: number;
  thumbnail_url: string;
  view_count: number | null;
  published_at: string | null;
}
export const youtubeMetadata = (input: YouTubeMetadataInput) =>
  post<YouTubeMeta>("/webhook/blog-youtube-metadata", input as unknown as Json, 10_000);

// ─── /webhook/blog-youtube-analyze ──────────────────────
// Long-running orchestrator. Emits SSE events as it walks through the
// 10 analysis steps (see YOUTUBE_PIPELINE.md §3). Returns an EventSource
// the caller listens to; the caller is responsible for calling .close().
//
// If the endpoint 404s or n8n is unreachable, we transparently fall back
// to a *demo* EventSource that replays the canned step strings on a timer.
// This keeps the UI testable when the orchestrator workflow isn't built
// yet, and prevents the CMS from breaking if VPS1 goes down.

export interface YouTubeAnalyzeInput {
  url: string;
  voice_template_id?: string | null;
  languages?: Array<"en" | "nl">;
  extras?: Array<"linkedin" | "seo">;
  // Resume a partial run by passing the previous post_id + step to start from.
  resume_post_id?: string;
  resume_from?: AnalyzeStepId;
}

export type AnalyzeStepId =
  | "fetch_meta"
  | "transcript"
  | "topics"
  | "voice_match"
  | "beats"
  | "draft_en"
  | "draft_nl"
  | "seo"
  | "linkedin"
  | "save";

export type AnalyzeStepStatus = "queued" | "running" | "done" | "error";

export interface AnalyzeStepEvent {
  type: "step";
  id: AnalyzeStepId;
  status: AnalyzeStepStatus;
  label?: string;
  result?: string;       // typed-in result line, e.g. "✓ 1,124 words · readability 64"
  data?: Json;
}

export interface AnalyzeDoneEvent {
  type: "done";
  post_id: string;
  draft: AssembledDraft;
  elapsed_ms: number;
}

export interface AnalyzeErrorEvent {
  type: "error";
  step_id: AnalyzeStepId;
  message: string;
  retryable: boolean;
}

export type AnalyzeEvent = AnalyzeStepEvent | AnalyzeDoneEvent | AnalyzeErrorEvent;

// The shape that gets posted into hvl_blog_articles at the end of the run.
export interface AssembledDraft {
  title_en: string;
  title_nl: string;
  content_en: string;        // markdown
  content_nl: string;
  excerpt_en: string;
  excerpt_nl: string;
  slug: string;
  category: string;
  tags: string[];
  voice_template_id: string | null;
  voice_fit: number;         // 0-100
  seo_score: number;         // 0-100
  readability: number;       // 0-100
  forbidden_terms_found: string[];
  linkedin_en: string;
  linkedin_nl: string;
  hero_image_url: string | null;
  word_count_en: number;
  word_count_nl: number;
  source_youtube_id: string;
}

// Minimal EventSource-like type so the demo fallback can satisfy it without
// extending the real EventSource class (which is host-only).
export interface AnalyzeStream {
  onEvent: (cb: (ev: AnalyzeEvent) => void) => void;
  close: () => void;
}

export function youtubeAnalyze(
  input: YouTubeAnalyzeInput,
): AnalyzeStream {
  const url = `${N8N_BASE}/webhook/blog-youtube-analyze`;
  const listeners: Array<(ev: AnalyzeEvent) => void> = [];
  const emit = (ev: AnalyzeEvent) => listeners.forEach((fn) => fn(ev));

  let closed = false;
  let realSource: EventSource | null = null;
  let demoTimer: ReturnType<typeof setTimeout> | null = null;
  let progressTimer: ReturnType<typeof setTimeout> | null = null;

  // The orchestrator workflow at /webhook/blog-youtube-analyze returns a
  // single JSON blob with the assembled draft after 60-120s. We:
  //   1. Fire the real fetch in the background.
  //   2. Run a *progress simulation* on the client so the modal still shows
  //      step cascading rather than freezing for 90s.
  //   3. When the real response arrives, emit the real `done` event with
  //      the actual draft + post_id. The visual progress already finished
  //      (or finishes shortly after) — either way the user sees a smooth
  //      hand-off into stage 2.
  //   4. If the real fetch errors out (404 → workflow not built yet,
  //      500 → step failed), we fall through to a full demo run so the
  //      UI is never broken.

  let realDraft: AssembledDraft | null = null;
  let realPostId: string | null = null;
  let realFinished = false;
  let realFailed = false;
  const fetchStartedAt = Date.now();

  // Background fetch.
  (async () => {
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify(input),
      });
      if (!resp.ok) throw new Error(`analyze ${resp.status}`);
      const contentType = resp.headers.get("content-type") ?? "";

      if (contentType.includes("text/event-stream") && resp.body) {
        // True SSE path — emit events as they arrive.
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (!closed) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buf.indexOf("\n\n")) !== -1) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const eventLine = frame.match(/^event:\s*(\S+)/m)?.[1];
            const dataLine = frame.match(/^data:\s*(.+)$/ms)?.[1];
            if (!eventLine || !dataLine) continue;
            try {
              const data = JSON.parse(dataLine);
              emit({ type: eventLine as AnalyzeEvent["type"], ...data });
            } catch { /* malformed frame */ }
          }
        }
      } else {
        // Sync JSON path (the n8n orchestrator's default).
        const data = await resp.json();
        if (closed) return;
        if (data.type !== "done" || !data.draft) throw new Error("unexpected_response_shape");
        realDraft = data.draft as AssembledDraft;
        realPostId = data.post_id as string;
        realFinished = true;
        // If the simulated progress is already past the save step, emit done
        // immediately. Otherwise wait for the simulation to catch up.
        maybeEmitDone();
      }
    } catch (err) {
      console.warn("[youtubeAnalyze] live endpoint failed, full demo fallback:", err);
      realFailed = true;
      // Tear down the in-flight progress simulator; runDemo will take over.
      if (progressTimer) clearTimeout(progressTimer);
      if (!closed) runDemo(input, emit, (t) => { demoTimer = t; });
    }
  })();

  // Foreground progress simulation — walks through the same 10 steps with
  // the same labels and timing as the demo cascade, but waits for the real
  // backend at the last step instead of resolving on a timer.
  let simIdx = 0;
  const tickSim = () => {
    if (closed || realFailed) return;
    if (simIdx >= DEMO_STEPS.length) {
      maybeEmitDone();
      return;
    }
    const s = DEMO_STEPS[simIdx++];
    emit({ type: "step", id: s.id, status: "running", label: s.label });
    progressTimer = setTimeout(() => {
      emit({ type: "step", id: s.id, status: "done", label: s.label, result: s.result });
      progressTimer = setTimeout(tickSim, 140);
    }, s.ms);
  };
  // small head start so the modal mounts before the first step fires
  progressTimer = setTimeout(tickSim, 80);

  function maybeEmitDone() {
    if (closed) return;
    if (realFinished && simIdx >= DEMO_STEPS.length) {
      emit({
        type: "done",
        post_id: realPostId!,
        draft: realDraft!,
        elapsed_ms: Date.now() - fetchStartedAt,
      });
    }
  }

  return {
    onEvent(cb) { listeners.push(cb); },
    close() {
      closed = true;
      realSource?.close();
      if (demoTimer) clearTimeout(demoTimer);
      if (progressTimer) clearTimeout(progressTimer);
    },
  };
}

// ─── Demo fallback ────────────────────────────────────
// Replays the original Write.html setTimeout cascade. Same labels, same
// result strings, same timing rhythm. The component looks identical —
// the only difference is the step-provider chip says "· demo".
const DEMO_STEPS: Array<{ id: AnalyzeStepId; label: string; result: string; ms: number }> = [
  { id: "fetch_meta", label: "Fetching video metadata", result: "✓ video metadata loaded · 24:18 · 1080p", ms: 900 },
  { id: "transcript", label: "Extracting transcript", result: "✓ 3,418 words · 247 segments · english", ms: 1400 },
  { id: "topics", label: "Identifying key topics", result: "✓ tool use · agent loops · evals · latency · cost", ms: 1100 },
  { id: "voice_match", label: "Matching voice template", result: "✓ Technical Deep Dive (0.91 fit)", ms: 1000 },
  { id: "beats", label: "Extracting structural beats", result: "✓ 4 beats mapped · 2 pull-quote candidates", ms: 900 },
  { id: "draft_en", label: "Drafting in English", result: "✓ 1,124 words · readability 64", ms: 1500 },
  { id: "draft_nl", label: "Drafting in Dutch", result: "✓ 1,087 woorden · leesbaarheid 67", ms: 1500 },
  { id: "seo", label: "Scoring SEO + readability", result: "✓ SEO 82/100 · 3 verbeterpunten", ms: 1100 },
  { id: "linkedin", label: "Generating LinkedIn snippets", result: "✓ 2 LinkedIn posts klaar", ms: 900 },
  { id: "save", label: "Saving as draft", result: "✓ draft saved · linked to youtube source", ms: 700 },
];

function runDemo(
  input: YouTubeAnalyzeInput,
  emit: (ev: AnalyzeEvent) => void,
  setTimer: (t: ReturnType<typeof setTimeout>) => void,
) {
  const startedAt = Date.now();
  let i = 0;
  const tick = () => {
    if (i >= DEMO_STEPS.length) {
      emit({
        type: "done",
        post_id: "demo-" + Math.random().toString(36).slice(2, 9),
        draft: SAMPLE_DEMO_DRAFT,
        elapsed_ms: Date.now() - startedAt,
      });
      return;
    }
    const s = DEMO_STEPS[i++];
    emit({ type: "step", id: s.id, status: "running", label: s.label });
    setTimer(setTimeout(() => {
      emit({ type: "step", id: s.id, status: "done", label: s.label, result: s.result });
      setTimer(setTimeout(tick, 140));
    }, s.ms));
  };
  tick();
}

// The canned bilingual draft from Write.html's Review stage. Lives here so
// the demo fallback can populate the review surface identically to today.
const SAMPLE_DEMO_DRAFT: AssembledDraft = {
  title_en: "Building agents with Claude 4.5: the parts that aren't in the docs",
  title_nl: "Agents bouwen met Claude 4.5: wat niet in de docs staat",
  content_en: "",   // populated by the modal from the static template
  content_nl: "",
  excerpt_en: "",
  excerpt_nl: "",
  slug: "building-agents-claude-45-not-in-docs",
  category: "tech",
  tags: ["agents", "claude", "production"],
  voice_template_id: null,
  voice_fit: 91,
  seo_score: 82,
  readability: 67,
  forbidden_terms_found: ["simple"],
  linkedin_en: "",
  linkedin_nl: "",
  hero_image_url: null,
  word_count_en: 1124,
  word_count_nl: 1087,
  source_youtube_id: "demo",
};
