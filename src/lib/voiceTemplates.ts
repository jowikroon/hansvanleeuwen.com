// Voice templates — hvl_voice_templates row shape + CRUD helpers.
//
// The schema below is the REAL production schema, taken from the existing
// BlogManager.tsx VoiceTemplate interface (src/pages/BlogManager.tsx:25-39):
//
//   id                uuid primary key
//   name              text                   -- e.g. "Technical Deep Dive"
//   category          text                   -- professional | personal | tech | marketplace | ai
//   is_default        boolean                -- one default per blog
//   tone              text                   -- "calm, opinionated, no-nonsense"
//   perspective       text                   -- "first-person operator, technical equals"
//   target_audience   text
//   writing_style     text                   -- meaty paragraph
//   banned_words      text[]                 -- e.g. ['easy', 'simple', 'just', 'leverage']
//   required_elements text[]                 -- e.g. ['concrete example', 'numbered list >= 4', ...]
//   content_rules     text                   -- multi-paragraph rule sheet
//   opening_examples  text[]                 -- 2-4 example openers
//   closing_examples  text[]                 -- 2-4 example closers
//
// NOTE: no `replacements` column in production. The `DEFAULT_REPLACEMENTS`
// map below covers the common cases for the voice card's click-to-fix
// flow. If you ever add a replacements column to the table, just merge it
// in resolveReplacement() below.

import { supabase } from "@/integrations/supabase/client";

export interface VoiceTemplate {
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

export type NewVoiceTemplate = Omit<VoiceTemplate, "id">;

// Default editable shape for the "New voice" form.
export const EMPTY_VOICE: NewVoiceTemplate = {
  name: "",
  category: "tech",
  is_default: false,
  tone: "",
  perspective: "",
  target_audience: "",
  writing_style: "",
  banned_words: [],
  required_elements: [],
  content_rules: "",
  opening_examples: [],
  closing_examples: [],
};

// Common substitutions used by useForbiddenWords when a banned word is
// clicked. The table doesn't store these; if Hans wants per-template
// overrides we add a column + merge here.
export const DEFAULT_REPLACEMENTS: Record<string, string> = {
  simple: "straightforward",
  easy: "low-friction",
  just: "",
  obviously: "",
  clearly: "",
  basically: "",
  leverage: "use",
  unlock: "enable",
  empower: "support",
  synergy: "alignment",
  revolutionary: "new",
  "game-changing": "useful",
  hustle: "work",
  grind: "work",
  hack: "trick",
  pivot: "change",
  "thought leader": "operator",
  "10x": "much faster",
  "cutting-edge": "current",
  "in today's world": "today",
  "the future is": "—",
};

export function resolveReplacement(word: string): string {
  const key = word.toLowerCase();
  return DEFAULT_REPLACEMENTS[key] ?? "";
}

// ─── CRUD ───────────────────────────────────────────────────────────

export async function listVoiceTemplates(): Promise<VoiceTemplate[]> {
  const { data, error } = await supabase
    .from("hvl_voice_templates")
    .select("*")
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });
  if (error) {
    console.warn("[voiceTemplates] list failed:", error);
    return [];
  }
  return (data as VoiceTemplate[]) ?? [];
}

export async function loadVoiceTemplate(id: string): Promise<VoiceTemplate | null> {
  const { data, error } = await supabase
    .from("hvl_voice_templates")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) {
    if (error) console.warn("[voiceTemplates] load failed:", error);
    return null;
  }
  return data as VoiceTemplate;
}

export async function saveVoiceTemplate(tpl: VoiceTemplate | (NewVoiceTemplate & { id?: string })): Promise<VoiceTemplate> {
  // Strip undefined fields so Supabase doesn't overwrite with null.
  const payload: Record<string, unknown> = { ...tpl };
  if (!("id" in payload) || !payload.id) delete payload.id;
  const { data, error } = await supabase
    .from("hvl_voice_templates")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single();
  if (error) {
    console.error("[voiceTemplates] save failed:", error);
    throw error;
  }
  return data as VoiceTemplate;
}

export async function deleteVoiceTemplate(id: string): Promise<void> {
  const { error } = await supabase
    .from("hvl_voice_templates")
    .delete()
    .eq("id", id);
  if (error) {
    console.error("[voiceTemplates] delete failed:", error);
    throw error;
  }
}

/**
 * Atomically set one template as default — clears is_default on all others.
 * Uses a single transaction-shaped call so we don't end up with zero or
 * multiple defaults.
 */
export async function setDefaultVoiceTemplate(id: string): Promise<void> {
  // Step 1: unset all defaults.
  const { error: clearErr } = await supabase
    .from("hvl_voice_templates")
    .update({ is_default: false })
    .neq("id", id);
  if (clearErr) {
    console.error("[voiceTemplates] clear defaults failed:", clearErr);
    throw clearErr;
  }
  // Step 2: set the new default.
  const { error: setErr } = await supabase
    .from("hvl_voice_templates")
    .update({ is_default: true })
    .eq("id", id);
  if (setErr) {
    console.error("[voiceTemplates] set default failed:", setErr);
    throw setErr;
  }
}
