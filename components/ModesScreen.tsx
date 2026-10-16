"use client";

import { useRef } from "react";
import { cupWinnerId, cupMatch, leagueMatches, type GameState, type Mode } from "@/lib/game";
import { DrawPath, framePath, Line, Reveal } from "./Draw";
import HudFrame from "./HudFrame";

/* Page −1: League game (Polygame + Garden) or Cup game (Mine). */

const X0 = 150;
const X1 = 1770;
const Y0 = 60;
const Y1 = 1020;
const CUT = 28;
const TITLE_Y = 212;
const CARD_W = 620;
const CARD_H = 560;
const GAP = 80;

const MODES: { mode: Mode; title: string; sub: string }[] = [
  { mode: "league", title: "League game", sub: "Polygame · Garden" },
  { mode: "cup", title: "Cup game", sub: "Mine" },
];

interface Props {
  on: boolean;
  state: GameState;
  onOpen: (mode: Mode, card: HTMLElement) => void;
}

export default function ModesScreen({ on, state, onOpen }: Props) {
  const left0 = (1920 - (CARD_W * 2 + GAP)) / 2;
  return (
    <div className="absolute inset-0" aria-hidden={!on}>
      <svg className="pointer-events-none absolute inset-0" width={1920} height={1080}>
        <g fill="none" strokeLinecap="square">
          <DrawPath on={on} d={0} dur={1100} path={framePath(X0, Y0, X1, Y1, CUT)} glow="drop-shadow(0 0 5px rgba(41,224,143,0.85))" />
          <Line on={on} d={260} dur={700} x1={X0} y1={TITLE_Y} x2={X1} y2={TITLE_Y} strong />
        </g>
      </svg>

      <Reveal on={on} d={320} className="absolute left-0 right-0 text-center" style={{ top: Y0 + 26 }}>
        <div className="text-[15px] font-semibold uppercase tracking-[0.55em] text-[var(--text-dim)]">TRSYP 3.0 · Robotics competition</div>
        <h1 className="neon-text mt-1 font-[family-name:var(--font-display)] text-[68px] uppercase leading-none tracking-[0.22em]">
          Games
        </h1>
      </Reveal>

      {MODES.map((m, i) => (
        <Reveal key={m.mode} on={on} d={520 + i * 160} className="absolute" style={{ left: left0 + i * (CARD_W + GAP), top: 300, width: CARD_W, height: CARD_H }}>
          <ModeCard info={m} state={state} onOpen={onOpen} />
        </Reveal>
      ))}

      <Reveal on={on} d={1000} className="absolute left-0 right-0 text-center text-[13px] uppercase tracking-[0.4em] text-[var(--text-dim)] opacity-70" style={{ top: Y1 - 40 }}>
        Click League or Cup · Tab shows the league leaderboard from any screen · Z goes back a level
      </Reveal>
    </div>
  );
}

function ModeCard({ info, state, onOpen }: { info: (typeof MODES)[number]; state: GameState; onOpen: Props["onOpen"] }) {
  const ref = useRef<HTMLButtonElement>(null);
  const league = leagueMatches(state);
  const leagueDone = league.filter((m) => m.games.garden.committed).length;
  const champ = cupWinnerId(cupMatch(state, "final"));
  const champName = champ ? state.league.find((l) => l.id === champ)?.name : null;
  const status =
    info.mode === "league"
      ? `${leagueDone} / ${league.length} matches done`
      : champName
        ? `Champion: ${champName}`
        : cupMatch(state, "sf1")
          ? "Bracket drawn"
          : "Draw pending";
  return (
    <button
      ref={ref}
      data-mode={info.mode}
      onClick={() => ref.current && onOpen(info.mode, ref.current)}
      className="group relative block h-full w-full cursor-pointer text-left transition-transform duration-200 hover:scale-[1.03]"
    >
      <HudFrame className="h-full w-full" cut={26} tracer traceDuration={info.mode === "league" ? 7 : 8.5} ticks>
        <div className="flex h-full flex-col items-center justify-center px-8 text-center">
          <span className="digits text-[18px] uppercase tracking-[0.5em] text-[var(--text-dim)]">{info.mode === "league" ? "Phase 1" : "Phase 2"}</span>
          {info.mode === "league" ? <LeagueIcon /> : <CupIcon />}
          <span className="neon-text mt-6 font-[family-name:var(--font-display)] text-[60px] uppercase leading-none tracking-[0.12em]">
            {info.title}
          </span>
          <span className="pink-text mt-4 text-[22px] font-semibold uppercase tracking-[0.35em]">{info.sub}</span>
          <span className="mt-8 text-[15px] font-semibold uppercase tracking-[0.35em] text-[var(--text-dim)]">{status}</span>
        </div>
        <span className="pointer-events-none absolute inset-0 opacity-0 shadow-[inset_0_0_40px_rgba(41,224,143,0.35)] transition-opacity duration-200 group-hover:opacity-100" />
      </HudFrame>
    </button>
  );
}

function LeagueIcon() {
  return (
    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-4" style={{ filter: "drop-shadow(0 0 10px var(--pink))" }}>
      <path d="M3 3v18h18" />
      <path d="M7 16v-3" />
      <path d="M11 16V9" />
      <path d="M15 16v-5" />
      <path d="M19 16V5" />
    </svg>
  );
}

function CupIcon() {
  return (
    <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mt-4" style={{ filter: "drop-shadow(0 0 10px var(--pink))" }}>
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
