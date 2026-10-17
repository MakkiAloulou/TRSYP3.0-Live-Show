"use client";

import { useRef } from "react";
import {
  cumulative,
  GAME_INFO,
  leagueMatches,
  nextMatchId,
  slotStatus,
  type GameKind,
  type GameState,
  type Match,
  type TeamState,
} from "@/lib/game";
import { Frame, Line, Reveal, ScreenTitle } from "./Draw";
import Branch from "./Branch";
import FitText from "./FitText";
import Panel from "./Panel";

/* Screen 0 (league): the 4 drawn matches as cards. The controller opens one
   (the stage zooms into it) and sets or clears pairings. Played matches are
   dimmed, the next one to play glows. */

const X0 = 150;
const X1 = 1770;
const Y0 = 60;
const Y1 = 1020;
const TITLE_Y = 212;
const GRID_TOP = 262;
const GRID_BOTTOM = 960;

interface Props {
  on: boolean;
  state: GameState;
  onOpen: (id: string, card: HTMLElement) => void;
}

export default function MatchesScreen({ on, state, onOpen }: Props) {
  const matches = leagueMatches(state);
  const nextId = nextMatchId(state, state.game);

  // two per row, centred in the space under the title (an odd last one centred too)
  const cols = 2;
  const rows = Math.ceil(matches.length / cols);
  const gap = 56; // room for the legends on the cards' top and bottom edges
  const cardW = (X1 - X0 - 120 - gap * (cols - 1)) / cols;
  const cardH = Math.min(260, (GRID_BOTTOM - GRID_TOP - gap * (rows - 1)) / rows);
  const gridTop = GRID_TOP + (GRID_BOTTOM - GRID_TOP - (rows * cardH + (rows - 1) * gap)) / 2;

  return (
    <div className="absolute inset-0" aria-hidden={!on}>
      <svg className="pointer-events-none absolute inset-0" width={1920} height={1080}>
        <g fill="none" strokeLinecap="round">
          <Frame on={on} x0={X0} y0={Y0} x1={X1} y1={Y1} />
          <Line on={on} d={260} dur={700} x1={X0} y1={TITLE_Y} x2={X1} y2={TITLE_Y} strong />
        </g>
      </svg>

      <ScreenTitle
        on={on}
        x0={X0}
        x1={X1}
        y0={Y0}
        y1={TITLE_Y}
        title={GAME_INFO[state.game].title}
      />

      {matches.map((m, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const inRow = Math.min(cols, matches.length - row * cols);
        const shift = ((cols - inRow) * (cardW + gap)) / 2;
        return (
          <Reveal
            key={m.id}
            on={on}
            d={480 + i * 60}
            className="absolute"
            style={{ left: X0 + 60 + shift + col * (cardW + gap), top: gridTop + row * (cardH + gap), width: cardW, height: cardH }}
          >
            <Card
              match={m}
              game={state.game}
              next={m.id === nextId}
              compact={cardH < 150}
              onOpen={(el) => onOpen(m.id, el)}
            />
          </Reveal>
        );
      })}

    </div>
  );
}

const STATUS = {
  upcoming: { label: "Upcoming", cls: "" },
  live: { label: "Live", cls: "pill--pink blink" },
  done: { label: "Done", cls: "pill--green" },
} as const;

function Card({
  match, game, next, compact, onOpen,
}: {
  match: Match;
  game: GameKind;
  next: boolean;
  compact: boolean;
  onOpen: (el: HTMLElement) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const slot = match.games[game];
  const status = slotStatus(slot);
  const [a, b] = slot.teams;
  // score so far, carried over from the earlier games
  const ta = cumulative(match, game, 0);
  const tb = cumulative(match, game, 1);
  const lead = status === "done" ? (ta === tb ? -1 : ta > tb ? 0 : 1) : -1;
  const nameCls = (i: number) => (lead === -1 || lead === i ? "text-white" : "text-[var(--text-faint)]");

  const empty = !!match.empty;
  const done = status === "done";
  const side = (i: 0 | 1, team: TeamState, score: number) => (
    <div className={`flex w-full min-w-0 flex-col gap-2.5 ${i === 1 ? "items-end text-right" : "items-start"}`}>
      {empty ? (
        <span className="block h-[30px] w-[150px] rounded-lg border border-dashed border-white/15 bg-white/[0.03]" aria-label="Team not set" />
      ) : (
        <FitText text={team.name} size={compact ? 22 : 34} className={`name leading-[1.1] ${nameCls(i)}`} />
      )}
      {!empty && <Branch id={team.leagueId} height={64} />}
      <span className={`flex items-center gap-3 ${i === 1 ? "flex-row-reverse" : ""}`}>
        <span className={`h-[3px] w-9 rounded-full ${i === 0 ? "bg-[var(--green-soft)]" : "bg-[var(--pink-soft)]"} ${empty ? "opacity-30" : ""}`} />
        {done && <span className={`digits text-[30px] leading-none ${nameCls(i)}`}>{score}</span>}
      </span>
    </div>
  );
  return (
    <button
      ref={ref}
      data-match={match.id}
      onClick={() => !empty && ref.current && onOpen(ref.current)}
      className={`group relative block h-full w-full cursor-pointer text-left transition-[transform,opacity,filter] duration-300 focus-visible:outline-none ${
        next ? "next-match z-10" : "hover:scale-[1.03]"
      } ${done ? "opacity-45 grayscale-[70%] hover:opacity-80" : ""} ${empty ? "opacity-60" : ""}`}
    >
      <Panel className="h-full w-full" radius={20} tracer={next || status === "live"} traceDuration={next ? 3.5 : 5}>
        <span className="panel-hover" />
        {/* match number, sitting on the top edge like a fieldset legend */}
        <span className="absolute left-1/2 top-0 z-[11] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-[var(--surface-solid)] px-4 py-0.5 text-[14px] font-medium text-[var(--text-dim)]">
          Match {String(match.num).padStart(2, "0")}
        </span>
        <div className={`grid h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-5 ${compact ? "px-6" : "px-8"}`}>
          {side(0, a, ta)}
          <span className="vs-disc w-[64px] text-[16px]">VS</span>
          {side(1, b, tb)}
        </div>
        {/* status, on the bottom edge to match the number on top */}
        <span className="absolute bottom-0 left-1/2 z-[11] -translate-x-1/2 translate-y-1/2 rounded-full bg-[var(--surface-solid)]">
          {empty ? (
            <span className="pill block text-[12px]">Set teams</span>
          ) : next ? (
            <span className="pill pill--pink blink block text-[12px]">Next match</span>
          ) : (
            <span className={`pill block text-[12px] ${STATUS[status].cls}`}>{STATUS[status].label}</span>
          )}
        </span>
      </Panel>
    </button>
  );
}
