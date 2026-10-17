"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { outlineEdges, partPoints, type Target } from "@/lib/shapes";

/* The required shape on a 5 × 5 grid of squares `gap` apart. Grid units map to
   the middle of the gaps, so the outline runs around the squares, not over them. */

const lineAt = (u: number, pitch: number, gap: number) => u * pitch - gap / 2;

const outlinePath = (t: Target, pitch: number, gap: number) =>
  outlineEdges(t)
    .map(([[x1, y1], [x2, y2]]) => `M${lineAt(x1, pitch, gap)} ${lineAt(y1, pitch, gap)}L${lineAt(x2, pitch, gap)} ${lineAt(y2, pitch, gap)}`)
    .join("");

/** On a playing grid (ColorGrid, 5 px gaps): only the shape's outline, over the squares. */
export function TargetContour({ target, gap = 5 }: { target: Target; gap?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pitch = (size + gap) / 5;
  return (
    <svg
      ref={ref}
      className="target-contour pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      viewBox={`0 0 ${size || 1} ${size || 1}`}
      aria-label={`Required shape: ${target.letter}`}
    >
      {size > 0 && (
        <path key={target.letter} d={outlinePath(target, pitch, gap)} fill="none" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

/** The reveal: every square, the shape's parts lit one after another, then its outline drawn. */
export function TargetGrid({ target, size, gap, on }: { target: Target; size: number; gap: number; on: boolean }) {
  const pitch = (size + gap) / 5;
  const cell = pitch - gap;
  // a part as a tile, inside its own square, so the gaps show between the pieces
  const corner = (u: number, base: number) => (u > base ? base * pitch + cell : base * pitch);
  const tilePoints = (p: (typeof target.parts)[number]) =>
    partPoints(p)
      .map(([x, y]) => `${corner(x, p.c)},${corner(y, p.r)}`)
      .join(" ");
  return (
    <svg className={`target-grid ${on ? "target-on" : ""}`} width={size} height={size} viewBox={`0 0 ${size} ${size}`} overflow="visible" aria-hidden>
      {Array.from({ length: 25 }, (_, i) => (
        <rect
          key={i}
          className="target-cell"
          x={(i % 5) * pitch}
          y={Math.floor(i / 5) * pitch}
          width={cell}
          height={cell}
          rx={6}
          style={{ "--i": i } as CSSProperties}
        />
      ))}
      {target.parts.map((p, i) => (
        <polygon key={i} className="target-part" points={tilePoints(p)} strokeLinejoin="round" style={{ "--i": i } as CSSProperties} />
      ))}
      <path
        className="target-outline"
        d={outlinePath(target, pitch, gap)}
        pathLength={1}
        fill="none"
        strokeWidth={Math.max(2.5, size / 115)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
