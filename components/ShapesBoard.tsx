"use client";

import type { CSSProperties } from "react";
import { BOARD_H, BOARD_W, SHAPES, SHAPE_COLORS, type ShapeState } from "@/lib/game";

interface Props {
  shapes: Record<string, ShapeState>;
  onChange: (id: string, state: ShapeState) => void;
  /** remote: pieces are dragged instead of clicked (the caller tells a tap from a drag) */
  onPieceDown?: (id: string, e: React.PointerEvent) => void;
  /** remote freeze picker: pieces chosen so far */
  selected?: string[];
}

const PAD = 6;

/* The 35 pieces, top view.
   normal  = its colour, on the board
   grey    = used: placed on the grid
   frozen  = locked by a pin: covered in ice, can't be used (it crystallises
             in when it's frozen, one piece after another)
   removed = knocked off (dashed outline; older saves)
   Screen only: left click removes / brings back, right click greys / restores. */
export default function ShapesBoard({ shapes, onChange, onPieceDown, selected = [] }: Props) {
  const frozenOrder = SHAPES.filter((s) => shapes[s.id] === "frozen").map((s) => s.id);
  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${BOARD_W + PAD * 2} ${BOARD_H + PAD * 2}`}
      className="h-full w-full overflow-visible"
      role="group"
      aria-label="Polygame shapes"
    >
      <defs>
        <linearGradient id="ice" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f2fbff" stopOpacity="0.95" />
          <stop offset="0.5" stopColor="#bfe9ff" stopOpacity="0.8" />
          <stop offset="1" stopColor="#7cc8f0" stopOpacity="0.85" />
        </linearGradient>
      </defs>
      {SHAPES.map((s) => {
        const st = shapes[s.id] ?? "normal"; // older saves don't have the bottom row
        const removed = st === "removed";
        const frozen = st === "frozen";
        const picked = selected.includes(s.id);
        const pts = s.points.map((p) => p.join(",")).join(" ");
        const cx = s.points.reduce((t, p) => t + p[0], 0) / s.points.length;
        const cy = s.points.reduce((t, p) => t + p[1], 0) / s.points.length;
        const order = frozenOrder.indexOf(s.id);
        return (
          <g key={s.id}>
            <polygon
              points={pts}
              role="button"
              aria-label={`${s.num ? `${s.num}. ` : ""}${s.label}: ${st}`}
              data-shape={s.id}
              onPointerDown={onPieceDown && ((e) => onPieceDown(s.id, e))}
              onClick={onPieceDown ? undefined : () => onChange(s.id, removed ? "normal" : "removed")}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!onPieceDown) onChange(s.id, st === "grey" ? "normal" : "grey");
              }}
              fill={removed ? "transparent" : st === "grey" ? "var(--shape-grey)" : SHAPE_COLORS[s.kind]}
              stroke={removed ? "rgba(230,255,243,0.5)" : "#1b1430"}
              strokeWidth={removed ? 1.5 : 2}
              strokeDasharray={removed ? "5 4" : undefined}
              strokeLinejoin="round"
              className="cursor-pointer transition-[fill,opacity] duration-200 hover:opacity-85"
              style={onPieceDown ? { touchAction: "none" } : undefined}
            />
            {/* frozen: a sheet of ice over the piece, and a frost ring when it lands */}
            {frozen && (
              <g pointerEvents="none" style={{ "--i": order } as CSSProperties}>
                <polygon points={pts} className="ice-ring" fill="none" stroke="#dff5ff" strokeWidth={3} strokeLinejoin="round" />
                <polygon points={pts} className="ice-sheet" fill="url(#ice)" stroke="#eafaff" strokeWidth={2.5} strokeLinejoin="round" />
                <Flake x={cx} y={s.num ? cy - (s.kind.endsWith("cube") ? 13 : 11) : cy} />
              </g>
            )}
            {/* freeze picker: the chosen pieces */}
            {picked && (
              <g pointerEvents="none">
                <polygon points={pts} fill="url(#ice)" fillOpacity={0.75} stroke="#ffffff" strokeWidth={4} strokeLinejoin="round" />
                <Flake x={cx} y={s.num ? cy - (s.kind.endsWith("cube") ? 13 : 11) : cy} />
              </g>
            )}
            {s.num && (
              <text
                x={cx}
                y={cy + (frozen || picked ? 4 : 0)}
                textAnchor="middle"
                dominantBaseline="central"
                pointerEvents="none"
                className="select-none font-[family-name:var(--font-digits)]"
                fontSize={s.kind.endsWith("cube") ? 17 : 14}
                fontWeight={600}
                fill={removed ? "rgba(230,255,243,0.45)" : frozen || picked ? "#0b3550" : "#fff"}
                stroke={removed || frozen || picked ? "none" : "rgba(10,6,24,0.55)"}
                strokeWidth={3}
                paintOrder="stroke"
              >
                {s.num}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** A small six-armed snowflake. */
function Flake({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} stroke="#0b3550" strokeWidth={1.6} strokeLinecap="round" className="ice-flake">
      {[0, 60, 120].map((a) => (
        <line key={a} x1={-5.5} y1={0} x2={5.5} y2={0} transform={`rotate(${a})`} />
      ))}
    </g>
  );
}
