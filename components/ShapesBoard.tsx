"use client";

import { useEffect, useRef, useState } from "react";
import { BOARD_H, BOARD_W, SHAPES, SHAPE_COLORS, type ShapeState } from "@/lib/game";

interface Props {
  shapes: Record<string, ShapeState>;
  onChange: (id: string, state: ShapeState) => void;
}

interface Menu {
  id: string;
  x: number;
  y: number;
}

const PAD = 6;

export default function ShapesBoard({ shapes, onChange }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<Menu | null>(null);

  // Close the menu on outside click / Escape
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setMenu(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  const open = (id: string, e: React.MouseEvent) => {
    const box = wrap.current!.getBoundingClientRect();
    // Stage is CSS-scaled, so convert screen px back to stage px
    const scale = box.width / wrap.current!.offsetWidth;
    const x = (e.clientX - box.left) / scale;
    // Keep the 140px menu inside the board
    setMenu({ id, x: Math.min(x + 8, wrap.current!.offsetWidth - 150), y: (e.clientY - box.top) / scale });
  };

  const choose = (state: ShapeState) => {
    if (menu) onChange(menu.id, state);
    setMenu(null);
  };

  const current = menu ? shapes[menu.id] : null;
  const shape = menu ? SHAPES.find((s) => s.id === menu.id) : null;

  return (
    <div ref={wrap} className="relative h-full w-full">
      <svg
        viewBox={`${-PAD} ${-PAD} ${BOARD_W + PAD * 2} ${BOARD_H + PAD * 2}`}
        className="h-full w-full"
        role="group"
        aria-label="Polygame shapes"
      >
        {SHAPES.map((s) => {
          const st = shapes[s.id];
          const pts = s.points.map((p) => p.join(",")).join(" ");
          const removed = st === "removed";
          const selected = menu?.id === s.id;
          return (
            <polygon
              key={s.id}
              points={pts}
              role="button"
              tabIndex={0}
              aria-label={`${s.label}: ${st}`}
              onClick={(e) => open(s.id, e)}
              fill={removed ? "transparent" : st === "grey" ? "var(--shape-grey)" : SHAPE_COLORS[s.kind]}
              stroke={selected ? "var(--pink)" : removed ? "rgba(230,255,243,0.5)" : "#1b1430"}
              strokeWidth={selected ? 3 : removed ? 1.5 : 2}
              strokeDasharray={removed ? "5 4" : undefined}
              strokeLinejoin="round"
              className="cursor-pointer outline-none transition-[fill,opacity] duration-200 hover:opacity-85 focus-visible:stroke-[var(--pink)]"
            />
          );
        })}
      </svg>

      {menu && shape && (
        <div
          role="menu"
          aria-label={shape.label}
          className="absolute z-20 flex flex-col gap-1 border border-[var(--neon)] bg-[#03140d]/95 p-1.5 text-sm shadow-[0_0_14px_rgba(41,224,143,0.45)]"
          style={{
            left: menu.x,
            top: Math.max(menu.y - 70, 0),
            width: 140,
          }}
        >
          <div className="px-2 pb-1 text-[11px] uppercase tracking-widest text-[var(--text-dim)]">{shape.label}</div>
          <MenuBtn onClick={() => choose("grey")} disabled={current === "grey"}>
            <Swatch color="var(--shape-grey)" /> Grey
          </MenuBtn>
          <MenuBtn onClick={() => choose("removed")} disabled={current === "removed"}>
            <Swatch dashed /> Remove
          </MenuBtn>
          <MenuBtn onClick={() => choose("normal")} disabled={current === "normal"}>
            <Swatch color={SHAPE_COLORS[shape.kind]} /> Restore
          </MenuBtn>
        </div>
      )}
    </div>
  );
}

function MenuBtn({ children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      role="menuitem"
      className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-left font-semibold uppercase tracking-wider text-[var(--text)] transition-colors duration-150 hover:bg-[var(--neon-faint)] hover:text-[var(--neon)] disabled:cursor-default disabled:opacity-35 disabled:hover:bg-transparent"
      {...rest}
    >
      {children}
    </button>
  );
}

function Swatch({ color, dashed }: { color?: string; dashed?: boolean }) {
  return (
    <span
      className="inline-block h-3 w-3"
      style={dashed ? { border: "1px dashed rgba(230,255,243,0.6)" } : { background: color }}
    />
  );
}
