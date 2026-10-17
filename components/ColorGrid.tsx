"use client";

import { useEffect, useRef } from "react";
import { toCell, type Diag, type GridCell, type GridColor } from "@/lib/game";

const FILL: Record<GridColor, string> = {
  0: "var(--cell-white)",
  1: "var(--cell-red)",
  2: "var(--cell-blue)",
};
const NAME: Record<GridColor, string> = { 0: "white", 1: "red", 2: "blue" };

/** The two triangles of a square, for each diagonal (10 × 10 box). */
export const HALVES: Record<Diag, { h: 0 | 1; pts: string; cx: number; cy: number; name: string }[]> = {
  "\\": [
    { h: 0, pts: "0,0 10,0 10,10", cx: 6.9, cy: 3.1, name: "top-right" },
    { h: 1, pts: "0,0 10,10 0,10", cx: 3.1, cy: 6.9, name: "bottom-left" },
  ],
  "/": [
    { h: 0, pts: "0,0 10,0 0,10", cx: 3.1, cy: 3.1, name: "top-left" },
    { h: 1, pts: "10,0 10,10 0,10", cx: 6.9, cy: 6.9, name: "bottom-right" },
  ],
};
export const DIAG_LINE: Record<Diag, [number, number, number, number]> = { "\\": [0, 0, 10, 10], "/": [10, 0, 0, 10] };

// Each square is split on its diagonal (either way) into two triangles.
// Left click  → whole square (white → red → blue → white), no diagonal shown
// Right click → only the triangle under the cursor, diagonal stays visible
// Hover + type digits → number on the square (full) or on the hovered triangle (split)
// Every square carries data-cell={index}, so a dragged piece can find where it lands.

interface Props {
  grid: GridCell[];
  onCell: (index: number, half: 0 | 1) => void;
  onHalf: (index: number, half: 0 | 1) => void;
  onKey: (index: number, half: 0 | 1, key: string) => void;
  active: boolean;
  /** a square to ring (a piece is being dragged over it) */
  highlight?: number | null;
}

export default function ColorGrid({ grid, onCell, onHalf, onKey, active, highlight = null }: Props) {
  const hover = useRef<{ i: number; h: 0 | 1 } | null>(null);
  const onKeyRef = useRef(onKey);
  const activeRef = useRef(active);
  useEffect(() => {
    onKeyRef.current = onKey;
    activeRef.current = active;
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!activeRef.current || !hover.current || e.ctrlKey || e.metaKey || e.altKey) return;
      // Read the physical key: on AZERTY the top row gives "&é\"'(" without Shift
      const digit = /^(Digit|Numpad)([0-9])$/.exec(e.code)?.[2];
      const key = digit ?? (e.key === "Backspace" || e.key === "Delete" ? e.key : null);
      if (key) {
        e.preventDefault();
        onKeyRef.current(hover.current.i, hover.current.h, key);
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
        const halves = HALVES[cell.diag];
        const [x1, y1, x2, y2] = DIAG_LINE[cell.diag];
        return (
          <div
            key={i}
            data-cell={i}
            className="relative overflow-hidden rounded-[3px] transition-[outline-color] duration-100"
            style={{
              boxShadow: glow,
              outline: highlight === i ? "3px solid var(--green)" : "3px solid transparent",
              outlineOffset: 1,
            }}
          >
            <svg viewBox="0 0 10 10" className="block h-full w-full" aria-label={`Square ${i + 1}`}>
              {/* A full square is painted as ONE rect, so no seam can appear between the halves */}
              {cell.full && <rect width="10" height="10" fill={FILL[a]} pointerEvents="none" />}
              {halves.map(({ h, pts, name }) => (
                <polygon
                  key={h}
                  points={pts}
                  role="button"
                  aria-label={`Square ${i + 1} ${name}: ${NAME[cell.colors[h]]}`}
                  // halves stay as (invisible) click targets on a full square
                  fill={cell.full ? "transparent" : FILL[cell.colors[h]]}
                  className="cursor-pointer transition-[fill] duration-150"
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
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={coloured ? "#06120d" : "rgba(2,7,5,0.18)"}
                  strokeWidth={coloured ? 0.45 : 0.15}
                  pointerEvents="none"
                />
              )}
              {cell.full
                ? cell.label && <Label x={5} y={5.2} size={4.6} text={cell.label} />
                : halves.map(({ h, cx, cy }) =>
                    cell.halfLabels[h] ? (
                      <Label key={h} x={cx} y={cy} size={2.9} text={cell.halfLabels[h]} dark={cell.colors[h] === 0} />
                    ) : null,
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
