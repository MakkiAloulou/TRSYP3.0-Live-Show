"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { matchGains, needsLeagueUpdate, pendingGains, type Action, type GameState } from "@/lib/game";
import { Frame, Line, Reveal, ScreenTitle } from "./Draw";
import Branch from "./Branch";
import Panel from "./Panel";

/* Overall leaderboard of all 8 teams. Opens on the current standings; if this
   match hasn't been added yet, 3 s later the two teams' points tick up, a +N
   badge pops, and rows slide to their new places with ▲/▼ markers. */

const X0 = 150;
const X1 = 1770;
const Y0 = 60;
const Y1 = 1020;
const TITLE_Y = 212;
const HEAD_Y = 228; // column header band
const ROW0 = 290;
const ROW_H = 82;
const ROWS = 8;

// columns (stage px)
const C_RANK = 210;
const C_TEAM = 430;
const C_SB = 930;
const C_PLAYED = 1310;
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
  /** "+N" badges to show beside the points (e.g. what homologation just added) */
  badges?: Record<string, number>;
}

interface Update {
  gains: Record<string, number>;
  prevRank: Record<string, number>;
}

export default function LeaderboardScreen({ on, active, state, dispatch, readOnly, badges }: Props) {
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
      live.current.dispatch({ type: "editLeaguePoints", id: hover.current, key });
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  const playing = new Set(readOnly ? [] : Object.keys(matchGains(state)));
  // which corner each of this match's teams played in (green = team 1, pink = team 2)
  const cornerOf = (id: string) => state.teams.findIndex((t) => t.leagueId === id);

  return (
    <div className="absolute inset-0" aria-hidden={!on}>
      {/* the standings card the rows sit on */}
      <Reveal on={on} d={360} className="absolute" style={{ left: X0 + 40, width: X1 - X0 - 80, top: HEAD_Y - 6, height: ROW0 + ROWS * ROW_H - HEAD_Y + 14 }}>
        <Panel className="h-full w-full" radius={22} />
      </Reveal>
      <svg className="pointer-events-none absolute inset-0" width={1920} height={1080}>
        <g fill="none" strokeLinecap="round">
          <Frame on={on} x0={X0} y0={Y0} x1={X1} y1={Y1} />
          <Line on={on} d={260} dur={700} x1={X0} y1={TITLE_Y} x2={X1} y2={TITLE_Y} strong />
          <Line on={on} d={420} dur={700} x1={X0 + 60} y1={ROW0} x2={X1 - 60} y2={ROW0} strong />
          {Array.from({ length: ROWS - 1 }, (_, i) => (
            <Line key={i} on={on} d={520 + i * 55} dur={520} x1={X0 + 60} y1={ROW0 + (i + 1) * ROW_H} x2={X1 - 60} y2={ROW0 + (i + 1) * ROW_H} />
          ))}
        </g>
      </svg>

      <ScreenTitle on={on} x0={X0} x1={X1} y0={Y0} y1={TITLE_Y} title="Leaderboard" />

      {/* column headers */}
      <Reveal
        on={on}
        d={480}
        className="label absolute flex items-center text-[14px]"
        style={{ left: 0, width: 1920, top: HEAD_Y, height: ROW0 - HEAD_Y }}
      >
        <span className="absolute" style={{ left: C_RANK }}>Rank</span>
        <span className="absolute" style={{ left: C_TEAM }}>Team</span>
        <span className="absolute" style={{ left: C_SB }}>SB</span>
        <span className="absolute -translate-x-1/2" style={{ left: C_PLAYED }}>Played</span>
        <span className="absolute -translate-x-full" style={{ left: C_POINTS_R }}>Points</span>
      </Reveal>

      {/* rows — positioned by rank so a re-order slides them */}
      {league.map((t, i) => {
        const prev = update?.prevRank[t.id];
        const moved = update && prev !== undefined ? prev - i : 0;
        const gain = update?.gains[t.id] ?? badges?.[t.id];
        const isPlaying = playing.has(t.id);
        const top3 = ["var(--green)", "var(--pink)", "#ffffff"][i];
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
                  className={`absolute top-1/2 h-[9px] w-[9px] -translate-y-1/2 rounded-full ${cornerOf(t.id) === 1 ? "bg-[var(--pink)] shadow-[0_0_14px_rgba(255,29,120,0.7)]" : "bg-[var(--green)] shadow-[0_0_14px_rgba(0,232,122,0.7)]"}`}
                  style={{ left: C_TEAM - 30 }}
                />
              )}
              {/* rank + movement */}
              <span
                className="digits absolute flex h-full items-center text-[40px] font-bold leading-none"
                style={{ left: C_RANK, color: top3 ?? "var(--text-faint)" }}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              {moved !== 0 && (
                <span
                  key={`${t.id}-${moved}`}
                  className="slam digits absolute flex h-full items-center text-[22px] font-bold"
                  style={
                    { left: C_RANK + 78, color: moved > 0 ? "var(--neon)" : "var(--cell-red)", "--delay": `${MOVE_MS + 500}ms` } as CSSProperties
                  }
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mr-1">
                    <path d={moved > 0 ? "m6 15 6-6 6 6" : "m6 9 6 6 6-6"} />
                  </svg>
                  {Math.abs(moved)}
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
                    className="name w-[600px] border-b border-[var(--green)] bg-transparent text-[34px] text-[var(--green)] outline-none"
                  />
                ) : (
                  <span
                    onDoubleClick={() => setEditing(t.id)}
                    className={`name select-none text-[34px] ${isPlaying ? (cornerOf(t.id) === 1 ? "pink-text" : "neon-text") : "text-white"}`}
                  >
                    {t.name}
                  </span>
                )}
              </span>
              {/* student branch */}
              <span className="absolute flex h-full items-center" style={{ left: C_SB }}>
                <Branch id={t.id} height={60} />
              </span>
              {/* played */}
              <span className="digits absolute flex h-full -translate-x-1/2 items-center text-[34px] text-[var(--text-dim)]" style={{ left: C_PLAYED }}>
                {t.played}
              </span>
              {/* points — hover + type */}
              <span
                onPointerEnter={() => (hover.current = t.id)}
                onPointerLeave={() => (hover.current = null)}
                className="digits absolute flex h-full -translate-x-full items-center px-2 text-[44px] font-bold text-white"
                style={{ left: C_POINTS_R }}
              >
                <Ticker value={t.points} on={on} delay={760 + i * 70} />
              </span>
              {gain !== undefined && (
                <span
                  className="slam digits absolute flex h-full items-center"
                  style={{ left: C_GAIN, "--delay": "0ms" } as CSSProperties}
                >
                  <span className={`pill text-[22px] ${gain >= 0 ? "pill--green" : "pill--red"}`}>{gain >= 0 ? `+${gain}` : gain}</span>
                </span>
              )}
            </Reveal>
          </div>
        );
      })}
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
