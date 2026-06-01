/**
 * VoicePage — the 4th menu item after Write / Manage / Analytics.
 *
 * Full CRUD editor for hvl_voice_templates. Surfaces *all* 12 columns
 * of the production schema (see src/lib/voiceTemplates.ts for the shape).
 * Left rail: voice list with "+ New voice" and per-row default badge.
 * Right pane: form with every field, save / delete / set-default.
 *
 * This replaces the read-only voice tab in the legacy BlogManager.tsx,
 * adds chip-style inputs for banned_words + required_elements, and adds
 * add/remove for opening_examples + closing_examples.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EMPTY_VOICE,
  deleteVoiceTemplate,
  listVoiceTemplates,
  saveVoiceTemplate,
  setDefaultVoiceTemplate,
  type VoiceTemplate,
  type NewVoiceTemplate,
} from "@/lib/voiceTemplates";

import "@/styles/voice-page.css";

type Editing = VoiceTemplate | (NewVoiceTemplate & { id?: string });

const CATEGORIES = ["tech", "professional", "personal", "marketplace", "ai"] as const;

export default function VoicePage() {
  const [voices, setVoices] = useState<VoiceTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const showToast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 2400);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await listVoiceTemplates();
    setVoices(list);
    setLoading(false);
    return list;
  }, []);

  useEffect(() => { reload().then((l) => { if (l.length && !editing) setEditing(l[0]); }); /* eslint-disable-next-line */ }, []);

  const select = (v: VoiceTemplate) => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setEditing(v);
    setDirty(false);
  };

  const createNew = () => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setEditing({ ...EMPTY_VOICE });
    setDirty(true);
  };

  const onField = <K extends keyof Editing>(key: K, value: Editing[K]) => {
    if (!editing) return;
    setEditing({ ...editing, [key]: value });
    setDirty(true);
  };

  const save = async () => {
    if (!editing || !editing.name.trim()) {
      showToast("Name is required", "err");
      return;
    }
    setSaving(true);
    try {
      const saved = await saveVoiceTemplate(editing);
      const list = await reload();
      const target = list.find((v) => v.id === saved.id) ?? saved;
      setEditing(target);
      setDirty(false);
      showToast("Voice saved");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed", "err");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!editing || !("id" in editing) || !editing.id) return;
    if (!confirm(`Delete "${editing.name}" — this can't be undone.`)) return;
    try {
      await deleteVoiceTemplate(editing.id);
      const list = await reload();
      setEditing(list[0] ?? null);
      setDirty(false);
      showToast("Voice deleted");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Delete failed", "err");
    }
  };

  const makeDefault = async () => {
    if (!editing || !("id" in editing) || !editing.id) return;
    try {
      await setDefaultVoiceTemplate(editing.id);
      const list = await reload();
      const me = list.find((v) => v.id === editing.id);
      if (me) setEditing(me);
      showToast(`"${editing.name}" is now the default voice`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Update failed", "err");
    }
  };

  return (
    <main className="main voice-main">
      <header className="voice-header">
        <h1 className="manage-h">Voice<em>.</em></h1>
        <div className="manage-stats">
          <strong>{voices.length}</strong> {voices.length === 1 ? "template" : "templates"}
          <span className="sep">·</span>
          <strong>{voices.find((v) => v.is_default)?.name ?? "no default"}</strong> as default
        </div>
      </header>

      <div className="voice-shell">
        <aside className="voice-list" aria-label="Voice templates">
          <button className="voice-list-new" onClick={createNew}>
            <span>+ New voice</span>
            <span className="kbd">⌘N</span>
          </button>

          {loading && <div className="voice-list-empty">Loading…</div>}
          {!loading && voices.length === 0 && (
            <div className="voice-list-empty">No voices yet. Create one →</div>
          )}

          {voices.map((v) => {
            const isActive = editing && "id" in editing && editing.id === v.id;
            return (
              <button
                key={v.id}
                className={`voice-list-row ${isActive ? "active" : ""}`}
                onClick={() => select(v)}
              >
                <div className="voice-list-row-head">
                  <span className="voice-list-row-name">{v.name}</span>
                  {v.is_default && <span className="voice-default-tag">default</span>}
                </div>
                <div className="voice-list-row-meta">
                  <span className="voice-list-row-cat">{v.category}</span>
                  <span className="sep">·</span>
                  <span>{v.banned_words.length} banned</span>
                  <span className="sep">·</span>
                  <span>{v.required_elements.length} required</span>
                </div>
              </button>
            );
          })}
        </aside>

        <section className="voice-editor" aria-label="Voice editor">
          {!editing && (
            <div className="voice-empty">
              <p>Pick a voice on the left, or click <strong>+ New voice</strong> to build one.</p>
            </div>
          )}

          {editing && (
            <VoiceForm
              editing={editing}
              onField={onField}
              onSave={save}
              onDelete={remove}
              onMakeDefault={makeDefault}
              saving={saving}
              dirty={dirty}
            />
          )}
        </section>
      </div>

      {toast && (
        <div className={`toast ${toast.kind === "err" ? "error" : ""}`}>{toast.msg}</div>
      )}
    </main>
  );
}

// ─── Voice form ────────────────────────────────────────────────────
function VoiceForm({
  editing, onField, onSave, onDelete, onMakeDefault, saving, dirty,
}: {
  editing: Editing;
  onField: <K extends keyof Editing>(k: K, v: Editing[K]) => void;
  onSave: () => void;
  onDelete: () => void;
  onMakeDefault: () => void;
  saving: boolean;
  dirty: boolean;
}) {
  const isNew = !("id" in editing) || !editing.id;
  const canDefault = !isNew && !editing.is_default;

  // ⌘S to save
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        if (dirty) onSave();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [dirty, onSave]);

  return (
    <>
      <div className="voice-form-top">
        <div className="voice-form-titleblock">
          <span className="voice-eyebrow">{isNew ? "New voice" : "Editing voice"}</span>
          <input
            className="voice-form-name"
            type="text"
            placeholder="Voice name (e.g. Technical Deep Dive)"
            value={editing.name}
            onChange={(e) => onField("name", e.target.value)}
            autoFocus={isNew}
          />
        </div>
        <div className="voice-form-actions">
          {canDefault && (
            <button className="vbtn vbtn--ghost" onClick={onMakeDefault} title="Make this the default voice">
              Make default
            </button>
          )}
          {!isNew && (
            <button className="vbtn vbtn--danger" onClick={onDelete} title="Delete voice">
              Delete
            </button>
          )}
          <button
            className={`vbtn vbtn--primary ${dirty ? "" : "disabled"}`}
            onClick={onSave}
            disabled={!dirty || saving}
          >
            {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            <span className="kbd">⌘S</span>
          </button>
        </div>
      </div>

      <div className="voice-form-grid">
        {/* Category + default toggle */}
        <Field label="Category" help="Which kind of writing this voice is for.">
          <div className="voice-chips">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                className={`voice-chip ${editing.category === c ? "on" : ""}`}
                onClick={() => onField("category", c)}
              >
                {c}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Default voice" help="Used when an article has no voice_template_id set.">
          <label className="voice-toggle">
            <input
              type="checkbox"
              checked={editing.is_default}
              onChange={(e) => onField("is_default", e.target.checked)}
            />
            <span>{editing.is_default ? "Default" : "Not default"}</span>
          </label>
        </Field>

        {/* Tone, perspective, audience, style — the soul of the voice */}
        <Field
          label="Tone"
          help="Short comma-separated personality. e.g. calm, opinionated, no-nonsense."
          full
        >
          <textarea
            rows={2}
            value={editing.tone}
            onChange={(e) => onField("tone", e.target.value)}
            placeholder="calm, opinionated, no-nonsense"
          />
        </Field>

        <Field label="Perspective" help="Where the writer stands relative to the reader.">
          <textarea
            rows={2}
            value={editing.perspective}
            onChange={(e) => onField("perspective", e.target.value)}
            placeholder="first-person operator, technical equals"
          />
        </Field>

        <Field label="Target audience" help="Who you're writing for, specifically.">
          <textarea
            rows={2}
            value={editing.target_audience}
            onChange={(e) => onField("target_audience", e.target.value)}
            placeholder="senior engineers running real workloads, not curious novices"
          />
        </Field>

        <Field
          label="Writing style"
          help="The longest, most prescriptive field. Sentence rhythm, structure, what to do, what to avoid."
          full
        >
          <textarea
            rows={6}
            value={editing.writing_style}
            onChange={(e) => onField("writing_style", e.target.value)}
            placeholder={`Short opener. Numbered structure for lists. Pull-quote every ~400 words.\nConcrete numbers, real examples, dated observations ("Q1 2026").\nA craftsman explaining their work, not a marketer selling a service.`}
          />
        </Field>

        {/* Banned words — chip input */}
        <Field
          label="Banned words"
          help="Inline marks light up in red when these appear in the draft. Click-to-fix uses default replacements."
          full
        >
          <ChipInput
            values={editing.banned_words}
            onChange={(v) => onField("banned_words", v)}
            placeholder="Type a word, press Enter or comma"
            lowercaseOnAdd
          />
        </Field>

        {/* Required elements */}
        <Field
          label="Required elements"
          help="Every article in this voice should contain each of these (e.g. concrete example, numbered list ≥ 4, pull-quote)."
          full
        >
          <ChipInput
            values={editing.required_elements}
            onChange={(v) => onField("required_elements", v)}
            placeholder="Type an element, press Enter"
          />
        </Field>

        {/* Content rules — long form */}
        <Field
          label="Content rules"
          help="Free-form rule sheet. The agent-review prompt includes this verbatim. Be specific."
          full
        >
          <textarea
            className="voice-rules"
            rows={10}
            value={editing.content_rules}
            onChange={(e) => onField("content_rules", e.target.value)}
            placeholder={`# Hard rules\n- No filler adjectives ("simple", "easy", "just")\n- Pull-quote every ~400 words\n- Cite concrete numbers with date + source\n\n# Cadence\n- Short opening sentence\n- Numbered structure on lists\n- A craftsman explaining their work, not a marketer\n\n# Forbidden phrases\n- "in today's world", "the future is", "leverage" (as verb)`}
          />
        </Field>

        {/* Opening + closing examples */}
        <Field
          label="Opening examples"
          help="2–4 example opening sentences. Used as few-shot anchors when drafting."
          full
        >
          <ExampleList
            values={editing.opening_examples}
            onChange={(v) => onField("opening_examples", v)}
            placeholder="An opening that sounds like you…"
          />
        </Field>

        <Field
          label="Closing examples"
          help="2–4 example closing sentences. Same use as openings — anchor the model on your endings."
          full
        >
          <ExampleList
            values={editing.closing_examples}
            onChange={(v) => onField("closing_examples", v)}
            placeholder="A closing that lands like yours…"
          />
        </Field>
      </div>
    </>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────
function Field({ label, help, full, children }: { label: string; help?: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`voice-field ${full ? "full" : ""}`}>
      <label className="voice-field-label">{label}</label>
      {help && <div className="voice-field-help">{help}</div>}
      <div className="voice-field-input">{children}</div>
    </div>
  );
}

// ─── Chip input ────────────────────────────────────────────────────
function ChipInput({
  values, onChange, placeholder, lowercaseOnAdd,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  lowercaseOnAdd?: boolean;
}) {
  const [input, setInput] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);

  const add = (raw: string) => {
    let v = raw.trim();
    if (!v) return;
    if (lowercaseOnAdd) v = v.toLowerCase();
    if (values.includes(v)) return;
    onChange([...values, v]);
    setInput("");
  };

  const remove = (v: string) => onChange(values.filter((x) => x !== v));

  return (
    <div className="chip-input" onClick={() => ref.current?.focus()}>
      {values.map((v) => (
        <span key={v} className="chip-tag">
          {v}
          <button type="button" className="chip-tag-x" aria-label={`Remove ${v}`} onClick={(e) => { e.stopPropagation(); remove(v); }}>×</button>
        </span>
      ))}
      <input
        ref={ref}
        type="text"
        className="chip-tag-input"
        placeholder={values.length === 0 ? placeholder : ""}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add(input);
          } else if (e.key === "Backspace" && !input && values.length > 0) {
            remove(values[values.length - 1]);
          }
        }}
        onBlur={() => { if (input) add(input); }}
      />
    </div>
  );
}

// ─── Example list (opening / closing) ──────────────────────────────
function ExampleList({
  values, onChange, placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const max = 6;
  return (
    <div className="example-list">
      {values.map((v, i) => (
        <div key={i} className="example-row">
          <span className="example-n">{String(i + 1).padStart(2, "0")}</span>
          <textarea
            rows={2}
            value={v}
            onChange={(e) => {
              const next = [...values];
              next[i] = e.target.value;
              onChange(next);
            }}
            placeholder={placeholder}
          />
          <button
            type="button"
            className="example-remove"
            aria-label="Remove example"
            onClick={() => onChange(values.filter((_, idx) => idx !== i))}
          >×</button>
        </div>
      ))}
      {values.length < max && (
        <button
          type="button"
          className="example-add"
          onClick={() => onChange([...values, ""])}
        >
          + Add example
        </button>
      )}
    </div>
  );
}
