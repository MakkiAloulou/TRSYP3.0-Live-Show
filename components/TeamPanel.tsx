"use client";

import { useEffect, useState } from "react";
import { elapsedMs, formatTime, type Action, type TeamId, type TeamState, type TimerState } from "@/lib/game";
import ColorGrid from "./ColorGrid";
import HudFrame from "./HudFrame";
import ShapesBoard from "./ShapesBoard";

interface Props {
  id: TeamId;
  team: TeamState;
  dispatch: (a: Action) => void;
}

export default function TeamPanel({ id, team, dispatch }: Props) {
  const [editing, setEditing] = useState(false);

  return (
    <section className="flex h-full flex-col items-center gap-3" aria-label={team.name}>
      {/* Team name — double-click to rename */}
      <div className="flex h-[46px] items-center gap-3">
        <span className="h-2 w-2 rotate-45 bg-[var(--pink)] shadow-[0_0_8px_var(--pink)]" />
        {editing ? (
          <input
            autoFocus
            defaultValue={team.name}
            aria-label="Team name"
            onBlur={(e) => {
              dispatch({ type: "rename", team: id, name: e.currentTarget.value.trim() || team.name });
              setEditing(false);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
            className="w-[420px] border-b border-[var(--neon)] bg-transparent text-center font-[family-name:var(--font-display)] text-[34px] uppercase tracking-[0.12em] text-[var(--neon)] outline-none"
          />
        ) : (
          <h2
            onDoubleClick={() => setEditing(true)}
            className="neon-text cursor-text select-none font-[family-name:var(--font-display)] text-[34px] uppercase tracking-[0.12em]"
          >
            {team.name}
          </h2>
        )}
        <span className="h-2 w-2 rotate-45 bg-[var(--pink)] shadow-[0_0_8px_var(--pink)]" />
      </div>

      {/* Live camera placeholder — the video is laid over this when screen sharing */}
      <HudFrame className="h-[396px] w-[704px] shrink-0" cut={22} tracer traceDuration={id === 0 ? 8 : 9.5} ticks>
        <div className="flex h-full w-full items-center justify-center">
          <span className="font-[family-name:var(--font-display)] text-[28px] tracking-[0.4em] text-[var(--neon-dim)]">
            CAM {id + 1}
          </span>
          <span className="blink absolute right-6 top-5 flex items-center gap-2 text-xs font-semibold tracking-[0.3em] text-[var(--pink)]">
            <span className="h-2 w-2 rounded-full bg-[var(--pink)]" /> LIVE
          </span>
        </div>
      </HudFrame>

      {/* Shapes board (left) + 5x5 grid (right) */}
      <div className="flex h-[290px] w-full items-stretch gap-4 px-2">
        <HudFrame className="min-w-0 flex-1" cut={14}>
          <div className="flex h-full flex-col px-5 pb-3 pt-3">
            <Label>Shapes</Label>
            <div className="min-h-0 flex-1 pt-1">
              <ShapesBoard shapes={team.shapes} onChange={(sid, state) => dispatch({ type: "setShape", team: id, id: sid, state })} />
            </div>
          </div>
        </HudFrame>
        <HudFrame className="w-[290px] shrink-0" cut={14}>
          <div className="flex h-full flex-col items-center px-4 pb-4 pt-3">
            <Label>Grid</Label>
            <div className="min-h-0 flex-1 pt-2">
              <ColorGrid
                grid={team.grid}
                onCell={(i, half) => dispatch({ type: "cycleCell", team: id, index: i, half })}
                onHalf={(i, half) => dispatch({ type: "cycleHalf", team: id, index: i, half })}
              />
            </div>
          </div>
        </HudFrame>
      </div>

      {/* Timer | current total */}
      <HudFrame className="h-[112px] w-full shrink-0" cut={16}>
        <div className="grid h-full grid-cols-2">
          <div className="flex flex-col items-center justify-center border-r border-[var(--neon-dim)]">
            <Label>Timer</Label>
            <TimerDisplay timer={team.timer} />
          </div>
          <div className="flex flex-col items-center justify-center">
            <Label>Current total</Label>
            <span className="digits pink-text text-[58px] leading-none" aria-live="polite">
              {team.points}
            </span>
          </div>
        </div>
      </HudFrame>
    </section>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[13px] font-semibold uppercase tracking-[0.35em] text-[var(--text-dim)]">{children}</span>
  );
}

function TimerDisplay({ timer }: { timer: TimerState }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timer.running) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timer.running]);

  // `now` can lag one frame behind a fresh start, so never show less than what's banked
  const ms = Math.max(timer.accumulated, elapsedMs(timer, now));
  return (
    <span
      className={`digits text-[58px] leading-none ${timer.running ? "neon-text" : "text-[var(--text)]"}`}
      role="timer"
    >
      {formatTime(ms)}
    </span>
  );
}
