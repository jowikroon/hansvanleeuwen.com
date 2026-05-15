import { useState, useRef, useCallback, useEffect } from "react";

const N8N_WEBHOOK_URL =
  import.meta.env.VITE_N8N_CR2_WEBHOOK_URL ??
  "https://n8n.srv1402218.hstgr.cloud/form/cr2-match-form";

type Status = "idle" | "uploading" | "success" | "error";

export default function MarcelPage() {
  const [email, setEmail] = useState("");
  const [reference, setReference] = useState<File | null>(null);
  const [rawZip, setRawZip] = useState<File | null>(null);
  const [strength, setStrength] = useState(1.0);
  const [format, setFormat] = useState<"jpg" | "png" | "tiff">("jpg");
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [jobResponse, setJobResponse] = useState("");

  const refPreview = useObjectUrl(reference);

  // noindex
  useEffect(() => {
    const prevTitle = document.title;
    document.title = "/marcel Â· hansvanleeuwen.com";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => {
      document.title = prevTitle;
      meta.remove();
    };
  }, []);

  const canSubmit =
    email.trim().length > 3 &&
    email.includes("@") &&
    reference !== null &&
    rawZip !== null &&
    status !== "uploading";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !reference || !rawZip) return;

    setStatus("uploading");
    setProgress(0);
    setErrorMessage("");

    const form = new FormData();
    form.append("Your email", email);
    form.append("Reference image", reference);
    form.append("RAW files (ZIP of .CR2)", rawZip);
    form.append("Strength (0.0 - 1.0)", String(strength));
    form.append("Output format", format);

    try {
      await uploadWithProgress(
        N8N_WEBHOOK_URL,
        form,
        (p) => setProgress(p),
        (r) => setJobResponse(r)
      );
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const reset = () => {
    setStatus("idle");
    setProgress(0);
    setErrorMessage("");
    setJobResponse("");
    setReference(null);
    setRawZip(null);
  };

  return (
    <div className="min-h-screen bg-[#0e0e0c] text-[#e8e6df] selection:bg-amber-200/30">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
        }}
      />

      <header className="border-b border-white/5">
        <div className="mx-auto flex max-w-5xl items-baseline justify-between px-6 py-5">
          <a href="/" className="font-serif text-lg tracking-tight text-white/90 hover:text-white">
            hansvanleeuwen<span className="text-amber-300">.</span>
          </a>
          <nav className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/40">
            <span className="text-white/70">/marcel</span>
            <span className="mx-2 text-white/20">Â·</span>
            <span>cr2 â matched</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-32 pt-16">
        <section className="mb-16">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-300/70">
            Private tool Â· for Marcel
          </p>
          <h1 className="font-serif text-5xl leading-[1.05] tracking-tight text-white sm:text-6xl">
            Drop in the RAWs.{" "}
            <span className="italic text-amber-200/90">Drop in the look.</span>
            <br />
            Get them back, matched.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60">
            Upload a folder of Canon CR2 files (zipped) and one reference image showing the style
            you want. The pipeline matches exposure, white balance, tone curve, saturation and
            color grading across every shot, then emails the processed batch back to you.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
            <span>Â· Originals untouched</span>
            <span>Â· Parallel processing</span>
            <span>Â· Result emailed as ZIP</span>
          </div>
        </section>

        {status === "success" ? (
          <SuccessState onReset={reset} response={jobResponse} email={email} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-10">
            <Field
              label="Where should we send the result?"
              hint="Job confirmation comes back instantly; processed ZIP arrives when the batch is done."
              n="01"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@domain.com"
                className="w-full border-b border-white/15 bg-transparent py-3 font-serif text-2xl text-white placeholder-white/20 outline-none transition focus:border-amber-300/60"
              />
            </Field>

            <div className="grid gap-6 md:grid-cols-2">
              <Field
                label="Reference image"
                hint="One PNG or JPG showing the look you want to match."
                n="02"
              >
                <DropZone
                  file={reference}
                  onFile={setReference}
                  accept="image/png,image/jpeg"
                  helper="PNG / JPG"
                  preview={refPreview}
                />
              </Field>
              <Field
                label="CR2 batch"
                hint="A single ZIP containing your .CR2 files."
                n="03"
              >
                <DropZone
                  file={rawZip}
                  onFile={setRawZip}
                  accept=".zip,application/zip,application/x-zip-compressed"
                  helper=".ZIP archive"
                />
              </Field>
            </div>

            <div className="grid gap-10 md:grid-cols-2">
              <Field
                label="Strength"
                hint="0.0 keeps the original. 1.0 fully matches the reference."
                n="04"
              >
                <div className="flex items-end gap-6">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={strength}
                    onChange={(e) => setStrength(parseFloat(e.target.value))}
                    className="flex-1 accent-amber-300"
                  />
                  <span className="font-mono text-3xl text-white tabular-nums">
                    {strength.toFixed(2)}
                  </span>
                </div>
              </Field>

              <Field label="Output format" hint="Format for the processed files." n="05">
                <div className="flex gap-2">
                  {(["jpg", "png", "tiff"] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`flex-1 border px-4 py-3 font-mono text-xs uppercase tracking-[0.18em] transition ${
                        format === f
                          ? "border-amber-300/60 bg-amber-300/10 text-amber-200"
                          : "border-white/15 text-white/50 hover:border-white/40 hover:text-white/80"
                      }`}
                    >
                      .{f}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <div className="border-t border-white/10 pt-10">
              {status === "uploading" && (
                <div className="mb-6">
                  <div className="mb-2 flex justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
                    <span>Uploading</span>
                    <span className="tabular-nums">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-px w-full overflow-hidden bg-white/10">
                    <div
                      className="h-full bg-amber-300 transition-all duration-150 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {status === "error" && (
                <div className="mb-6 border-l-2 border-red-400 bg-red-400/5 px-4 py-3 font-mono text-xs text-red-200">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="group relative w-full overflow-hidden border border-amber-300/40 bg-amber-300/5 py-5 font-mono text-xs uppercase tracking-[0.3em] text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-transparent disabled:text-white/30"
              >
                <span className="relative z-10">
                  {status === "uploading" ? "Workingâ¦" : "Start processing â"}
                </span>
              </button>

              <p className="mt-4 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-white/30">
                Processed on private infrastructure Â· Files deleted after delivery
              </p>
            </div>
          </form>
        )}
      </main>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 font-mono text-[10px] uppercase tracking-[0.22em] text-white/30">
          <span>Â© hansvanleeuwen.com</span>
          <span>cr2-match Â· v1.0</span>
        </div>
      </footer>
    </div>
  );
}

function Field({
  label,
  hint,
  n,
  children,
}: {
  label: string;
  hint?: string;
  n: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline gap-3">
        <span className="font-mono text-[10px] tracking-[0.22em] text-amber-300/60">{n}</span>
        <label className="font-serif text-xl text-white">{label}</label>
      </div>
      {hint && <p className="mb-4 max-w-prose text-sm leading-relaxed text-white/45">{hint}</p>}
      {children}
    </div>
  );
}

function DropZone({
  file,
  onFile,
  accept,
  helper,
  preview,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
  accept: string;
  helper: string;
  preview?: string;
}) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files?.[0];
      if (f) onFile(f);
    },
    [onFile]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`relative cursor-pointer border border-dashed transition ${
        dragOver
          ? "border-amber-300/70 bg-amber-300/5"
          : file
          ? "border-amber-300/30 bg-white/[0.02]"
          : "border-white/15 hover:border-white/40"
      } group flex min-h-[180px] items-center justify-center px-6 py-8`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
      />

      {file ? (
        <div className="flex w-full items-center gap-4 text-left">
          {preview ? (
            <img
              src={preview}
              alt=""
              className="h-16 w-16 flex-shrink-0 border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center border border-white/10 bg-black/40 font-mono text-[10px] uppercase tracking-widest text-amber-300/70">
              {file.name.split(".").pop()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-serif text-base text-white">{file.name}</div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-white/40">
              {formatBytes(file.size)}
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFile(null);
            }}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40 hover:text-amber-200"
          >
            Replace
          </button>
        </div>
      ) : (
        <div className="text-center">
          <div className="font-serif text-lg text-white/70 group-hover:text-white">
            Drop file or click
          </div>
          <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-white/30">
            {helper}
          </div>
        </div>
      )}
    </div>
  );
}

function SuccessState({
  onReset,
  email,
  response,
}: {
  onReset: () => void;
  email: string;
  response: string;
}) {
  return (
    <div className="border border-amber-300/30 bg-amber-300/[0.03] p-10">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.22em] text-amber-300/70">
        Job accepted
      </p>
      <h2 className="font-serif text-3xl text-white">We've got it from here.</h2>
      <p className="mt-4 max-w-prose text-white/60">
        Your batch is processing on the server. When it's done â usually a few minutes for typical
        batch sizes â you'll get an email at{" "}
        <span className="text-amber-200">{email}</span> with the processed files attached as a ZIP.
      </p>
      {response && (
        <pre className="mt-6 max-h-32 overflow-auto border border-white/10 bg-black/40 p-4 font-mono text-[11px] text-white/50">
          {response}
        </pre>
      )}
      <button
        type="button"
        onClick={onReset}
        className="mt-8 border border-white/20 px-6 py-3 font-mono text-xs uppercase tracking-[0.22em] text-white/70 transition hover:border-amber-300/50 hover:text-amber-200"
      >
        Start another batch â
      </button>
    </div>
  );
}

function useObjectUrl(file: File | null): string | undefined {
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function uploadWithProgress(
  url: string,
  body: FormData,
  onProgress: (pct: number) => void,
  onComplete: (responseText: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onComplete(xhr.responseText);
        resolve();
      } else {
        reject(new Error(`Upload failed (${xhr.status}): ${xhr.statusText}`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(body);
  });
}
