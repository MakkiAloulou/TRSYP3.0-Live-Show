"use client";

import type { GridCell, GridColor } from "@/lib/game";

const FILL: Record<GridColor, string> = {
  0: "var(--cell-white)",
  1: "var(--cell-red)",
  2: "var(--cell-blue)",
};
const NAME: Record<GridColor, string> = { 0: "white", 1: "red", 2: "blue" };

// Each square is split on its "\" diagonal into two triangles.
// Left click  → whole square (white → red → blue → white)
// Right click → only the triangle under the cursor
const HALVES: [0 | 1, string][] = [
  [0, "0,0 10,0 10,10"], // top-right
  [1, "0,0 10,10 0,10"], // bottom-left
];

interface Props {
  grid: GridCell[];
  onCell: (index: number, half: 0 | 1) => void;
  onHalf: (index: number, half: 0 | 1) => void;
}

export default function ColorGrid({ grid, onCell, onHalf }: Props) {
  return (
    <div className="grid aspect-square h-full grid-cols-5 grid-rows-5 gap-[5px]" role="group" aria-label="5 by 5 grid">
      {grid.map((cell, i) => {
        const glow = cell[0] && cell[0] === cell[1] ? `0 0 10px ${FILL[cell[0]]}` : "none";
        return (
          <div key={i} className="relative" style={{ boxShadow: glow }}>
            <svg viewBox="0 0 10 10" className="block h-full w-full" aria-label={`Square ${i + 1}`}>
              {HALVES.map(([h, pts]) => (
                <polygon
                  key={h}
                  points={pts}
                  role="button"
                  aria-label={`Square ${i + 1} ${h === 0 ? "top-right" : "bottom-left"}: ${NAME[cell[h]]}`}
                  fill={FILL[cell[h]]}
                  className="cursor-pointer transition-[fill] duration-150"
                  onClick={() => onCell(i, h)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onHalf(i, h);
                  }}
                />
              ))}
              {/* faint diagonal so the two halves are visible while white */}
              <line x1="0" y1="0" x2="10" y2="10" stroke="rgba(2,7,5,0.18)" strokeWidth="0.15" pointerEvents="none" />
            </svg>
            <span
              className="pointer-events-none absolute left-1 top-0.5 text-[10px] font-semibold leading-none"
              style={{ color: cell[1] ? "rgba(255,255,255,0.8)" : "rgba(2,7,5,0.4)" }}
            >
              {i + 1}
            </span>
          </div>
        );
      })}
    </div>
  );
}
