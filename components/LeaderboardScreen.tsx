"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { matchGains, needsLeagueUpdate, pendingGains, reducer, type Action, type GameState } from "@/lib/game";

/** Standings as they will be after this match is added. */
const reducerPreview = (s: GameState) => reducer(s, { type: "commitMatch" }).league;
import { sfx } from "@/lib/sfx";
import { DrawPath, framePath, Line, Reveal } from "./Draw";

/* Overall leaderboard of all 9 teams. Opens on the current standings; if this
   match hasn't been added yet, 3 s later the two teams' points tick up, a +N
   badge pops, and rows slide to their new places with ▲/▼ markers. */

const X0 = 150;
const X1 = 1770;
const Y0 = 60;
const Y1 = 1020;
const CUT = 28;
const TITLE_Y = 212;
const HEAD_Y = 228; // column header band
const ROW0 = 290;
const ROW_H = 78;
const ROWS = 9;

// columns (stage px)
const C_RANK = 210;
const C_TEAM = 430;
const C_PLAYED = 1210;
const C_POINTS_R = 1590;
const C_GAIN = 1615;

const UPDATE_AFTER_MS = 3000;
const MOVE_MS = 1000;

interface Props {
  on: boolean;
  active: boolean;
  state: GameState;
  dispatch: (a: Action) => void;
  /** Tab view: just show the standings, never add this match's points */
  readOnly?: boolean;
}

interface Update {
  gains: Record<string, number>;
  prevRank: Record<string, number>;
}

export default function LeaderboardScreen({ on, active, state, dispatch, readOnly }: Props) {
  const { league } = state;
  const [update, setUpdate] = useState<Update | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const hover = useRef<string | null>(null);
  const activeRef = useRef(active);
  const live = useRef({ state, dispatch });
  useEffect(() => {
    activeRef.current = active;
    live.current = { state, dispatch };
  });

  // 3 s after opening: add this match's points (once), remembering where everyone was
  useEffect(() => {
    if (!on) {
      const t = setTimeout(() => setUpdate(null), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      const { state: s, dispatch: d } = live.current;
      if (readOnly || !needsLeagueUpdate(s)) return;
      const gains = pendingGains(s);
      const prevRank = Object.fromEntries(s.league.map((l, i) => [l.id, i]));
      setUpdate({ gains, prevRank });
      d({ type: "commitMatch" });

      // sounds: +N chime and ticking points, rows sliding, then up / down markers
      const after = reducerPreview(s);
      const moves = after.map((l, i) => prevRank[l.id] - i);
      sfx.gain();
      sfx.countTicks(1, 0.05);
      if (moves.some((m) => m !== 0)) sfx.rowSlide(0.65);
      if (moves.some((m) => m > 0)) sfx.rankUp((MOVE_MS + 500) / 1000);
      if (moves.some((m) => m < 0)) sfx.rankDown((MOVE_MS + 650) / 1000);
    }, UPDATE_AFTER_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  // hover a points cell and type
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!activeRef.current || !hover.current || e.ctrlKey || e.metaKey || e.altKey) return;
      const digit = /^(Digit|Numpad)([0-9])$/.exec(e.code)?.[2];
      const key = digit ?? (e.key === "Backspace" || e.key === "Delete" ? e.key : null);
      if (!key) return;
      e.preventDefault();
      sfx.keyTick();
      live.current.dispatch({ type: "editLeaguePoints", id: hover.current, key });
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  const playing = new Set(readOnly ? [] : Object.keys(matchGains(state)));

  return (
    <div className="absolute inset-0" aria-hidden={!on}>
      <svg className="pointer-events-none absolute inset-0" width={1920} height={1080}>
        <g fill="none" strokeLinecap="square">
          <DrawPath on={on} d={0} dur={1100} path={framePath(X0, Y0, X1, Y1, CUT)} glow="drop-shadow(0 0 5px rgba(41,224,143,0.85))" />
          <Line on={on} d={260} dur={700} x1={X0} y1={TITLE_Y} x2={X1} y2={TITLE_Y} strong />
          <Line on={on} d={420} dur={700} x1={X0 + 40} y1={ROW0} x2={X1 - 40} y2={ROW0} strong />
          {Array.from({ length: ROWS - 1 }, (_, i) => (
            <Line key={i} on={on} d={520 + i * 55} dur={520} x1={X0 + 40} y1={ROW0 + (i + 1) * ROW_H} x2={X1 - 40} y2={ROW0 + (i + 1) * ROW_H} />
          ))}
        </g>
      </svg>

      <Reveal on={on} d={320} className="absolute left-0 right-0 text-center" style={{ top: Y0 + 26 }}>
        <div className="text-[15px] font-semibold uppercase tracking-[0.55em] text-[var(--text-dim)]">
          TRSYP 3.0 · Overall standings
        </div>
        <h1 className="neon-text mt-1 font-[family-name:var(--font-display)] text-[68px] uppercase leading-none tracking-[0.22em]">
          Leaderboard
        </h1>
      </Reveal>

      {/* column headers */}
      <Reveal
        on={on}
        d={480}
        className="absolute flex items-center text-[15px] font-semibold uppercase tracking-[0.45em] text-[var(--text-dim)]"
        style={{ left: 0, width: 1920, top: HEAD_Y, height: ROW0 - HEAD_Y }}
      >
        <span className="absolute" style={{ left: C_RANK }}>Rank</span>
        <span className="absolute" style={{ left: C_TEAM }}>Team</span>
        <span className="absolute -translate-x-1/2" style={{ left: C_PLAYED }}>Played</span>
        <span className="absolute -translate-x-full" style={{ left: C_POINTS_R }}>Points</span>
      </Reveal>

      {/* rows — positioned by rank so a re-order slides them */}
      {league.map((t, i) => {
        const prev = update?.prevRank[t.id];
        const moved = update && prev !== undefined ? prev - i : 0;
        const gain = update?.gains[t.id];
        const isPlaying = playing.has(t.id);
        const top3 = ["var(--pink)", "var(--neon)", "#7fd6ff"][i];
        return (
          <div
            key={t.id}
            className="absolute left-0 w-[1920px]"
            style={{
              top: ROW0,
              height: ROW_H,
              transform: `translateY(${i * ROW_H}px)`,
              transition: `transform ${MOVE_MS}ms cubic-bezier(0.65, 0, 0.35, 1) ${update ? 650 : 0}ms`,
              zIndex: moved > 0 ? 2 : 1, // climbers pass over the others
            }}
          >
            <Reveal on={on} d={640 + i * 70} className="relative h-full w-full">
              {/* this match's teams get a pink marker */}
              {isPlaying && (
                <span
                  className="absolute top-3 bottom-3 w-[4px] bg-[var(--pink)] shadow-[0_0_10px_var(--pink)]"
                  style={{ left: X0 + 18 }}
                />
              )}
              {/* rank + movement */}
              <span
                className="digits absolute flex h-full items-center text-[44px] leading-none"
                style={{ left: C_RANK, color: top3 ?? "var(--text)", textShadow: top3 ? `0 0 14px ${top3}` : undefined }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              {moved !== 0 && (
                <span
                  key={`${t.id}-${moved}`}
                  className="slam digits absolute flex h-full items-center text-[22px]"
                  style={
                    { left: C_RANK + 78, color: moved > 0 ? "var(--neon)" : "var(--cell-red)", "--delay": `${MOVE_MS + 500}ms` } as CSSProperties
                  }
                >
                  {moved > 0 ? `▲${moved}` : `▼${-moved}`}
                </span>
              )}
              {/* name — double-click to rename */}
              <span className="absolute flex h-full items-center" style={{ left: C_TEAM }}>
                {editing === t.id ? (
                  <input
                    autoFocus
                    defaultValue={t.name}
                    aria-label="Team name"
                    onBlur={(e) => {
                      dispatch({ type: "renameLeague", id: t.id, name: e.currentTarget.value.trim() || t.name });
                      setEditing(null);
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
                    }}
                    className="w-[600px] border-b border-[var(--neon)] bg-transparent font-[family-name:var(--font-display)] text-[38px] uppercase tracking-[0.12em] text-[var(--neon)] outline-none"
                  />
                ) : (
                  <span
                    onDoubleClick={() => setEditing(t.id)}
                    className={`cursor-text select-none font-[family-name:var(--font-display)] text-[38px] uppercase tracking-[0.12em] ${isPlaying ? "neon-text" : "text-[var(--text)]"}`}
                  >
                    {t.name}
                  </span>
                )}
              </span>
              {/* played */}
              <span className="digits absolute flex h-full -translate-x-1/2 items-center text-[38px] text-[var(--text-dim)]" style={{ left: C_PLAYED }}>
                {t.played}
              </span>
              {/* points — hover + type */}
              <span
                onPointerEnter={() => (hover.current = t.id)}
                onPointerLeave={() => (hover.current = null)}
                className="digits pink-text absolute flex h-full -translate-x-full cursor-text items-center px-2 text-[48px] outline-offset-[-6px] hover:outline-1 hover:outline-dashed hover:outline-[var(--pink-dim)]"
                style={{ left: C_POINTS_R }}
              >
                <Ticker value={t.points} on={on} delay={760 + i * 70} />
              </span>
              {gain !== undefined && (
                <span
                  className="slam digits neon-text absolute flex h-full items-center text-[30px]"
                  style={{ left: C_GAIN, "--delay": "0ms" } as CSSProperties}
                >
                  {gain >= 0 ? `+${gain}` : gain}
                </span>
              )}
            </Reveal>
          </div>
        );
      })}

      {!readOnly && needsLeagueUpdate(state) && on && (
        <Reveal on={on} d={1300} className="absolute left-0 right-0 text-center text-[13px] uppercase tracking-[0.4em] text-[var(--text-dim)]" style={{ top: Y1 - 34 }}>
          Updating with this match…
        </Reveal>
      )}
    </div>
  );
}

/** Counts 0 → value when the screen draws in, then old → new whenever the value changes. */
function Ticker({ value, on, delay }: { value: number; on: boolean; delay: number }) {
  const [shown, setShown] = useState(0);
  const last = useRef(0);
  const first = useRef(true);

  useEffect(() => {
    if (!on) {
      last.current = 0;
      first.current = true;
      return;
    }
    const from = last.current;
    const wait = first.current ? delay : 0;
    first.current = false;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      last.current = value;
      const t = setTimeout(() => setShown(value), 0);
      return () => clearTimeout(t);
    }
    let raf = 0;
    const start = performance.now() + wait;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / 1000));
      const v = from + (value - from) * (1 - Math.pow(1 - p, 3));
      last.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, on]);

  return <>{Math.round(shown)}</>;
}
