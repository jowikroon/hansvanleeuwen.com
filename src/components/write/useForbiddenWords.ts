// Hook: live forbidden-word decoration over a contenteditable.
//
// Why a hook, not a TipTap extension: production Write.tsx uses a plain
// <div contentEditable> today. Migrating to TipTap is Phase C work. This
// gives us 80% of the UX (inline visual + click-to-fix) on the existing
// editor with zero rewrite.
//
// How it works:
//   1. On every editor input (debounced 150ms) we walk text nodes inside
//      the editor element.
//   2. For each text node, find forbidden words (case-insensitive, word
//      boundary aware) and split the node, wrapping each match in
//      <mark class="forbidden" data-replace="…">.
//   3. We *preserve the caret* across the DOM rewrite by tracking the
//      offset within the editor's plain-text content and restoring it
//      after.
//   4. Click on a <mark.forbidden> swaps the word for the replacement
//      and emits onApply so the parent can re-run the agent review.
//
// Limitations:
//   - Decorations are stored *in the saved HTML*. That's fine for our
//     storage (we save markdown anyway; the marks live only in the in-
//     memory DOM). htmlToContent() in Write.tsx already strips them.
//   - Words split across HTML boundaries (e.g. <b>sim</b>ple) are not
//     matched. This is rare and acceptable.

import { useEffect, useRef } from "react";

export interface ForbiddenWordSpec {
  word: string;
  replacement: string;
}

interface Opts {
  editorRef: React.RefObject<HTMLElement | null>;
  words: ForbiddenWordSpec[];
  enabled?: boolean;
  onApply?: (word: string, replacement: string) => void;
}

export function useForbiddenWords({ editorRef, words, enabled = true, onApply }: Opts) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onApplyRef = useRef(onApply);
  onApplyRef.current = onApply;

  useEffect(() => {
    const el = editorRef.current;
    if (!el || !enabled || words.length === 0) return;

    const decorate = () => {
      // 1. Strip existing decorations so we don't double-wrap.
      el.querySelectorAll<HTMLElement>("mark.forbidden").forEach((m) => {
        const t = document.createTextNode(m.textContent ?? "");
        m.replaceWith(t);
      });
      // After stripping, normalize so adjacent text nodes merge.
      el.normalize();

      // 2. Capture caret as plain-text offset.
      const sel = window.getSelection();
      const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
      let caretOffset = -1;
      if (range && el.contains(range.startContainer)) {
        const pre = document.createRange();
        pre.selectNodeContents(el);
        pre.setEnd(range.startContainer, range.startOffset);
        caretOffset = pre.toString().length;
      }

      // 3. Build a regex matching any forbidden word, word-boundary aware.
      const pattern = new RegExp(
        "\\b(" + words.map((w) => escapeRegex(w.word)).join("|") + ")\\b",
        "gi"
      );

      // 4. Walk text nodes, wrap matches.
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const targets: Text[] = [];
      let n: Node | null;
      while ((n = walker.nextNode())) {
        if (!n.textContent || !pattern.test(n.textContent)) { pattern.lastIndex = 0; continue; }
        pattern.lastIndex = 0;
        if ((n.parentElement?.closest("mark.forbidden, mark.fixed"))) continue;
        targets.push(n as Text);
      }
      for (const node of targets) {
        const text = node.textContent ?? "";
        const frag = document.createDocumentFragment();
        let lastIdx = 0;
        for (const match of text.matchAll(pattern)) {
          const idx = match.index ?? 0;
          if (idx > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
          const found = words.find((w) => w.word.toLowerCase() === match[0].toLowerCase());
          const mark = document.createElement("mark");
          mark.className = "forbidden";
          mark.textContent = match[0];
          if (found?.replacement) {
            mark.dataset.replace = found.replacement;
          }
          mark.title = found?.replacement
            ? `forbidden · click to replace with "${found.replacement}"`
            : "forbidden word";
          frag.appendChild(mark);
          lastIdx = idx + match[0].length;
        }
        if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
        node.replaceWith(frag);
      }

      // 5. Restore caret by walking back to the same plain-text offset.
      if (caretOffset >= 0) restoreCaret(el, caretOffset);
    };

    const onInput = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(decorate, 180);
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const mark = t.closest("mark.forbidden") as HTMLElement | null;
      if (!mark || !mark.dataset.replace) return;
      const original = mark.textContent ?? "";
      const replacement = mark.dataset.replace;
      const fixedNode = document.createElement("mark");
      fixedNode.className = "fixed";
      fixedNode.textContent = replacement;
      mark.replaceWith(fixedNode);
      // Drop the fixed-marker after 1.4s for a clean look
      setTimeout(() => {
        const t2 = document.createTextNode(replacement);
        fixedNode.replaceWith(t2);
        el.normalize();
      }, 1400);
      onApplyRef.current?.(original, replacement);
    };

    el.addEventListener("input", onInput);
    el.addEventListener("click", onClick);
    // Initial decoration (e.g. when the article is loaded from Supabase)
    decorate();

    return () => {
      el.removeEventListener("input", onInput);
      el.removeEventListener("click", onClick);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [editorRef, words, enabled]);
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function restoreCaret(root: HTMLElement, target: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  let offset = 0;
  while ((n = walker.nextNode())) {
    const len = (n.textContent ?? "").length;
    if (offset + len >= target) {
      const range = document.createRange();
      range.setStart(n, Math.max(0, target - offset));
      range.collapse(true);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      return;
    }
    offset += len;
  }
}
