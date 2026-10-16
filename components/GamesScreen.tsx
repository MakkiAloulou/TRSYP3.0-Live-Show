"use client";

import { useRef } from "react";
import { GAME_INFO, GAMES, slotStatus, type GameKind, type GameState } from "@/lib/game";
import { DrawPath, framePath, Line, Reveal } from "./Draw";
import HudFrame from "./HudFrame";

/* Page −1: the three games. Clicking one zooms into its match list. The same
   pairs play every game in order, and scores carry over game to game. */

const X0 = 150;
const X1 = 1770;
const Y0 = 60;
const Y1 = 1020;
const CUT = 28;
const TITLE_Y = 212;
const CARD_W = 470;
const CARD_H = 560;
const GAP = 50;

interface Props {
  on: boolean;
  state: GameState;
  onOpen: (game: GameKind, card: HTMLElement) => void;
}

export default function GamesScreen({ on, state, onOpen }: Props) {
  const left0 = (1920 - (CARD_W * 3 + GAP * 2)) / 2;
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

      {GAMES.map((g, i) => (
        <Reveal key={g} on={on} d={520 + i * 140} className="absolute" style={{ left: left0 + i * (CARD_W + GAP), top: 300, width: CARD_W, height: CARD_H }}>
          <GameCard game={g} state={state} onOpen={onOpen} />
        </Reveal>
      ))}

      <Reveal on={on} d={1000} className="absolute left-0 right-0 text-center text-[13px] uppercase tracking-[0.4em] text-[var(--text-dim)] opacity-70" style={{ top: Y1 - 40 }}>
        Click a game to open its matches · scores carry over from one game to the next · Z goes back a level
      </Reveal>
    </div>
  );
}

function GameCard({ game, state, onOpen }: { game: GameKind; state: GameState; onOpen: Props["onOpen"] }) {
  const ref = useRef<HTMLButtonElement>(null);
  const info = GAME_INFO[game];
  const done = state.matches.filter((m) => slotStatus(m.games[game]) === "done").length;
  const live = state.matches.some((m) => slotStatus(m.games[game]) === "live");
  return (
    <button
      ref={ref}
      data-game={game}
      disabled={!info.ready}
      onClick={() => ref.current && onOpen(game, ref.current)}
      className="group relative block h-full w-full cursor-pointer text-left transition-transform duration-200 enabled:hover:scale-[1.03] disabled:cursor-not-allowed"
    >
      <HudFrame className="h-full w-full" cut={24} tracer={info.ready} traceDuration={6 + info.num} ticks>
        <div className={`flex h-full flex-col items-center justify-center px-8 text-center ${info.ready ? "" : "opacity-40"}`}>
          <span className="digits text-[18px] uppercase tracking-[0.5em] text-[var(--text-dim)]">Game</span>
          <span className="digits pink-text mt-1 text-[150px] leading-none">{String(info.num).padStart(2, "0")}</span>
          <span className="neon-text mt-6 font-[family-name:var(--font-display)] text-[54px] uppercase leading-none tracking-[0.14em]">
            {info.title}
          </span>
          <span className="mt-8 text-[15px] font-semibold uppercase tracking-[0.35em] text-[var(--text-dim)]">
            {info.ready ? `${done} / ${state.matches.length} matches done` : "Coming soon"}
          </span>
          {live && (
            <span className="blink pink-text mt-3 border border-[var(--pink)] px-3 py-0.5 text-[12px] font-semibold uppercase tracking-[0.35em]">
              Live
            </span>
          )}
        </div>
        <span className="pointer-events-none absolute inset-0 opacity-0 shadow-[inset_0_0_40px_rgba(41,224,143,0.35)] transition-opacity duration-200 group-enabled:group-hover:opacity-100" />
      </HudFrame>
    </button>
  );
}
