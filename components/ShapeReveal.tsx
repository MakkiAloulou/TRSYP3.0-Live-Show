"use client";

import type { CSSProperties } from "react";
import type { Target } from "@/lib/shapes";
import { TargetGrid } from "./TargetShape";

/* Before a Polygame match: the shape both teams must build, big. The grid
   builds in, the shape's pieces light up one by one and its outline draws;
   the letter lands beside it with what it's built from. `on` plays it in. */

export default function ShapeReveal({ on, target, label }: { on: boolean; target: Target; label: string }) {
  const d = (ms: number) => ({ "--d": `${ms}ms` }) as CSSProperties;
  return (
    <div className={`sr absolute inset-0 ${on ? "sr-on" : ""}`} aria-hidden={!on}>
      <div className="absolute left-[200px] top-1/2 -translate-y-1/2">
        <TargetGrid target={target} size={680} gap={14} on={on} />
      </div>
      <div className="absolute left-[1040px] right-[140px] top-1/2 flex -translate-y-1/2 flex-col">
        <span className="sr-in pill pill--pink self-start px-5 py-2 text-[20px]" style={d(200)}>
          {label}
        </span>
        <span className="sr-in label mt-12 text-[26px]" style={d(400)}>
          Required shape
        </span>
        <span className="sr-letter title -ml-3 text-[360px] leading-[0.95]">{target.letter}</span>
        <div className="sr-in mt-8 flex items-center gap-7 whitespace-nowrap text-[40px] font-semibold text-white" style={d(1900)}>
          <span className="flex items-center gap-4">
            <svg width="40" height="40" viewBox="0 0 10 10" aria-hidden>
              <rect x="0.6" y="0.6" width="8.8" height="8.8" rx="1" className="sr-piece" />
            </svg>
            {target.pieces.cubes} cubes
          </span>
          <span className="text-[var(--text-faint)]">·</span>
          <span className="flex items-center gap-4">
            <svg width="40" height="40" viewBox="0 0 10 10" aria-hidden>
              <polygon points="0.6,0.6 0.6,9.4 9.4,9.4" strokeLinejoin="round" className="sr-piece" />
            </svg>
            {target.pieces.triangles} triangles
          </span>
        </div>
      </div>
    </div>
  );
}
