"use client";

import { BOARD_H, BOARD_W, SHAPES, SHAPE_COLORS, type ShapeState } from "@/lib/game";

interface Props {
  shapes: Record<string, ShapeState>;
  onChange: (id: string, state: ShapeState) => void;
}

const PAD = 6;

// Left click  → remove (click again to bring it back)
// Right click → grey   (right click again to restore the colour)
export default function ShapesBoard({ shapes, onChange }: Props) {
  return (
    <svg
      viewBox={`${-PAD} ${-PAD} ${BOARD_W + PAD * 2} ${BOARD_H + PAD * 2}`}
      className="h-full w-full"
      role="group"
      aria-label="Polygame shapes"
    >
      {SHAPES.map((s) => {
        const st = shapes[s.id];
        const removed = st === "removed";
        return (
          <polygon
            key={s.id}
            points={s.points.map((p) => p.join(",")).join(" ")}
            role="button"
            aria-label={`${s.label}: ${st}`}
            onClick={() => onChange(s.id, removed ? "normal" : "removed")}
            onContextMenu={(e) => {
              e.preventDefault();
              onChange(s.id, st === "grey" ? "normal" : "grey");
            }}
            fill={removed ? "transparent" : st === "grey" ? "var(--shape-grey)" : SHAPE_COLORS[s.kind]}
            stroke={removed ? "rgba(230,255,243,0.5)" : "#1b1430"}
            strokeWidth={removed ? 1.5 : 2}
            strokeDasharray={removed ? "5 4" : undefined}
            strokeLinejoin="round"
            className="cursor-pointer transition-[fill,opacity] duration-200 hover:opacity-85"
          />
        );
      })}
    </svg>
  );
}
