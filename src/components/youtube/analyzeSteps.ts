// The 10-step config for the YouTube analyze modal.
// Mirrors Write.html's ANALYSIS_STEPS array. Each step declares:
//   - id            stable id matching the SSE event id
//   - label         shown in bold in the step row
//   - detail        small grey line under the label (typed in first)
//   - provider      which AI provider runs this step (drives the badge colour)
//   - canRunClaude  whether window.claude.complete can substitute when the
//                   real n8n endpoint is unreachable (used in the standalone
//                   prototype only; in production this is always false because
//                   we route through n8n)
//
// In the production component the result string for each step comes from the
// SSE event payload, not from this config — the mock results below are only
// used by the demo fallback in blogApi.ts.

import type { AnalyzeStepId } from "@/lib/blogApi";

export type Provider = "n8n" | "claude" | "openai" | "gemini" | "internal";

export interface AnalysisStep {
  id: AnalyzeStepId;
  label: string;
  detail: string;
  provider: Provider;
}

export const ANALYSIS_STEPS: AnalysisStep[] = [
  { id: "fetch_meta",  label: "Fetching video metadata",      detail: "title · channel · duration · published · thumbnails",                provider: "n8n" },
  { id: "transcript",  label: "Extracting transcript",        detail: "whisper-large-v3 · 24 min audio · streaming",                        provider: "gemini" },
  { id: "topics",      label: "Identifying key topics",       detail: "embedding clusters · topic modelling · novelty score",               provider: "openai" },
  { id: "voice_match", label: "Matching voice template",      detail: "compared against your saved voices · scoring fit",                   provider: "claude" },
  { id: "beats",       label: "Extracting structural beats",  detail: "problem → state → solution → tradeoffs (your default arc)",          provider: "claude" },
  { id: "draft_en",    label: "Drafting in English",          detail: "claude-sonnet-4-5 · target readability 60–70 · 1,000–1,400w",        provider: "claude" },
  { id: "draft_nl",    label: "Drafting in Dutch",            detail: "vertaling met behoud van stem · technische termen in EN",            provider: "claude" },
  { id: "seo",         label: "Scoring SEO + readability",    detail: "primary keyword · meta · h-structure · alt-text · interne links",    provider: "claude" },
  { id: "linkedin",    label: "Generating LinkedIn snippets", detail: "EN + NL · max 1,300 chars · hook-driven · zero hashtags",            provider: "openai" },
  { id: "save",        label: "Saving as Draft",              detail: "supabase · hvl_blog_articles insert · editorial_stage=drafted",     provider: "n8n" },
];

export const PROVIDER_META: Record<Provider, { label: string; tone: string }> = {
  claude:   { label: "Claude",   tone: "var(--draft)" },
  openai:   { label: "OpenAI",   tone: "var(--live)" },
  gemini:   { label: "Gemini",   tone: "var(--scheduled)" },
  n8n:      { label: "n8n",      tone: "var(--review)" },
  internal: { label: "Internal", tone: "var(--ink-2)" },
};
