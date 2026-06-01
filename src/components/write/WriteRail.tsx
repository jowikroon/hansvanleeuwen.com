// The right-rail inspector for the Write view.
//
// Replaces the static placeholder rail in Write.tsx with a real inspector that
// surfaces every piece of intelligence the agent-review webhook returns:
//
//   1. Voice card     ← from hvl_voice_templates + review.dimensions
//   2. 3 score cards  ← from review.dimensions (voice / seo / readability)
//   3. 4 writing tips ← from review.dimensions[*].suggestions, categorised
//   4. Outline        ← from headings extracted in the parent (passed as prop)
//   5. Suggestion drawer (right side) — opens when a score card is clicked
//
// No new backend needed. Everything below sources from the existing
// /webhook/blog-agent-review response that Write.tsx already triggers via
// `handleReview`. Once the user clicks Review, the rail comes to life.

import { useEffect, useMemo, useState } from "react";
import type { ReviewOutput } from "@/lib/blogApi";
import { loadVoiceTemplate, resolveReplacement, type VoiceTemplate } from "@/lib/voiceTemplates";

interface OutlineHeading { level: 1 | 2; text: string }

interface Props {
  review: ReviewOutput | null;
  reviewing: boolean;
  voice_template_id: string | null;
  outline: OutlineHeading[];
  forbiddenHits: string[];                            // distinct forbidden words *currently in the doc*
  onRunReview: () => void;
  onApplySuggestion: (dimName: string, suggestion: string) => void;
  onSelectScoreCard?: (dim: "voice" | "seo" | "readability") => void;
}

interface CategorizedTip {
  category: "tone" | "seo" | "linking" | "factcheck";
  title: string;
  detail: string;
  impact: string;        // small-text right-side label, e.g. "+12% CTR"
  cta: string;
  dimensionName: string;
  suggestionText: string;
  why: string;
}

const CATEGORY_META: Record<CategorizedTip["category"], { tag: string; impact: string }> = {
  tone:      { tag: "Tone · word choice",     impact: "Trust · 50ms" },
  seo:       { tag: "SEO · meta description", impact: "+12% CTR" },
  linking:   { tag: "Linking · internal",     impact: "+34s on page" },
  factcheck: { tag: "Fact-check · sourcing",  impact: "Credibility" },
};

const WHY_COPY: Record<CategorizedTip["category"], string> = {
  tone:      "Readers form a personality impression in ~50ms. Filler adjectives register as low-effort writing. Precise verbs build trust faster than confident claims do.",
  seo:       "Search results show 155–280 chars under your title. Without a meta line Google scrapes a random first sentence — usually weak. Hand-crafted metas earn +8–15% click-through on the same ranking position.",
  linking:   "A reader who clicks an internal link stays ~34s longer and is 3× more likely to subscribe. Google reads these as topical authority signals. Aim for 2–4 per post — more becomes noise, fewer leaves traffic on the table.",
  factcheck: "Specific numbers without a source get challenged in comments and dismissed by skilled readers. The same claim with a footnote becomes evidence — and Google's E-E-A-T treats cited content ~+20% better than unsourced.",
};

export default function WriteRail({
  review, reviewing, voice_template_id, outline, forbiddenHits,
  onRunReview, onApplySuggestion, onSelectScoreCard,
}: Props) {
  const [voice, setVoice] = useState<VoiceTemplate | null>(null);
  const [openCard, setOpenCard] = useState<"voice" | "seo" | "readability" | null>(null);
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(new Set());

  // Load voice template once for the current draft.
  useEffect(() => {
    if (!voice_template_id) { setVoice(null); return; }
    let cancelled = false;
    loadVoiceTemplate(voice_template_id).then((v) => { if (!cancelled) setVoice(v); });
    return () => { cancelled = true; };
  }, [voice_template_id]);

  // Pull scores out of the review dimensions.
  const findDim = (needle: string) =>
    review?.dimensions.find((d) => d.name.toLowerCase().includes(needle));
  const voiceDim = findDim("voice") ?? findDim("style") ?? findDim("tone");
  const seoDim = findDim("seo") ?? findDim("findability") ?? findDim("keyword");
  const readDim = findDim("read") ?? findDim("clarity") ?? findDim("flow");

  // Build the 4 categorised writing tip cards from review.dimensions[*].suggestions.
  // If review hasn't run yet, we surface "Run review to populate" stubs.
  const tips = useMemo<CategorizedTip[]>(() => {
    if (!review) return [];
    const out: CategorizedTip[] = [];
    const pick = (cat: CategorizedTip["category"], match: (d: typeof review.dimensions[0]) => boolean) => {
      const dim = review.dimensions.find(match);
      if (!dim || !dim.suggestions.length) return;
      const first = dim.suggestions[0];
      out.push({
        category: cat,
        title: first,
        detail: dim.feedback,
        impact: CATEGORY_META[cat].impact,
        cta: cat === "tone" ? "Apply" : cat === "seo" ? "Generate" : cat === "linking" ? "Insert link" : "Add source",
        dimensionName: dim.name,
        suggestionText: first,
        why: WHY_COPY[cat],
      });
    };
    pick("tone",      (d) => /tone|voice|style|word/i.test(d.name));
    pick("seo",       (d) => /seo|meta|keyword/i.test(d.name));
    pick("linking",   (d) => /link|internal/i.test(d.name));
    pick("factcheck", (d) => /fact|source|cit/i.test(d.name));
    // If review didn't yield 4 dimensions, top up with banned-word tip.
    if (out.length < 4 && forbiddenHits.length > 0) {
      const hit = forbiddenHits[0];
      const replacement = resolveReplacement(hit) || "—";
      out.push({
        category: "tone",
        title: `"${hit}" → "${replacement}"`,
        detail: `Banned word in voice template "${voice?.name ?? "Technical Deep Dive"}".`,
        impact: CATEGORY_META.tone.impact,
        cta: "Apply",
        dimensionName: "voice",
        suggestionText: `Replace ${hit} with ${replacement}`,
        why: WHY_COPY.tone,
      });
    }
    return out;
  }, [review, forbiddenHits, voice]);

  const apply = (tip: CategorizedTip) => {
    onApplySuggestion(tip.dimensionName, tip.suggestionText);
    setAppliedKeys((s) => new Set([...s, keyOf(tip)]));
  };

  const totalScore = review?.total_score ?? null;
  const publishReady = review?.publish_ready ?? false;

  return (
    <aside className="rail" aria-label="Inspector">
      <h2 className="rail-h">Editors <em>at work</em></h2>

      {/* Voice template card */}
      <div className="card voice-card">
        <div className="card-head">
          <span className="label-icon">Writing style</span>
          <span style={{ cursor: "pointer", opacity: 0.6 }}>change</span>
        </div>
        <div className="name">
          {voice ? (
            <>
              {voice.name.split(" ").slice(0, -1).join(" ")} <em>{voice.name.split(" ").slice(-1)[0]}</em>
              {voice.is_default && <span className="voice-default-tag">default</span>}
            </>
          ) : <em>No voice template set</em>}
        </div>
        {voice && (
          <div className="voice-meta-row">
            {voice.tone && <span className="voice-meta-pill" title="Tone">{voice.tone.split(",")[0].trim()}</span>}
            {voice.target_audience && (
              <span className="voice-meta-pill subtle" title="Audience">→ {voice.target_audience.slice(0, 24)}{voice.target_audience.length > 24 ? "…" : ""}</span>
            )}
          </div>
        )}
        <div className="fit">
          {!review && "Click Review to score"}
          {review && voiceDim && (
            <>
              {publishReady ? `✓ ${voiceDim.score}% fit` : `${voiceDim.score}% fit`}
              {forbiddenHits.length > 0 && (
                <> · <span className="warn">⚠ {forbiddenHits.length} violation{forbiddenHits.length === 1 ? "" : "s"}</span></>
              )}
            </>
          )}
        </div>
        {voice && voice.banned_words.length > 0 && (
          <div className="forbidden-chip-row">
            {voice.banned_words.slice(0, 8).map((w) => {
              const flagged = forbiddenHits.includes(w.toLowerCase());
              return (
                <span key={w} className={`forbidden-chip ${flagged ? "hit" : ""}`} title={flagged ? "Found in your draft" : "Banned — not in draft"}>
                  {w}
                </span>
              );
            })}
            {voice.banned_words.length > 8 && (
              <span className="forbidden-chip more">+{voice.banned_words.length - 8}</span>
            )}
          </div>
        )}
        {voice && voice.required_elements.length > 0 && (
          <div className="voice-required-row">
            <span className="voice-required-label">Required:</span>
            {voice.required_elements.slice(0, 3).map((r) => (
              <span key={r} className="voice-required-pill">{r}</span>
            ))}
            {voice.required_elements.length > 3 && (
              <span className="voice-required-pill more">+{voice.required_elements.length - 3}</span>
            )}
          </div>
        )}
      </div>

      {/* 3 score cards */}
      <ScoreCard
        label="Sounds like you" sub={voiceDim?.feedback}
        score={voiceDim?.score} gauge="var(--live)"
        active={openCard === "voice"}
        onClick={() => { setOpenCard(openCard === "voice" ? null : "voice"); onSelectScoreCard?.("voice"); }}
      />
      <ScoreCard
        label="Will people find it" sub={seoDim?.feedback}
        score={seoDim?.score} gauge="var(--accent)"
        active={openCard === "seo"}
        onClick={() => { setOpenCard(openCard === "seo" ? null : "seo"); onSelectScoreCard?.("seo"); }}
      />
      <ScoreCard
        label="Easy to read" sub={readDim?.feedback}
        score={readDim?.score} gauge="var(--scheduled)"
        active={openCard === "readability"}
        onClick={() => { setOpenCard(openCard === "readability" ? null : "readability"); onSelectScoreCard?.("readability"); }}
      />

      {/* Run review CTA when no review yet */}
      {!review && (
        <button className="rail-run-review" onClick={onRunReview} disabled={reviewing}>
          {reviewing ? "Reviewing…" : "Run review →"}
        </button>
      )}

      {/* Writing tips */}
      {tips.length > 0 && (
        <>
          <div className="rail-sub"><span><strong>{tips.length}</strong> writing tips</span></div>
          <div className="tips-stack">
            {tips.map((tip) => (
              <TipCard
                key={keyOf(tip)}
                tip={tip}
                applied={appliedKeys.has(keyOf(tip))}
                onApply={() => apply(tip)}
              />
            ))}
          </div>
        </>
      )}

      {/* Outline */}
      <div className="rail-sub"><span><strong>Outline</strong></span></div>
      <div className="outline-list">
        {outline.length === 0 && (
          <div className="outline-item"><span className="n">—</span>Start with ## headings</div>
        )}
        {outline.map((h, i) => (
          <div key={i} className={`outline-item ${h.level === 1 ? "active" : ""}`}>
            <span className="n">{String(i).padStart(2, "0")}</span>{h.text}
          </div>
        ))}
      </div>

      {/* Suggestion drawer — opens to the LEFT of the rail when a score card is selected */}
      {openCard && review && (
        <SuggestionDrawer
          dim={openCard}
          review={review}
          onClose={() => setOpenCard(null)}
          onApply={(suggestion, dimName) => {
            onApplySuggestion(dimName, suggestion);
            setAppliedKeys((s) => new Set([...s, `dim:${dimName}:${suggestion}`]));
          }}
          applied={appliedKeys}
        />
      )}

      {totalScore != null && (
        <div className="rail-foot">
          <span>Overall <strong>{totalScore}</strong>/100</span>
          {publishReady && <span className="ok">✓ publish ready</span>}
        </div>
      )}
    </aside>
  );
}

// ─── Score card ─────────────────────────────────────────────────────
function ScoreCard({
  label, sub, score, gauge, active, onClick,
}: {
  label: string; sub?: string; score?: number; gauge: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      className={`card score-card-clickable ${active ? "active" : ""}`}
      style={{ ["--pct" as string]: `${score ?? 0}%`, ["--gauge-color" as string]: gauge }}
      onClick={onClick}
    >
      <div className="score-row">
        <span>{label}</span>
        <span><strong>{score ?? "—"}</strong><span className="max">/100</span></span>
      </div>
      <div className="gauge" />
      <div className="sub">{sub ?? "run review to score"}</div>
    </button>
  );
}

// ─── Tip card ───────────────────────────────────────────────────────
function TipCard({ tip, applied, onApply }: { tip: CategorizedTip; applied: boolean; onApply: () => void }) {
  const [open, setOpen] = useState(false);
  const meta = CATEGORY_META[tip.category];
  return (
    <div className={`tip-card ${tip.category} ${applied ? "applied" : ""}`} tabIndex={0} role="button">
      <button
        className="tip-row"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{ width: "100%", textAlign: "left", background: "transparent", border: 0, cursor: "pointer" }}
      >
        <span className="tip-tag">{meta.tag}</span>
        <span className="tip-impact"><strong>{tip.impact.split(" · ")[0]}</strong>{tip.impact.includes(" · ") ? <> · {tip.impact.split(" · ")[1]}</> : null}</span>
      </button>
      <h4 className="tip-headline">{tip.title}</h4>
      {open && (
        <div className="tip-why">
          <div className="tip-why-head">Why this matters</div>
          <div className="tip-why-body">{tip.why}</div>
          <div className="tip-detail">{tip.detail}</div>
          <div className="tip-actions">
            {applied ? (
              <span className="tip-applied">✓ applied</span>
            ) : (
              <>
                <button className="tip-apply" onClick={onApply}>{tip.cta} <span className="arrow">→</span></button>
                <button className="tip-later" onClick={() => setOpen(false)}>Later</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Suggestion drawer ──────────────────────────────────────────────
function SuggestionDrawer({
  dim, review, onClose, onApply, applied,
}: {
  dim: "voice" | "seo" | "readability";
  review: ReviewOutput;
  onClose: () => void;
  onApply: (suggestion: string, dimName: string) => void;
  applied: Set<string>;
}) {
  const match = (d: typeof review.dimensions[0]) =>
    dim === "voice" ? /voice|style|tone|word/i.test(d.name) :
    dim === "seo" ? /seo|find|keyword|meta/i.test(d.name) :
    /read|clarity|flow/i.test(d.name);
  const dims = review.dimensions.filter(match);
  if (dims.length === 0) {
    return (
      <div className="drawer-floating">
        <div className="drawer-head">
          <strong>No suggestions for this dimension</strong>
          <button onClick={onClose} aria-label="Close">×</button>
        </div>
      </div>
    );
  }
  const title =
    dim === "voice" ? "Voice fit." :
    dim === "seo" ? "Will people find it." :
    "Easy to read.";
  const allSugs = dims.flatMap((d) => d.suggestions.map((s) => ({ name: d.name, text: s })));
  return (
    <div className="drawer-floating" role="dialog" aria-label="Suggestions">
      <div className="drawer-head">
        <strong>{title}</strong>
        <button className="drawer-close" onClick={onClose} aria-label="Close">×</button>
      </div>
      <div className="drawer-body">
        {allSugs.map((s, i) => {
          const key = `dim:${s.name}:${s.text}`;
          const isApplied = applied.has(key);
          return (
            <div key={i} className={`drawer-suggestion ${isApplied ? "applied" : ""}`}>
              <div className="drawer-suggestion-text">{s.text}</div>
              <div className="drawer-suggestion-meta">{s.name}</div>
              {!isApplied && (
                <button className="drawer-apply" onClick={() => onApply(s.text, s.name)}>Apply</button>
              )}
              {isApplied && <span className="drawer-applied">✓ applied</span>}
            </div>
          );
        })}
      </div>
      <div className="drawer-foot">
        <button
          className="drawer-apply-all"
          onClick={() => {
            for (const s of allSugs) {
              const key = `dim:${s.name}:${s.text}`;
              if (!applied.has(key)) onApply(s.text, s.name);
            }
          }}
        >Apply all →</button>
      </div>
    </div>
  );
}

function keyOf(tip: CategorizedTip) {
  return `${tip.category}:${tip.dimensionName}:${tip.suggestionText}`;
}
