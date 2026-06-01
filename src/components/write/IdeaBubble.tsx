// Floating "Idea" card pinned to the editor margin.
//
// Sources its content from /webhook/blog-init's narrative_history (recent
// claims + recurring themes for the post's category). Picks ONE item per
// load so the surface doesn't become noisy.
//
// Behavior:
//   - Fades in 1.2s after the editor mounts (so it doesn't fight with autosave/load chrome).
//   - "Add to draft" inserts at the current caret in whichever editor was
//     last focused (en or nl).
//   - Dismissed bubbles don't re-appear for the same draft + idea pair
//     within the session (sessionStorage).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { blogInit, type BlogInitOutput } from "@/lib/blogApi";

interface Props {
  category: string;
  draftId: string | null;
  // Called with the chosen idea text — parent inserts at caret.
  onInsert: (text: string) => void;
  /** Visibility flag — pass `view === 'write'` from the parent.
   *  When false, the bubble is silently suppressed and the dismiss/idea
   *  pipeline still runs. Defaults to true. */
  visible?: boolean;
}

const DISMISS_KEY = "hvl_idea_dismissed_v1";
const POS_KEY = "hvl_idea_bubble_pos";

export default function IdeaBubble({ category, draftId, onInsert, visible = true }: Props) {
  const [memory, setMemory] = useState<BlogInitOutput | null>(null);
  const [idea, setIdea] = useState<string | null>(null);
  const [show, setShow] = useState(false);
  const mountedAt = useRef(Date.now());

  // Load editorial memory for this category.
  useEffect(() => {
    let cancelled = false;
    blogInit({ category }).then((m) => {
      if (cancelled) return;
      setMemory(m);
    }).catch(() => { /* silently skip — idea bubble is optional UX */ });
    return () => { cancelled = true; };
  }, [category]);

  // Pick an idea once memory is loaded.
  const candidate = useMemo<string | null>(() => {
    if (!memory) return null;
    // Prefer recurring_claims (more actionable as an inline prompt),
    // fall back to a synthetic prompt from a recent narrative.
    const pool = [
      ...memory.recurring_claims.map((c) => `Build on a recurring thread you've explored: "${c}"`),
      ...memory.narrative_history.slice(0, 3).map((c) => `Your last take on this area went: "${c}". Consider the counter.`),
    ];
    if (pool.length === 0) return null;
    // Deterministic pick per draft so it doesn't flicker on re-mount
    const seed = (draftId ?? "x").split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    return pool[seed % pool.length];
  }, [memory, draftId]);

  // Dismiss-aware reveal.
  useEffect(() => {
    if (!candidate) return;
    const dismissed = readDismissed();
    const key = `${draftId ?? "new"}:${hash(candidate)}`;
    if (dismissed.has(key)) return;
    const t = setTimeout(() => {
      setIdea(candidate);
      setShow(true);
    }, Math.max(0, 1200 - (Date.now() - mountedAt.current)));
    return () => clearTimeout(t);
  }, [candidate, draftId]);

  const dismiss = useCallback(() => {
    if (!idea) return;
    const dismissed = readDismissed();
    dismissed.add(`${draftId ?? "new"}:${hash(idea)}`);
    writeDismissed(dismissed);
    setShow(false);
  }, [idea, draftId]);

  // ─── Drag-and-drop reposition ────────────────────────────────────
  // The bubble is position:fixed. The user grabs the header to drag.
  // Position persists to localStorage and overrides the CSS default.
  const bubbleRef = useRef<HTMLDivElement | null>(null);
  const [userPos, setUserPos] = useState<{ left: number; top: number } | null>(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; bx: number; by: number }>({
    active: false, sx: 0, sy: 0, bx: 0, by: 0,
  });

  const onHeadPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest(".idea-close")) return;
    const el = bubbleRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      active: true,
      sx: e.clientX, sy: e.clientY,
      bx: rect.left, by: rect.top,
    };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = dragRef.current;
      if (!d.active) return;
      const el = bubbleRef.current;
      if (!el) return;
      const W = window.innerWidth, H = window.innerHeight;
      const bw = el.offsetWidth || 280;
      const bh = el.offsetHeight || 140;
      const left = Math.max(8, Math.min(W - bw - 8, d.bx + (e.clientX - d.sx)));
      const top  = Math.max(64, Math.min(H - bh - 8, d.by + (e.clientY - d.sy)));
      el.style.left = left + "px";
      el.style.top = top + "px";
    }
    function onUp() {
      const d = dragRef.current;
      if (!d.active) return;
      d.active = false;
      const el = bubbleRef.current;
      if (!el) return;
      const next = { left: parseFloat(el.style.left) || 0, top: parseFloat(el.style.top) || 0 };
      setUserPos(next);
      try { localStorage.setItem(POS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, []);
  const resetPos = (e: React.MouseEvent) => {
    if (!e.shiftKey) return;
    setUserPos(null);
    try { localStorage.removeItem(POS_KEY); } catch { /* ignore */ }
    const el = bubbleRef.current;
    if (el) { el.style.left = ""; el.style.top = ""; }
  };

  const addToDraft = useCallback(() => {
    if (!idea) return;
    onInsert(idea);
    dismiss();
  }, [idea, dismiss, onInsert]);

  if (!show || !idea || !visible) return null;

  const style: React.CSSProperties = userPos
    ? { position: "fixed", left: userPos.left, top: userPos.top }
    : {};

  return (
    <div
      ref={bubbleRef}
      className="idea-bubble"
      role="complementary"
      aria-label="Editorial idea"
      style={style}
    >
      <div
        className="idea-head"
        onPointerDown={onHeadPointerDown}
        onDoubleClick={resetPos}
        style={{ cursor: "grab", userSelect: "none", touchAction: "none" }}
        title="Drag to move · Shift+double-click to reset"
      >
        <span className="lab">
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
            <path d="M6 1l1.4 3.3L11 5l-3.6.7L6 11l-1.4-5.3L1 5l3.6-.7z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
          </svg>
          Idea
        </span>
        <button className="idea-close" onClick={dismiss} aria-label="Dismiss">
          <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <div className="idea-what">{idea}</div>
      <button className="idea-add" onClick={addToDraft}>
        <span>Add to draft</span>
        <span className="arrow">→</span>
      </button>
    </div>
  );
}

function readDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function writeDismissed(set: Set<string>) {
  try { sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...set])); } catch { /* ignore */ }
}
function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h.toString(36);
}
