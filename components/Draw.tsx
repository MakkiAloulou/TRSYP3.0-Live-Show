"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

/* Shared pieces for the screens that "draw themselves": lines that ink in
   like a pen, text that wipes in, numbers that count up. Driven by `on`:
   true plays in (staggered by `d`), false plays out in reverse, faster. */

/** Enter uses `d` / `dur`; exit runs last-first and quicker. */
export const timing = (on: boolean, d: number, dur: number, last = 1500) =>
  ({
    "--delay": `${on ? d : Math.max(0, Math.round((last - d) * 0.16))}ms`,
    "--dur": `${on ? dur : 320}ms`,
  }) as CSSProperties;

/** Chamfered outer frame path, drawn from the top centre. */
export const framePath = (x0: number, y0: number, x1: number, y1: number, cut: number) =>
  `M ${(x0 + x1) / 2} ${y0} L ${x1 - cut} ${y0} L ${x1} ${y0 + cut} L ${x1} ${y1 - cut} L ${x1 - cut} ${y1} L ${x0 + cut} ${y1} L ${x0} ${y1 - cut} L ${x0} ${y0 + cut} L ${x0 + cut} ${y0} Z`;

export function DrawPath({
  on, d, dur, path, stroke = "var(--neon)", width = 2, glow,
}: { on: boolean; d: number; dur: number; path: string; stroke?: string; width?: number; glow?: string }) {
  return (
    <path
      pathLength={1}
      className={`draw ${on ? "on" : ""}`}
      style={{ ...timing(on, d, dur), filter: glow }}
      stroke={stroke}
      strokeWidth={width}
      d={path}
    />
  );
}

export function Line({
  on, d, dur, x1, y1, x2, y2, strong, pink,
}: { on: boolean; d: number; dur: number; x1: number; y1: number; x2: number; y2: number; strong?: boolean; pink?: boolean }) {
  return (
    <DrawPath
      on={on}
      d={d}
      dur={dur}
      path={`M ${x1} ${y1} L ${x2} ${y2}`}
      stroke={pink ? "var(--pink)" : strong ? "var(--neon)" : "var(--neon-dim)"}
      width={pink ? 3 : strong ? 1.6 : 1.2}
      glow={pink ? "drop-shadow(0 0 6px var(--pink))" : strong ? "drop-shadow(0 0 4px rgba(41,224,143,0.7))" : undefined}
    />
  );
}

export function Reveal({
  on, d, className, style, children,
}: { on: boolean; d: number; className?: string; style?: CSSProperties; children: ReactNode }) {
  return (
    <div className={`reveal ${on ? "on" : ""} ${className ?? ""}`} style={{ ...style, ...timing(on, d, 520) }}>
      {children}
    </div>
  );
}

/** Counts up 0 → value each time the screen draws in; edits afterwards show instantly. */
export function CountUp({
  value, on, delay, decimals = 0, ms = 800,
}: { value: number; on: boolean; delay: number; decimals?: number; ms?: number }) {
  const [shown, setShown] = useState<number | null>(null);

  useEffect(() => {
    if (!on) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / ms));
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(p >= 1 ? null : value * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // only replay when the screen draws in, not on every edit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  const v = shown ?? value;
  return <>{decimals ? v.toFixed(decimals) : Math.round(v)}</>;
}
