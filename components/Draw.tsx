"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Image from "next/image";
import logo from "@/public/trsyp-logo.png";

/* Shared pieces for the screens that "draw themselves": lines that ink in
   like a pen, text that wipes in, numbers that count up. Driven by `on`:
   true plays in (staggered by `d`), false plays out in reverse, faster. */

/** Enter uses `d` / `dur`; exit runs last-first and quicker. */
export const timing = (on: boolean, d: number, dur: number, last = 1500) =>
  ({
    "--delay": `${on ? d : Math.max(0, Math.round((last - d) * 0.16))}ms`,
    "--dur": `${on ? dur : 320}ms`,
  }) as CSSProperties;

/** Rounded outer frame path, drawn from the top centre. */
export const framePath = (x0: number, y0: number, x1: number, y1: number, r: number) =>
  `M ${(x0 + x1) / 2} ${y0} H ${x1 - r} A ${r} ${r} 0 0 1 ${x1} ${y0 + r} V ${y1 - r} A ${r} ${r} 0 0 1 ${x1 - r} ${y1} H ${x0 + r} A ${r} ${r} 0 0 1 ${x0} ${y1 - r} V ${y0 + r} A ${r} ${r} 0 0 1 ${x0 + r} ${y0} Z`;

/** Gradients the screens' lines are stroked with (referenced by id from any SVG on the page). */
export function StrokeDefs() {
  return (
    <svg className="pointer-events-none absolute h-0 w-0" aria-hidden>
      <defs>
        {/* the outer frame: green corner into pink corner */}
        <linearGradient id="g-frame" gradientUnits="userSpaceOnUse" x1="150" y1="0" x2="1770" y2="0">
          <stop offset="0" stopColor="#00e87a" stopOpacity="0.5" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#ff1d78" stopOpacity="0.5" />
        </linearGradient>
        {/* a hairline rule, fading out at both ends */}
        <linearGradient id="g-rule" gradientUnits="userSpaceOnUse" x1="150" y1="0" x2="1770" y2="0">
          <stop offset="0" stopColor="#00e87a" stopOpacity="0" />
          <stop offset="0.2" stopColor="#00e87a" stopOpacity="0.45" />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity="0.14" />
          <stop offset="0.8" stopColor="#ff1d78" stopOpacity="0.45" />
          <stop offset="1" stopColor="#ff1d78" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** The outer frame every list / stats screen draws in. */
export function Frame({ on, x0, y0, x1, y1 }: { on: boolean; x0: number; y0: number; x1: number; y1: number }) {
  return <DrawPath on={on} d={0} dur={1100} path={framePath(x0, y0, x1, y1, 28)} stroke="url(#g-frame)" width={1.5} />;
}

export function DrawPath({
  on, d, dur, path, stroke = "var(--line-2)", width = 1.5, glow,
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
      stroke={pink ? "var(--pink)" : strong ? (y1 === y2 ? "url(#g-rule)" : "var(--line-2)") : "rgba(255,255,255,0.08)"}
      width={pink ? 2 : strong ? 1.4 : 1}
      glow={pink ? "drop-shadow(0 0 6px rgba(255,29,120,0.6))" : undefined}
    />
  );
}

/** Title band of a screen: logo on the left and the heading centred, or the logo
    alone in the centre when the screen has no heading. */
export function ScreenTitle({
  on, x0, x1, y0, y1, title,
}: { on: boolean; x0: number; x1: number; y0: number; y1: number; title?: ReactNode }) {
  const box = { left: x0, width: x1 - x0, top: y0, height: y1 - y0 };
  if (!title)
    return (
      <Reveal on={on} d={300} className="absolute flex items-center justify-center" style={box}>
        <Image src={logo} alt="TRSYP 3.0" priority className="h-[64px] w-auto object-cover" style={{ aspectRatio: "2000 / 330" }} />
      </Reveal>
    );
  return (
    <div className="absolute grid grid-cols-[1fr_auto_1fr] items-center px-12" style={box}>
      <Reveal on={on} d={300}>
        <Image src={logo} alt="TRSYP 3.0" priority className="h-[40px] w-auto object-cover" style={{ aspectRatio: "2000 / 330" }} />
      </Reveal>
      <Reveal on={on} d={320}>
        <h1 className="title text-center text-[60px] leading-none text-white" style={{ textShadow: "0 0 40px rgba(0,232,122,0.35)" }}>
          {title}
        </h1>
      </Reveal>
    </div>
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
