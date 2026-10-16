"use client";

import type { GridColor } from "@/lib/game";

const FILL: Record<GridColor, string> = {
  0: "var(--cell-white)",
  1: "var(--cell-red)",
  2: "var(--cell-blue)",
};
const NAME: Record<GridColor, string> = { 0: "white", 1: "red", 2: "blue" };

// 5x5 grid; each click cycles white → red → blue → white.
export default function ColorGrid({ grid, onCycle }: { grid: GridColor[]; onCycle: (i: number) => void }) {
  return (
    <div className="grid aspect-square h-full grid-cols-5 grid-rows-5 gap-[5px]" role="group" aria-label="5 by 5 grid">
      {grid.map((c, i) => (
        <button
          key={i}
          onClick={() => onCycle(i)}
          aria-label={`Square ${i + 1}: ${NAME[c]}`}
          className="relative cursor-pointer outline-none transition-[background-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-[var(--pink)]"
          style={{
            background: FILL[c],
            boxShadow: c ? `0 0 10px ${FILL[c]}` : "inset 0 0 0 1px rgba(0,0,0,0.15)",
          }}
        >
          <span
            className="absolute left-1 top-0.5 text-[10px] font-semibold leading-none"
            style={{ color: c ? "rgba(255,255,255,0.75)" : "rgba(2,7,5,0.4)" }}
          >
            {i + 1}
          </span>
        </button>
      ))}
    </div>
  );
}
