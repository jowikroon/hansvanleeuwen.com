/**
 * FloatingToolbar — appears above any text selection inside the EN or NL
 * contenteditable. Wires up:
 *   - Bold / Italic              → document.execCommand (fine for now;
 *                                  TipTap will replace this in Phase C2)
 *   - Link                       → prompts for URL, wraps selection
 *   - H2                         → wraps selected text in <h2>
 *   - Quote                      → wraps in <p class="pullquote">
 *   - ✦ Tighten                  → calls /webhook/blog-tighten-selection
 *   - ↔ Translate                → calls /webhook/blog-translate-selection,
 *                                  to the OTHER language (nl ↔ en)
 *   - ❖ Template                 → placeholder hook for the future
 *                                  Template popover (Phase C3)
 *
 * Positioning: uses `window.getSelection().getRangeAt(0).getBoundingClientRect()`
 * and floats above the selection. Hides when no selection or selection is
 * collapsed.
 *
 * Voice template id flows through as context so the rewrite stays on-brand.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { tightenSelection, translateSelection } from "@/lib/blogApi";

interface Props {
  /** The two editor refs whose selections this toolbar serves. */
  enRef: React.RefObject<HTMLElement | null>;
  nlRef: React.RefObject<HTMLElement | null>;
  /** Voice template id — flows into the n8n calls as context. */
  voice_template_id: string | null;
  /** Called after Tighten/Translate so the parent can sync state + autosave. */
  onContentChanged: (whichLang: "en" | "nl") => void;
  /** Optional: open the template popover (Phase C3 — not wired yet). */
  onSaveAsTemplate?: (text: string) => void;
}

interface ToolbarState {
  visible: boolean;
  x: number;
  y: number;
  lang: "en" | "nl";
  range: Range | null;
}

const HIDDEN: ToolbarState = { visible: false, x: 0, y: 0, lang: "en", range: null };

export default function FloatingToolbar({ enRef, nlRef, voice_template_id, onContentChanged, onSaveAsTemplate }: Props) {
  const [state, setState] = useState<ToolbarState>(HIDDEN);
  const [busy, setBusy] = useState<null | "tighten" | "translate">(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  // Track selection across both editors.
  useEffect(() => {
    function update() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setState(HIDDEN);
        return;
      }
      const range = sel.getRangeAt(0);
      const node = range.commonAncestorContainer;
      const inEn = enRef.current?.contains(node) ?? false;
      const inNl = nlRef.current?.contains(node) ?? false;
      if (!inEn && !inNl) { setState(HIDDEN); return; }
      // Don't show on whitespace-only selection
      if ((sel.toString() ?? "").trim().length < 2) { setState(HIDDEN); return; }
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) { setState(HIDDEN); return; }
      const TOOLBAR_W = 460;
      const x = Math.max(8, Math.min(window.innerWidth - TOOLBAR_W - 8, rect.left + rect.width / 2 - TOOLBAR_W / 2));
      const y = Math.max(8, rect.top + window.scrollY - 48);
      setState({ visible: true, x, y, lang: inEn ? "en" : "nl", range: range.cloneRange() });
    }
    // Run on selection change + scroll
    document.addEventListener("selectionchange", update);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("scroll", update);
    };
  }, [enRef, nlRef]);

  // Click outside the toolbar = hide
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (toolbarRef.current?.contains(t)) return;
      // Don't hide if click is inside an editor (selection will refresh)
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  // Helper: get the current selection text + replace it with new HTML/text
  const getSelectedText = useCallback((): string => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return "";
    return sel.toString();
  }, []);

  const replaceSelectionText = useCallback((next: string, asHtml = false) => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    if (asHtml) {
      const wrap = document.createElement("div");
      wrap.innerHTML = next;
      const frag = document.createDocumentFragment();
      while (wrap.firstChild) frag.appendChild(wrap.firstChild);
      range.insertNode(frag);
    } else {
      range.insertNode(document.createTextNode(next));
    }
    sel.removeAllRanges();
  }, []);

  // The editor element that owns the current selection — used to fire `input`
  // so React state + autosave + the forbidden-word scanner all re-run.
  const targetEditor = state.lang === "en" ? enRef.current : nlRef.current;
  const fireInput = useCallback(() => {
    if (!targetEditor) return;
    targetEditor.dispatchEvent(new Event("input", { bubbles: true }));
    onContentChanged(state.lang);
  }, [targetEditor, state.lang, onContentChanged]);

  // ─── Action handlers ──────────────────────────────────────────────
  const onBold      = () => { document.execCommand("bold");   fireInput(); };
  const onItalic    = () => { document.execCommand("italic"); fireInput(); };
  const onLink      = () => {
    const url = window.prompt("Link URL", "https://");
    if (!url) return;
    document.execCommand("createLink", false, url);
    fireInput();
  };
  const onH2        = () => {
    const txt = getSelectedText();
    if (!txt) return;
    replaceSelectionText(`<h2>${escapeHtml(txt)}</h2>`, true);
    fireInput();
  };
  const onQuote     = () => {
    const txt = getSelectedText();
    if (!txt) return;
    replaceSelectionText(`<p class="pullquote">${escapeHtml(txt)}</p>`, true);
    fireInput();
  };

  const onTighten = async () => {
    const text = getSelectedText();
    if (!text || busy) return;
    setBusy("tighten");
    try {
      // Get a few sentences of surrounding context so the rewrite respects
      // tone + flow. We grab the parent block element's textContent.
      const paragraph = findParagraphText(state.range);
      const out = await tightenSelection({
        text,
        paragraph_context: paragraph,
        voice_template_id,
        intensity: "editor",
      });
      replaceSelectionText(out.text, false);
      fireInput();
    } catch (e) {
      // Quiet failure — leave the original text intact. The error is in
      // the console for the dev to inspect.
      console.warn("[FloatingToolbar] tighten failed:", e);
    } finally {
      setBusy(null);
      setState(HIDDEN);
    }
  };

  const onTranslate = async () => {
    const text = getSelectedText();
    if (!text || busy) return;
    setBusy("translate");
    try {
      const target = state.lang === "en" ? "nl" : "en";
      const out = await translateSelection({
        text,
        target_language: target,
        voice_template_id,
      });
      // Replace the selection in the SAME editor — semantic: "translate this
      // passage in place". The other-editor translation flow lives on the
      // paper header's Translate button, not here.
      replaceSelectionText(out.text, false);
      fireInput();
    } catch (e) {
      console.warn("[FloatingToolbar] translate failed:", e);
    } finally {
      setBusy(null);
      setState(HIDDEN);
    }
  };

  const onTemplate = () => {
    const text = getSelectedText();
    if (!text) return;
    onSaveAsTemplate?.(text);
  };

  if (!state.visible) return null;

  return (
    <div
      ref={toolbarRef}
      className="float-tools"
      role="toolbar"
      aria-label="Format selection"
      style={{
        position: "absolute",
        left: state.x,
        top: state.y,
        zIndex: 50,
      }}
      onMouseDown={(e) => e.preventDefault() /* keep selection alive */}
    >
      <button title="Bold (⌘B)" onClick={onBold}><strong>B</strong></button>
      <button title="Italic (⌘I)" onClick={onItalic}><em>i</em></button>
      <button title="Link" onClick={onLink}>
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <path d="M7 9l2-2M6 11l-2 2a2.5 2.5 0 11-3.5-3.5L3 7M10 5l2-2a2.5 2.5 0 113.5 3.5L13 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
      <span className="sep" />
      <button title="Heading" onClick={onH2}>H2</button>
      <button title="Pull quote" onClick={onQuote}>Quote</button>
      <span className="sep" />
      <button className="accent" onClick={onTighten} disabled={busy === "tighten"}>
        {busy === "tighten" ? "…" : "✦"} Tighten
      </button>
      <button className="accent" onClick={onTranslate} disabled={busy === "translate"}>
        {busy === "translate" ? "…" : "↔"} Translate{" "}
        <span className="float-tools-hint">→ {state.lang === "en" ? "NL" : "EN"}</span>
      </button>
      {onSaveAsTemplate && (
        <>
          <span className="sep" />
          <button className="accent" onClick={onTemplate}>❖ Template</button>
        </>
      )}
    </div>
  );
}

// ─── helpers ────────────────────────────────────────────────────────
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]!));
}

// Walk up from the selection's start container to find the enclosing
// block element. Return its textContent as paragraph context for Tighten.
function findParagraphText(range: Range | null): string {
  if (!range) return "";
  let node: Node | null = range.startContainer;
  while (node && node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
  while (node && node instanceof HTMLElement && !/^(P|H1|H2|H3|LI|BLOCKQUOTE)$/.test(node.tagName)) {
    node = node.parentNode;
  }
  if (node instanceof HTMLElement) return node.textContent ?? "";
  return "";
}
