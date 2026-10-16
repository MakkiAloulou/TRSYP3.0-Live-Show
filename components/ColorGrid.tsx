"use client";

import { useEffect, useRef } from "react";
import { toCell, type GridCell, type GridColor } from "@/lib/game";

const FILL: Record<GridColor, string> = {
  0: "var(--cell-white)",
  1: "var(--cell-red)",
  2: "var(--cell-blue)",
};
const NAME: Record<GridColor, string> = { 0: "white", 1: "red", 2: "blue" };

// Each square is split on its "\" diagonal into two triangles.
// Left click  → whole square (white → red → blue → white), no diagonal shown
// Right click → only the triangle under the cursor, diagonal stays visible
// Hover + type digits → number on the square (full) or on the hovered triangle (split)
const HALVES: { h: 0 | 1; pts: string; cx: number; cy: number }[] = [
  { h: 0, pts: "0,0 10,0 10,10", cx: 6.9, cy: 3.1 }, // top-right
  { h: 1, pts: "0,0 10,10 0,10", cx: 3.1, cy: 6.9 }, // bottom-left
];

interface Props {
  grid: GridCell[];
  onCell: (index: number, half: 0 | 1) => void;
  onHalf: (index: number, half: 0 | 1) => void;
  onKey: (index: number, half: 0 | 1, key: string) => void;
}

export default function ColorGrid({ grid, onCell, onHalf, onKey }: Props) {
  const hover = useRef<{ i: number; h: 0 | 1 } | null>(null);
  const onKeyRef = useRef(onKey);
  useEffect(() => {
    onKeyRef.current = onKey;
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!hover.current || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9]$/.test(e.key) || e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        onKeyRef.current(hover.current.i, hover.current.h, e.key);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  return (
    <div
      className="grid aspect-square h-full grid-cols-5 grid-rows-5 gap-[5px]"
      role="group"
      aria-label="5 by 5 grid"
      onPointerLeave={() => (hover.current = null)}
    >
      {grid.map((raw, i) => {
        const cell = toCell(raw);
        const [a, b] = cell.colors;
        const coloured = a !== 0 || b !== 0;
        const glow = cell.full ? `0 0 10px ${FILL[a]}` : "none";
        return (
          <div key={i} className="relative" style={{ boxShadow: glow }}>
            <svg viewBox="0 0 10 10" className="block h-full w-full" aria-label={`Square ${i + 1}`}>
              {HALVES.map(({ h, pts }) => (
                <polygon
                  key={h}
                  points={pts}
                  role="button"
                  aria-label={`Square ${i + 1} ${h === 0 ? "top-right" : "bottom-left"}: ${NAME[cell.colors[h]]}`}
                  fill={FILL[cell.colors[h]]}
                  stroke={FILL[cell.colors[h]]}
                  strokeWidth={0.05} // closes the hairline gap between the halves of a full square
                  className="cursor-pointer transition-[fill,stroke] duration-150"
                  onPointerEnter={() => (hover.current = { i, h })}
                  onClick={() => onCell(i, h)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    onHalf(i, h);
                  }}
                />
              ))}
              {/* Diagonal: hidden on a full square, faint on a blank one, strong on a split coloured one */}
              {!cell.full && (
                <line
                  x1="0"
                  y1="0"
                  x2="10"
                  y2="10"
                  stroke={coloured ? "#06120d" : "rgba(2,7,5,0.18)"}
                  strokeWidth={coloured ? 0.45 : 0.15}
                  pointerEvents="none"
                />
              )}
              {cell.full ? (
                cell.label && <Label x={5} y={5.2} size={4.6} text={cell.label} />
              ) : (
                HALVES.map(({ h, cx, cy }) =>
                  cell.halfLabels[h] ? (
                    <Label key={h} x={cx} y={cy} size={2.9} text={cell.halfLabels[h]} dark={cell.colors[h] === 0} />
                  ) : null,
                )
              )}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

function Label({ x, y, size, text, dark }: { x: number; y: number; size: number; text: string; dark?: boolean }) {
  return (
    <text
      x={x}
      y={y}
      fontSize={size}
      textAnchor="middle"
      dominantBaseline="central"
      pointerEvents="none"
      className="select-none font-[family-name:var(--font-digits)]"
      fill={dark ? "#06120d" : "#fff"}
      stroke={dark ? "none" : "rgba(6,18,13,0.5)"}
      strokeWidth={0.5}
      paintOrder="stroke"
    >
      {text}
    </text>
  );
}
