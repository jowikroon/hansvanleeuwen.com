import { useEffect, useRef } from "react";

/**
 * Falling-character canvas backdrop, ported from Write.html's #matrix.
 * Renders only while the parent modal is open. Theme-aware (reads --matrix
 * from CSS custom property, falls back to var(--ink-2)).
 */
const CHARS = "アァカサタナハマヤラワABCDEF0123456789{}[]<>/=*+-•·∆∂ΣΠΦΨΩ";
const FONT_SIZE = 14;

export default function MatrixCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let drops: number[] = [];
    let rafId = 0;
    let cancelled = false;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cols = Math.floor(window.innerWidth / FONT_SIZE);
      drops = new Array(cols).fill(0).map(() => Math.random() * -50);
    }
    resize();
    window.addEventListener("resize", resize);

    function frame() {
      if (cancelled) return;
      const css = getComputedStyle(document.documentElement);
      const bg = css.getPropertyValue("--bg-0").trim() || "#F1ECDF";
      const fg = css.getPropertyValue("--matrix").trim() || css.getPropertyValue("--ink-2").trim() || "#7E7A6F";

      // fade background
      ctx!.fillStyle = bg + "1A"; // ~10% alpha
      ctx!.fillRect(0, 0, window.innerWidth, window.innerHeight);

      ctx!.font = `${FONT_SIZE}px "IBM Plex Mono", ui-monospace, monospace`;
      ctx!.fillStyle = fg;
      for (let i = 0; i < drops.length; i++) {
        const ch = CHARS[Math.floor(Math.random() * CHARS.length)];
        ctx!.fillText(ch, i * FONT_SIZE, drops[i] * FONT_SIZE);
        drops[i] = drops[i] * FONT_SIZE > window.innerHeight && Math.random() > 0.975
          ? 0
          : drops[i] + 1;
      }
      rafId = window.requestAnimationFrame(frame);
    }
    rafId = window.requestAnimationFrame(frame);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="matrix-canvas" aria-hidden="true" />;
}
