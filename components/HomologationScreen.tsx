"use client";

import type { CSSProperties } from "react";
import { HOMOL_MAX, homolPoints, type GameState } from "@/lib/game";
import Branch from "./Branch";
import { CountUp, Frame, Line, Reveal, ScreenTitle } from "./Draw";

/* Homologation results, before any game: each team's score out of 50 for
   meeting the technical specs. Eight rows in two columns, each with a bar
   that fills to the score while the number counts up. Teams in their league
   order (t1…t8), so nobody reads a ranking into the layout; the leaderboard
   that follows ranks them. */

const X0 = 150;
const X1 = 1770;
const Y0 = 60;
const Y1 = 1020;
const TITLE_Y = 212;
const ROW0 = 286;
const ROW_H = 168;
const COL_W = 700;
const GAP = 80;

export default function HomologationScreen({ on, state }: { on: boolean; state: GameState }) {
  const teams = [...state.league].sort((a, b) => parseInt(a.id.slice(1)) - parseInt(b.id.slice(1)));
  const left0 = (1920 - (COL_W * 2 + GAP)) / 2;
  return (
    <div className="absolute inset-0" aria-hidden={!on}>
      <svg className="pointer-events-none absolute inset-0" width={1920} height={1080}>
        <g fill="none" strokeLinecap="round">
          <Frame on={on} x0={X0} y0={Y0} x1={X1} y1={Y1} />
          <Line on={on} d={260} dur={700} x1={X0} y1={TITLE_Y} x2={X1} y2={TITLE_Y} strong />
        </g>
      </svg>
      <ScreenTitle on={on} x0={X0} x1={X1} y0={Y0} y1={TITLE_Y} title="Homologation" />

      {teams.map((t, i) => {
        const col = Math.floor(i / 4);
        const row = i % 4;
        const pts = homolPoints(state.homologation[t.id]);
        const scored = (state.homologation[t.id] ?? "") !== "";
        const d = 520 + i * 110;
        const full = pts === HOMOL_MAX;
        return (
          <Reveal key={t.id} on={on} d={d} className="absolute" style={{ left: left0 + col * (COL_W + GAP), top: ROW0 + row * ROW_H, width: COL_W, height: ROW_H - 26 }}>
            <div className="panel flex h-full flex-col justify-center gap-4 px-7" style={{ "--r": "20px" } as CSSProperties}>
              <div className="flex items-center gap-5">
                <Branch id={t.id} height={46} />
                <span className="name min-w-0 flex-1 truncate text-[30px] text-white">{t.name}</span>
                <span className="flex items-baseline gap-1">
                  <span className={`digits text-[52px] font-bold leading-none ${full ? "neon-text" : "text-white"}`}>
                    {scored ? <CountUp value={pts} on={on} delay={d + 300} ms={1100} /> : "—"}
                  </span>
                  <span className="digits text-[22px] text-[var(--text-faint)]">/{HOMOL_MAX}</span>
                </span>
              </div>
              {/* the score as a bar, filling while the number counts */}
              <span className="relative block h-[8px] overflow-hidden rounded-full bg-white/[0.07]">
                <span
                  className={`homol-bar absolute inset-y-0 left-0 rounded-full ${on ? "homol-bar-on" : ""}`}
                  style={{ width: `${(pts / HOMOL_MAX) * 100}%`, "--delay": `${d + 300}ms` } as CSSProperties}
                />
              </span>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}
