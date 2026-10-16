"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  children?: ReactNode;
  className?: string;
  /** Chamfer size of the cut corners, px */
  cut?: number;
  /** Show the travelling pink light */
  tracer?: boolean;
  traceDuration?: number;
  /** Small tick bars on the sides, like the reference video */
  ticks?: boolean;
}

// Chamfered neon frame (matches the reference HUD video): cut corners,
// notches on the top/bottom edge and an optional pink comet tracing the border.
export default function HudFrame({
  children,
  className = "",
  cut = 18,
  tracer = false,
  traceDuration = 7,
  ticks = false,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const i = 1.5; // inset so the stroke isn't clipped
  const notch = Math.min(120, w * 0.18);
  const nd = 6; // notch depth
  const path =
    w && h
      ? [
          `M ${i + cut} ${i}`,
          `L ${w * 0.3} ${i}`,
          `L ${w * 0.3 + nd} ${i + nd}`,
          `L ${w * 0.3 + nd + notch} ${i + nd}`,
          `L ${w * 0.3 + 2 * nd + notch} ${i}`,
          `L ${w - i - cut} ${i}`,
          `L ${w - i} ${i + cut}`,
          `L ${w - i} ${h - i - cut}`,
          `L ${w - i - cut} ${h - i}`,
          `L ${w * 0.7} ${h - i}`,
          `L ${w * 0.7 - nd} ${h - i - nd}`,
          `L ${w * 0.7 - nd - notch} ${h - i - nd}`,
          `L ${w * 0.7 - 2 * nd - notch} ${h - i}`,
          `L ${i + cut} ${h - i}`,
          `L ${i} ${h - i - cut}`,
          `L ${i} ${i + cut}`,
          "Z",
        ].join(" ")
      : "";
  const perimeter = 2 * (w + h);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {path && (
        <svg className="pointer-events-none absolute inset-0" width={w} height={h} aria-hidden>
          <path d={path} fill="rgba(4,17,12,0.72)" />
          <path
            d={path}
            fill="none"
            stroke="var(--neon)"
            strokeWidth={1.6}
            style={{ filter: "drop-shadow(0 0 4px rgba(41,224,143,0.8))" }}
          />
          {tracer && (
            <path
              d={path}
              fill="none"
              stroke="var(--pink)"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeDasharray={`70 ${perimeter}`}
              strokeDashoffset={perimeter + 70}
              className="tracer"
              style={
                {
                  "--trace-dur": `${traceDuration}s`,
                  filter: "drop-shadow(0 0 6px var(--pink))",
                } as React.CSSProperties
              }
            />
          )}
          {ticks && (
            <g fill="var(--neon)">
              {Array.from({ length: 6 }, (_, k) => (
                <rect key={`l${k}`} x={-9} y={h / 2 - 30 + k * 10} width={5} height={5} opacity={0.5 + (k % 2) * 0.4} />
              ))}
              {Array.from({ length: 6 }, (_, k) => (
                <rect
                  key={`r${k}`}
                  x={w + 4}
                  y={h / 2 - 30 + k * 10}
                  width={6}
                  height={4}
                  fill={k === 4 ? "var(--pink)" : "var(--neon)"}
                />
              ))}
            </g>
          )}
        </svg>
      )}
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}
