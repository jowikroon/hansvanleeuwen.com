import { useEffect, useState } from "react";
import { youtubeMetadata, type YouTubeMeta } from "@/lib/blogApi";

const YT_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,})/;

/**
 * Reveals beneath the URL input as soon as a valid YouTube URL is detected.
 * Calls /webhook/blog-youtube-metadata (debounced 350ms) to fetch real
 * title + channel + duration. Voice template + language + extras chips are
 * stored as local state and surfaced via onChange.
 */
export interface PreflightSelection {
  voice_template_id: string | null;
  languages: Array<"en" | "nl">;
  extras: Array<"linkedin" | "seo">;
}

interface Props {
  url: string;
  voiceTemplates?: Array<{ id: string; label: string; fit?: number }>;
  defaultVoice?: string | null;
  onChange?: (sel: PreflightSelection, meta: YouTubeMeta | null) => void;
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function PreflightCard({ url, voiceTemplates = [], defaultVoice = null, onChange }: Props) {
  const [meta, setMeta] = useState<YouTubeMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<PreflightSelection>({
    voice_template_id: defaultVoice,
    languages: ["nl", "en"],
    extras: ["linkedin", "seo"],
  });

  // debounced fetch
  useEffect(() => {
    const m = url.trim().match(YT_RE);
    if (!m) { setMeta(null); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const result = await youtubeMetadata({ url });
        setMeta(result);
        onChange?.(sel, result);
      } catch {
        // fall through: meta stays null, the card still shows because URL is valid
        setMeta(null);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  // emit change when selection toggles
  useEffect(() => { onChange?.(sel, meta); /* eslint-disable-next-line */ }, [sel]);

  if (!YT_RE.test(url)) return null;

  const toggleLang = (l: "en" | "nl") => setSel((s) => ({
    ...s,
    languages: s.languages.includes(l) ? s.languages.filter((x) => x !== l) : [...s.languages, l],
  }));
  const toggleExtra = (e: "linkedin" | "seo") => setSel((s) => ({
    ...s,
    extras: s.extras.includes(e) ? s.extras.filter((x) => x !== e) : [...s.extras, e],
  }));

  return (
    <div className="preflight show" aria-live="polite">
      <div className="preflight-top">
        <div className="preflight-thumb">
          {meta?.thumbnail_url ? (
            <img src={meta.thumbnail_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span className="play-tri" />
          )}
          <span className="dur">{meta ? fmtDuration(meta.duration_seconds) : "—:—"}</span>
        </div>
        <div className="preflight-meta">
          <div className="src">
            {loading ? "Fetching metadata…" : meta ? "video found · transcript available" : "video found · metadata unavailable"}
          </div>
          <h4>{meta?.title ?? (loading ? "—" : "YouTube video")}</h4>
          <div className="channel">
            {meta?.channel ?? "—"}
            {meta?.view_count != null ? ` · ${meta.view_count.toLocaleString()} views` : ""}
          </div>
        </div>
      </div>

      <div className="preflight-options">
        <div className="opt-cell">
          <div className="opt-label">Voice template</div>
          {voiceTemplates.length > 0 ? (
            <select
              className="opt-value"
              value={sel.voice_template_id ?? ""}
              onChange={(e) => setSel((s) => ({ ...s, voice_template_id: e.target.value || null }))}
            >
              <option value="">— auto-match —</option>
              {voiceTemplates.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}{v.fit != null ? ` · ${v.fit}% fit` : ""}
                </option>
              ))}
            </select>
          ) : (
            <button className="opt-value" type="button" disabled>
              <span>Auto-match on analyze</span>
            </button>
          )}
        </div>

        <div className="opt-cell">
          <div className="opt-label">Languages</div>
          <div className="lang-chips">
            <button className={`lang-chip ${sel.languages.includes("nl") ? "on" : ""}`} type="button" onClick={() => toggleLang("nl")}>NL</button>
            <button className={`lang-chip ${sel.languages.includes("en") ? "on" : ""}`} type="button" onClick={() => toggleLang("en")}>EN</button>
          </div>
        </div>

        <div className="opt-cell">
          <div className="opt-label">Extras</div>
          <div className="lang-chips">
            <button className={`lang-chip ${sel.extras.includes("linkedin") ? "on" : ""}`} type="button" onClick={() => toggleExtra("linkedin")}>LinkedIn</button>
            <button className={`lang-chip ${sel.extras.includes("seo") ? "on" : ""}`} type="button" onClick={() => toggleExtra("seo")}>SEO</button>
          </div>
        </div>
      </div>

      <div className="preflight-foot">
        <div className="est">
          <span>⏱ <strong>~90s</strong></span>
          <span>≈ <strong>14k tokens</strong></span>
          <span>~<strong>$0.04</strong></span>
        </div>
        <div>Cmd+⏎ start</div>
      </div>
    </div>
  );
}
