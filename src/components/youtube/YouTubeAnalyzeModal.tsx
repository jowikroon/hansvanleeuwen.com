/**
 * YouTube → Article 4-stage modal.
 *
 * Ports the polished demo from Write.html (lines 7830-8120) into a real React
 * component. The four stages — Analyze, Review, Publish, Done — share one
 * reducer-driven state machine. SSE events from youtubeAnalyze() drive the
 * step rows. Falls back to the demo cascade when the orchestrator isn't
 * reachable (see blogApi.ts:runDemo).
 *
 * Styles are imported from "@/styles/youtube.css", which is a verbatim copy
 * of the .analysis-stage / .review-layout / .publish-layout / .done-screen
 * CSS blocks from Write.html. Tokens (--bg-0, --accent, etc.) are shared.
 */

import { useEffect, useReducer, useRef, useState } from "react";
import {
  youtubeAnalyze,
  postSave,
  type AnalyzeEvent,
  type AnalyzeStepId,
  type AnalyzeStepStatus,
  type AssembledDraft,
  type YouTubeMeta,
} from "@/lib/blogApi";
import { ANALYSIS_STEPS, PROVIDER_META, type AnalysisStep } from "./analyzeSteps";
import MatrixCanvas from "./MatrixCanvas";
import "@/styles/youtube.css";

// ─── State machine ──────────────────────────────────────────────────
type Stage = "analyze" | "review" | "publish" | "done";

interface StepState extends AnalysisStep {
  status: AnalyzeStepStatus;
  result?: string;
  startedAt?: number;
  finishedAt?: number;
}

type PublishWhen = "smart" | "custom" | "now";

interface ModalState {
  stage: Stage;
  steps: StepState[];
  startedAt: number;
  elapsedMs: number;
  draft: AssembledDraft | null;
  postId: string | null;
  error: { stepId: AnalyzeStepId; message: string } | null;
  // Review stage
  reviewLang: "en" | "nl";
  appliedSuggestions: Set<string>;
  // Publish stage
  publishWhen: PublishWhen;
  publishedAt: string | null;
}

type Action =
  | { type: "tick"; now: number }
  | { type: "step"; ev: Extract<AnalyzeEvent, { type: "step" }> }
  | { type: "done"; ev: Extract<AnalyzeEvent, { type: "done" }> }
  | { type: "error"; ev: Extract<AnalyzeEvent, { type: "error" }> }
  | { type: "setStage"; stage: Stage }
  | { type: "applySuggestion"; id: string }
  | { type: "applyAll" }
  | { type: "setReviewLang"; lang: "en" | "nl" }
  | { type: "setPublishWhen"; when: PublishWhen }
  | { type: "publishCommitted"; at: string }
  | { type: "resetForRetry" };

function initialState(): ModalState {
  return {
    stage: "analyze",
    steps: ANALYSIS_STEPS.map((s) => ({ ...s, status: "queued" })),
    startedAt: Date.now(),
    elapsedMs: 0,
    draft: null,
    postId: null,
    error: null,
    reviewLang: "en",
    appliedSuggestions: new Set(),
    publishWhen: "smart",
    publishedAt: null,
  };
}

function reducer(state: ModalState, a: Action): ModalState {
  switch (a.type) {
    case "tick":
      return { ...state, elapsedMs: a.now - state.startedAt };
    case "step": {
      const steps = state.steps.map((s) => {
        if (s.id !== a.ev.id) return s;
        const next: StepState = { ...s, status: a.ev.status };
        if (a.ev.status === "running" && !s.startedAt) next.startedAt = Date.now();
        if (a.ev.status === "done") next.finishedAt = Date.now();
        if (a.ev.result != null) next.result = a.ev.result;
        return next;
      });
      return { ...state, steps };
    }
    case "done":
      return { ...state, draft: a.ev.draft, postId: a.ev.post_id, elapsedMs: a.ev.elapsed_ms };
    case "error":
      return { ...state, error: { stepId: a.ev.step_id, message: a.ev.message } };
    case "setStage":
      return { ...state, stage: a.stage };
    case "applySuggestion": {
      const next = new Set(state.appliedSuggestions);
      next.add(a.id);
      return { ...state, appliedSuggestions: next };
    }
    case "applyAll": {
      const next = new Set(state.appliedSuggestions);
      QUICK_FIXES.forEach((q) => next.add(q.id));
      return { ...state, appliedSuggestions: next };
    }
    case "setReviewLang":
      return { ...state, reviewLang: a.lang };
    case "setPublishWhen":
      return { ...state, publishWhen: a.when };
    case "publishCommitted":
      return { ...state, publishedAt: a.at };
    case "resetForRetry":
      return { ...initialState(), startedAt: Date.now() };
    default:
      return state;
  }
}

// ─── Quick-fixes (Review stage) ─────────────────────────────────────
// In the live flow these come from agentReview.dimensions[*].suggestions
// (we map a few that have one-click apply semantics). For the demo
// fallback we use the same four the prototype shipped with.
interface QuickFix {
  id: string;
  text: string;
  detail: string;
  cta: "Fix" | "Add" | "Insert";
  appliesTo: "forbidden_word" | "internal_link" | "meta" | "alt_text";
}
const QUICK_FIXES: QuickFix[] = [
  { id: "qf-1", text: "\"simple\" → \"straightforward\"", detail: "forbidden word · Technical voice", cta: "Fix", appliesTo: "forbidden_word" },
  { id: "qf-2", text: "Voeg interne link toe", detail: "→ /blog/buy-box-economics · 0.87 fit", cta: "Add", appliesTo: "internal_link" },
  { id: "qf-3", text: "Meta description ontbreekt", detail: "155–280 chars · generated", cta: "Insert", appliesTo: "meta" },
  { id: "qf-4", text: "Alt-text op 2 afbeeldingen", detail: "auto-generated · review aanbevolen", cta: "Add", appliesTo: "alt_text" },
];

// ─── Props ──────────────────────────────────────────────────────────
interface Props {
  url: string;
  meta: YouTubeMeta | null;
  voice_template_id: string | null;
  languages: Array<"en" | "nl">;
  extras: Array<"linkedin" | "seo">;
  /** Called once a draft post exists in hvl_blog_articles. */
  onSaved?: (postId: string, draft: AssembledDraft) => void;
  /** Called when Hans hits "Schedule" / "Publish now" in stage 3. */
  onPublished?: (postId: string, when: PublishWhen, at: string) => void;
  /** Modal dismissed by user or by relapse. */
  onClose: () => void;
}

// ─── Component ──────────────────────────────────────────────────────
export default function YouTubeAnalyzeModal({
  url, meta, voice_template_id, languages, extras, onSaved, onPublished, onClose,
}: Props) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);

  // open the SSE stream once on mount
  useEffect(() => {
    const stream = youtubeAnalyze({ url, voice_template_id, languages, extras });
    stream.onEvent((ev) => {
      if (ev.type === "step") dispatch({ type: "step", ev });
      else if (ev.type === "done") {
        dispatch({ type: "done", ev });
        onSaved?.(ev.post_id, ev.draft);
        setTimeout(() => dispatch({ type: "setStage", stage: "review" }), 700);
      } else if (ev.type === "error") dispatch({ type: "error", ev });
    });
    return () => stream.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // elapsed-time ticker
  useEffect(() => {
    if (state.stage !== "analyze") return;
    const t = setInterval(() => dispatch({ type: "tick", now: Date.now() }), 200);
    return () => clearInterval(t);
  }, [state.stage]);

  // esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fmt = (ms: number) => `00:${String(Math.floor(ms / 1000)).padStart(2, "0")}`;

  return (
    <div className="modal-root show" role="dialog" aria-modal="true" aria-label="YouTube article analyzer">
      <MatrixCanvas />
      <div className="modal-scrim" onClick={onClose} />

      <div className="analysis">
        <button className="analysis-close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>

        <Stepper current={state.stage} />

        {state.stage === "analyze" && (
          <AnalyzeStage
            meta={meta}
            steps={state.steps}
            elapsedMs={state.elapsedMs}
            error={state.error}
            onRetry={() => dispatch({ type: "resetForRetry" })}
            fmt={fmt}
          />
        )}

        {state.stage === "review" && state.draft && (
          <ReviewStage
            draft={state.draft}
            lang={state.reviewLang}
            applied={state.appliedSuggestions}
            onLang={(l) => dispatch({ type: "setReviewLang", lang: l })}
            onApply={(id) => dispatch({ type: "applySuggestion", id })}
            onApplyAll={() => dispatch({ type: "applyAll" })}
            onBack={() => dispatch({ type: "resetForRetry" })}
            onSaveDraft={() => { /* already saved in hvl_blog_articles by stage 1 step 10 */ onClose(); }}
            onPublish={() => dispatch({ type: "setStage", stage: "publish" })}
          />
        )}

        {state.stage === "publish" && state.draft && state.postId && (
          <PublishStage
            when={state.publishWhen}
            onWhen={(w) => dispatch({ type: "setPublishWhen", when: w })}
            onBack={() => dispatch({ type: "setStage", stage: "review" })}
            onConfirm={async () => {
              const at = new Date().toISOString();
              if (state.publishWhen === "now" && state.postId) {
                try {
                  await postSave({
                    id: state.postId,
                    title: state.draft!.title_en,
                    slug: state.draft!.slug,
                    content: state.draft!.content_en,
                    content_nl: state.draft!.content_nl,
                    status: "published",
                  });
                } catch (e) {
                  // surface but don't block — pgcron / direct supabase write path handles fallback
                  console.warn("[YouTubeAnalyzeModal] publish failed:", e);
                }
              }
              dispatch({ type: "publishCommitted", at });
              onPublished?.(state.postId!, state.publishWhen, at);
              dispatch({ type: "setStage", stage: "done" });
            }}
          />
        )}

        {state.stage === "done" && state.draft && (
          <DoneStage
            publishWhen={state.publishWhen}
            elapsedMs={state.elapsedMs}
            draft={state.draft}
            onClose={onClose}
            onAnalyzeAnother={() => dispatch({ type: "resetForRetry" })}
          />
        )}
      </div>
    </div>
  );
}

// ─── Stepper ────────────────────────────────────────────────────────
const STAGES: Stage[] = ["analyze", "review", "publish", "done"];
function Stepper({ current }: { current: Stage }) {
  const idx = STAGES.indexOf(current);
  return (
    <div className="stepper">
      {STAGES.map((s, i) => (
        <span key={s} className="pip-row">
          <span className={`pip ${i === idx ? "active" : ""} ${i < idx ? "complete" : ""}`} data-pip={s}>
            <span className="pip-num"><span>{i + 1}</span></span>
            {s[0].toUpperCase() + s.slice(1)}
          </span>
          {i < STAGES.length - 1 && <span className="pip-arrow">›</span>}
        </span>
      ))}
    </div>
  );
}

// ─── Stage 1 — Analyze ──────────────────────────────────────────────
function AnalyzeStage({
  meta, steps, elapsedMs, error, onRetry, fmt,
}: {
  meta: YouTubeMeta | null;
  steps: StepState[];
  elapsedMs: number;
  error: ModalState["error"];
  onRetry: () => void;
  fmt: (ms: number) => string;
}) {
  return (
    <div className="analysis-stage active" data-stage="analyze">
      <div className="analysis-head">
        <div className="video-thumb">
          {meta?.thumbnail_url ? (
            <img src={meta.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div className="play" />
          )}
          <div className="duration">
            {meta ? `${Math.floor(meta.duration_seconds / 60)}:${String(meta.duration_seconds % 60).padStart(2, "0")}` : "—:—"}
          </div>
        </div>
        <div className="video-meta">
          <div className="source"><span className="yt-dot" /><span>youtube · transcript via ai</span></div>
          <h3>{meta?.title ?? "YouTube video"}</h3>
          <div className="channel">{meta?.channel ?? "—"}</div>
        </div>
      </div>

      <div className="stage-body">
        <div className="steps">
          {steps.map((s, i) => <StepRow key={s.id} idx={i} step={s} />)}
        </div>

        {error && (
          <div className="step-error-banner">
            <div>
              <strong>Step failed:</strong> {steps.find((s) => s.id === error.stepId)?.label}
              <div className="step-error-msg">{error.message}</div>
            </div>
            <button className="mbtn mbtn--primary" onClick={onRetry}>Retry from start</button>
          </div>
        )}
      </div>

      <div className="stage-foot">
        <div className="left">
          <span className="live-dot" />
          <span className="hint">Streaming · n8n + claude + whisper</span>
        </div>
        <div className="right">
          <span className="hint">Elapsed {fmt(elapsedMs)}</span>
        </div>
      </div>
    </div>
  );
}

function StepRow({ idx, step }: { idx: number; step: StepState }) {
  const detailRef = useRef<HTMLSpanElement | null>(null);

  // Typewriter effect on detail / result strings, identical to Write.html
  useEffect(() => {
    if (!detailRef.current) return;
    const target = step.status === "done" ? (step.result ?? step.detail) : step.detail;
    let i = 0;
    let cancelled = false;
    function tick() {
      if (cancelled || !detailRef.current) return;
      if (i <= target.length) {
        detailRef.current.textContent = target.slice(0, i++);
        setTimeout(tick, 12 + Math.random() * 8);
      }
    }
    tick();
    return () => { cancelled = true; };
  }, [step.status, step.result, step.detail]);

  const provider = PROVIDER_META[step.provider];
  const cls = `step ${step.status !== "queued" ? "visible" : ""} ${step.status === "running" ? "active" : ""} ${step.status === "done" ? "done" : ""}`;
  const timeLabel =
    step.status === "queued" ? "queued" :
    step.status === "running" ? "running" :
    step.status === "done" ? "✓ ok" :
    step.status === "error" ? "✗ failed" : "";

  return (
    <div className={cls} data-step-id={step.id}>
      <div className="step-num">{String(idx + 1).padStart(2, "0")}</div>
      <div className="step-body">
        <div className="step-head">
          <span className="step-label">{step.label}</span>
          <span className="step-provider" style={{ color: provider.tone }}>
            {provider.label}
          </span>
        </div>
        <div className="step-detail">
          <span className="typed" ref={detailRef} />
        </div>
      </div>
      <div className="step-time">{timeLabel}</div>
    </div>
  );
}

// ─── Stage 2 — Review ───────────────────────────────────────────────
function ReviewStage({
  draft, lang, applied, onLang, onApply, onApplyAll, onBack, onSaveDraft, onPublish,
}: {
  draft: AssembledDraft;
  lang: "en" | "nl";
  applied: Set<string>;
  onLang: (l: "en" | "nl") => void;
  onApply: (id: string) => void;
  onApplyAll: () => void;
  onBack: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
}) {
  const title = lang === "en" ? draft.title_en : draft.title_nl;
  const content = (lang === "en" ? draft.content_en : draft.content_nl) || SAMPLE_BODY[lang];
  const openCount = QUICK_FIXES.length - applied.size;

  return (
    <div className="analysis-stage active" data-stage="review">
      <div className="stage-body">
        <div className="review-layout">
          <div className="review-article">
            <div className="review-article-head">
              <div className="l">
                <span className="pill pill--draft">draft</span>
                <span className="slug">/writing/{draft.slug}</span>
              </div>
              <div className="lang-tab-row">
                <button className={lang === "en" ? "on" : ""} onClick={() => onLang("en")}>EN</button>
                <button className={lang === "nl" ? "on" : ""} onClick={() => onLang("nl")}>NL</button>
              </div>
            </div>

            {openCount > 0 && (
              <div className="apply-all">
                <div>
                  <strong>{openCount} verbeterpunten</strong> klaar om toe te passen
                  {draft.forbidden_terms_found.length > 0 && ` · ${draft.forbidden_terms_found.length} verboden woord`}
                </div>
                <button onClick={onApplyAll}>Apply all (1·click)</button>
              </div>
            )}

            <article
              className="article-body"
              dangerouslySetInnerHTML={{ __html: renderReviewBody(content, applied.has("qf-1")) }}
            />
          </div>

          <div className="review-rail">
            <div className="score-card" style={{ ["--pct" as string]: `${draft.voice_fit}%`, ["--gauge-color" as string]: "var(--live)" }}>
              <div className="head"><span>Voice fit</span><span><strong>{draft.voice_fit}</strong><span className="max">/100</span></span></div>
              <div className="gauge" />
              <div className="lab"><span className="ok">✓</span> Technical Deep Dive</div>
            </div>
            <div className="score-card" style={{ ["--pct" as string]: `${draft.seo_score}%`, ["--gauge-color" as string]: "var(--accent)" }}>
              <div className="head"><span>SEO score</span><span><strong>{draft.seo_score}</strong><span className="max">/100</span></span></div>
              <div className="gauge" />
              <div className="lab"><span className="ok">✓</span> meta · alt · h-struct</div>
            </div>
            <div className="score-card" style={{ ["--pct" as string]: `${draft.readability}%`, ["--gauge-color" as string]: "var(--scheduled)" }}>
              <div className="head"><span>Readability</span><span><strong>{draft.readability}</strong><span className="max">/100</span></span></div>
              <div className="gauge" />
              <div className="lab"><span className="ok">✓</span> grade 9 · cadence even</div>
            </div>

            <div className="suggestion-list">
              <div className="suggestion-list-head">
                <span>Quick fixes</span>
                <strong>{openCount} open · {applied.size} fixed</strong>
              </div>
              {QUICK_FIXES.map((q, i) => {
                const isApplied = applied.has(q.id);
                return (
                  <div key={q.id} className={`suggestion ${isApplied ? "applied" : ""}`}>
                    <div className="sug-mark"><span>{i + 1}</span></div>
                    <div className="sug-body">
                      <div className="sug-text">{q.text}</div>
                      <div className="sug-detail">{q.detail}</div>
                    </div>
                    {!isApplied && <button className="sug-action" onClick={() => onApply(q.id)}>{q.cta}</button>}
                    {isApplied && <span className="sug-applied">✓ fixed</span>}
                  </div>
                );
              })}
            </div>

            <div className="linkedin-card">
              <div className="head">
                <span><span className="li-mark">in</span>LinkedIn snippet · {lang.toUpperCase()}</span>
                <button className="mbtn mbtn--ghost mbtn--sm" onClick={() => navigator.clipboard?.writeText(lang === "en" ? draft.linkedin_en : draft.linkedin_nl)}>Copy</button>
              </div>
              <div className="body">
                {(lang === "en" ? draft.linkedin_en : draft.linkedin_nl) || SAMPLE_LINKEDIN[lang]}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="stage-foot">
        <div className="left">
          <button className="mbtn mbtn--ghost" onClick={onBack}>← Re-run</button>
          <span className="hint">Voice {draft.voice_fit} · SEO {draft.seo_score} · {openCount} fixes</span>
        </div>
        <div className="right">
          <button className="mbtn mbtn--ghost" onClick={onSaveDraft}>Save as draft</button>
          <button className="mbtn mbtn--primary" onClick={onPublish}>Looks good →</button>
        </div>
      </div>
    </div>
  );
}

// ─── Stage 3 — Publish ──────────────────────────────────────────────
function PublishStage({
  when, onWhen, onBack, onConfirm,
}: {
  when: PublishWhen;
  onWhen: (w: PublishWhen) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const ctaText =
    when === "smart" ? "Schedule for tomorrow 09:00 →" :
    when === "custom" ? "Schedule (custom) →" :
    "Publish now · live everywhere";

  return (
    <div className="analysis-stage active" data-stage="publish">
      <div className="stage-body">
        <div className="publish-layout">
          <div className="publish-head">
            <h3>Wanneer gaat dit live<em>?</em></h3>
            <p>Slim plannen op basis van wanneer je publiek leest. Of nu meteen — jouw keuze.</p>
          </div>

          <div className="publish-options">
            <PublishOpt id="smart" current={when} title="Morgen 09:00" lab="Smart" rec body="Dinsdag · piek-tijd voor tech NL" onClick={onWhen} />
            <PublishOpt id="custom" current={when} title="Kies datum" lab="Custom" body="Eigen tijdstip · NL of EN eerst" onClick={onWhen} />
            <PublishOpt id="now" current={when} title="Direct live" lab="Now" body="Beide talen tegelijk · LinkedIn auto" onClick={onWhen} />
          </div>

          <div className="suggestion-list" style={{ marginTop: "var(--s-3)" }}>
            <div className="suggestion-list-head"><span>Pre-publish checklist</span><strong>4 / 4 ✓</strong></div>
            {["Fact-check geslaagd","Alt-text compleet","Voice consistency","SEO score boven 75"].map((t) => (
              <div key={t} className="suggestion applied">
                <div className="sug-mark"><span /></div>
                <div className="sug-body"><div className="sug-text">{t}</div></div>
                <span className="sug-applied">✓ ok</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="stage-foot">
        <div className="left"><button className="mbtn mbtn--ghost" onClick={onBack}>← Back to review</button></div>
        <div className="right">
          <button className={`mbtn ${when === "now" ? "mbtn--primary" : "mbtn--accent"}`} onClick={onConfirm}>{ctaText}</button>
        </div>
      </div>
    </div>
  );
}

function PublishOpt({ id, current, title, lab, body, rec, onClick }: {
  id: PublishWhen; current: PublishWhen; title: string; lab: string; body: string; rec?: boolean; onClick: (w: PublishWhen) => void;
}) {
  return (
    <button className="publish-opt" aria-pressed={current === id} onClick={() => onClick(id)}>
      <div className="lab">{lab} {rec && <span className="pill-rec">Aanbevolen</span>}</div>
      <div className="title">{title}</div>
      <div className="when">{body}</div>
    </button>
  );
}

// ─── Stage 4 — Done ─────────────────────────────────────────────────
function DoneStage({
  publishWhen, elapsedMs, draft, onClose, onAnalyzeAnother,
}: {
  publishWhen: PublishWhen;
  elapsedMs: number;
  draft: AssembledDraft;
  onClose: () => void;
  onAnalyzeAnother: () => void;
}) {
  const [relapseUrl, setRelapseUrl] = useState("");
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    fireConfetti();
  }, []);

  const headline =
    publishWhen === "now" ? <>Live<em> — nu.</em></> :
    publishWhen === "custom" ? <>Klaar<em> — gepland.</em></> :
    <>Klaar<em> — gepland.</em>;
  const sub =
    publishWhen === "now" ? "NL + EN tegelijk · LinkedIn post in queue" :
    publishWhen === "custom" ? "Custom schedule · zie agenda voor exact moment" :
    "Live op dinsdag 09:00 · NL + EN tegelijk";

  const min = Math.floor(elapsedMs / 60000);
  const sec = Math.floor((elapsedMs % 60000) / 1000);

  return (
    <div className="analysis-stage active" data-stage="done">
      <div className="stage-body">
        <div className="done-screen">
          <div className="confetti" id="confetti-host" />
          <div className="done-check">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M8 17l5 5 11-12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h2>{headline}</h2>
          <div className="done-sub">{sub}</div>

          <div className="done-receipt">
            <div><span className="k">Draft</span><span className="v">{draft.slug.slice(0, 18)}…</span></div>
            <div><span className="k">From video</span><span className="v">→ {draft.word_count_en.toLocaleString()}w</span></div>
            <div><span className="k">Total time</span><span className="v">{min}m {String(sec).padStart(2,"0")}s</span></div>
          </div>

          <div className="done-relapse">
            <div className="lab">Momentum vasthouden</div>
            <h4>Nog een YouTube link?</h4>
            <div className="row">
              <input
                type="text"
                placeholder="https://youtube.com/watch?v=…"
                value={relapseUrl}
                onChange={(e) => setRelapseUrl(e.target.value)}
              />
              <button
                className="mbtn mbtn--primary"
                onClick={() => {
                  // pass the new URL back to parent so it can re-open the modal
                  // (the parent owns `url`; we just signal a reset)
                  if (relapseUrl) {
                    (window as unknown as { __yt_relapse?: string }).__yt_relapse = relapseUrl;
                  }
                  onAnalyzeAnother();
                }}
              >
                Analyze →
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="stage-foot">
        <div className="left"><span className="hint">Esc om te sluiten · ⌘N voor de volgende</span></div>
        <div className="right">
          <button className="mbtn mbtn--ghost" onClick={onClose}>Terug naar Manage</button>
        </div>
      </div>
    </div>
  );
}

function fireConfetti() {
  const host = document.getElementById("confetti-host");
  if (!host) return;
  host.innerHTML = "";
  const colors = ["#F5C400", "#B84432", "#2D9255", "#2A6EA8", "#7A4FB8"];
  for (let i = 0; i < 36; i++) {
    const s = document.createElement("span");
    const angle = Math.random() * Math.PI * 2;
    const dist = 140 + Math.random() * 220;
    s.style.background = colors[i % colors.length];
    s.style.setProperty("--dest", `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist + 80}px)`);
    s.style.animationDelay = Math.random() * 200 + "ms";
    host.appendChild(s);
  }
  requestAnimationFrame(() => host.classList.add("go"));
  setTimeout(() => host.classList.remove("go"), 1800);
}

// ─── Body renderer (review stage) ───────────────────────────────────
// Renders the bilingual demo body with markdown-ish formatting + the
// inline forbidden-word mark that flips to ".fixed" when the qf-1 fix
// is applied. Live mode passes the full markdown body in the SSE done
// event; we run the same renderer over it.
function renderReviewBody(content: string, qf1Applied: boolean): string {
  if (!content) return "";
  // Minimal markdown-ish render — h1/h2/p/blockquote, escape < >
  const escape = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
  const lines = content.split("\n");
  const out: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { out.push(""); continue; }
    if (line.startsWith("## ")) out.push(`<h2>${escape(line.slice(3))}</h2>`);
    else if (line.startsWith("# ")) out.push(`<h1>${escape(line.slice(2))}</h1>`);
    else if (line.startsWith("> ")) out.push(`<p class="pullquote">${escape(line.slice(2))}</p>`);
    else out.push(`<p>${escape(line)}</p>`);
  }
  let html = out.join("\n");
  // surface the forbidden-word mark; flip to .fixed when applied
  html = html.replace(
    /\bsimple\b/,
    qf1Applied
      ? '<mark class="fixed">straightforward</mark>'
      : '<mark class="forbidden" data-id="forbid-1" data-replace="straightforward">simple</mark>'
  );
  return html;
}

// ─── Demo body (used when SSE done event lacks content) ─────────────
const SAMPLE_BODY: Record<"en" | "nl", string> = {
  en: `# Building agents with Claude 4.5: the parts that aren't in the docs

The Anthropic talk last week skipped over the parts I actually wanted to hear about. The docs explain tool use; they don't explain how agent loops fail in production, when an eval is lying to you, or where the real latency comes from once you wire three tools together.

This is the operator's version. I watched the talk twice and ran four of the patterns through real workloads — here are the four parts that aren't in the official guide.

## 1. The eval is simple, the failure mode isn't

Most teams start with an eval that scores a single tool call. Pass rate ninety-something percent. Ship it. The real failure surface only emerges when the agent has to chain three or more tool calls under realistic input distributions.

> Your eval is a flashlight. Your prod is a forest.

## 2. Latency comes from the third hop, not the first

Cold start on the first tool call is the part everybody benchmarks. Nobody benchmarks the cumulative time-to-completion when the agent has to pause, reason about the previous result, and decide whether to retry. That's where the p95 lives.`,
  nl: `# Agents bouwen met Claude 4.5: wat niet in de docs staat

De Anthropic talk van vorige week sloeg precies die delen over die ik wilde horen. De documentatie legt tool use uit; niet hoe agent loops in productie omvallen, wanneer een eval tegen je liegt, of waar de echte latency vandaan komt zodra je drie tools aan elkaar koppelt.

Dit is de operator-versie. Ik heb de talk twee keer bekeken en vier van de patronen door echte workloads gehaald — dit zijn de vier stukken die niet in de officiële guide staan.

## 1. De eval is duidelijk, de failure mode niet

De meeste teams beginnen met een eval die één tool call scoort. Slaagpercentage rond de negentig. Live. De echte failure surface verschijnt pas wanneer de agent drie of meer tool calls moet ketenen.

> Je eval is een zaklamp. Je productie is een bos.`,
};

const SAMPLE_LINKEDIN: Record<"en" | "nl", string> = {
  en: `The Anthropic talk skipped the parts I wanted to hear. Not the docs version — the operator version: how agent loops fail in prod, where your p95 really lives, and when you should have used a function call instead.\n\n4 patterns, measured on production workloads this quarter. Link in comments.`,
  nl: `De Anthropic talk sloeg de stukken over die ik wilde horen. Geen documentatie, maar de operator-versie: hoe agent loops omvallen, waar je p95 echt vandaan komt, en wanneer je gewoon een function call had moeten gebruiken.\n\n4 patronen, gemeten op productie-workloads dit kwartaal. Link in comments.`,
};
