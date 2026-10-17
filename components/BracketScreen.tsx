"use client";

import { useEffect, useRef } from "react";
import {
  canOpen,
  cupGame,
  cupMatch,
  cupSlot,
  cupWinner,
  GAME_INFO,
  gameScore,
  slotStatus,
  type Action,
  type CupRound,
  type GameState,
  type Match,
  type TeamId,
} from "@/lib/game";
import { nextCupMatch } from "@/lib/flow";
import { screenBus } from "@/lib/remote";
import { DrawPath, Frame, Line, Reveal, ScreenTitle } from "./Draw";
import Panel from "./Panel";

/* The cup: the league's top 4 on the left, seeded into the Mine semi-finals
   (1st vs 4th, 2nd vs 3rd; see seedCup in lib/game.ts). The losers play the
   3rd place match, then the winners the final, both in Polygame. Each semi-final
   team carries its league rank, and each card names the game it's played in. */

const X0 = 150;
const X1 = 1770;
const Y0 = 60;
const Y1 = 1020;
const TITLE_Y = 212;

// bracket geometry (stage px)
const CARD_W = 430;
const CARD_H = 196;
const SF_X = 720;
const SF1_Y = 300;
const SF2_Y = 680;
const FIN_X = 1270;
const FIN_Y = 490; // level with the join of the two semi-finals
const THIRD_Y = 762;
const JOIN_X = 1205;


interface Props {
  on: boolean;
  active: boolean;
  state: GameState;
  dispatch: (a: Action) => void;
  onOpen: (id: string, card: HTMLElement) => void;
}

export default function BracketScreen({ on, active, state, dispatch, onOpen }: Props) {
  const top4 = state.league.slice(0, 4);
  const sf1 = cupMatch(state, "sf1");
  const sf2 = cupMatch(state, "sf2");
  const fin = cupMatch(state, "final");
  const third = cupMatch(state, "third");
  const upNext = nextCupMatch(state)?.id;

  const live = useRef({ active, dispatch });
  useEffect(() => {
    live.current = { active, dispatch };
  });

  // the remote's Reset cup (it asks for confirmation itself): results cleared, seeds kept
  useEffect(() => {
    const onReset = () => live.current.active && live.current.dispatch({ type: "cupReset" });
    screenBus?.addEventListener("cupReset", onReset);
    return () => screenBus?.removeEventListener("cupReset", onReset);
  }, []);

  // keyboard backup: Shift+D twice within 2.5 s resets the cup
  const resetArm = useRef(0);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!live.current.active || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.key.toLowerCase() !== "d" || !e.shiftKey) return;
      e.preventDefault();
      const now = Date.now();
      if (now - resetArm.current < 2500) {
        live.current.dispatch({ type: "cupReset" });
        resetArm.current = 0;
      } else resetArm.current = now;
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  // each team's league rank, shown beside it in the bracket
  const rankOf = (id: string | undefined) => (id ? state.league.findIndex((l) => l.id === id) + 1 : 0);
  // a team not known yet (waiting on a semi-final) shows as "?"
  const names = (m: Match | undefined): [string | null, string | null] =>
    m ? (cupSlot(m).teams.map((t) => (t.leagueId ? t.name : null)) as [string | null, string | null]) : [null, null];
  const ranks = (m: Match | undefined): [number, number] =>
    m && !m.empty ? [rankOf(cupSlot(m).teams[0].leagueId), rankOf(cupSlot(m).teams[1].leagueId)] : [0, 0];

  const midY = (y: number) => y + CARD_H / 2;

  return (
    <div className="absolute inset-0" aria-hidden={!on}>
      <svg className="pointer-events-none absolute inset-0" width={1920} height={1080}>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <Frame on={on} x0={X0} y0={Y0} x1={X1} y1={Y1} />
          <Line on={on} d={260} dur={700} x1={X0} y1={TITLE_Y} x2={X1} y2={TITLE_Y} strong />
          {/* bracket connectors */}
          <DrawPath
            on={on}
            d={900}
            dur={700}
            width={1.5}
            stroke="rgba(255,255,255,0.22)"
            path={`M ${SF_X + CARD_W} ${midY(SF1_Y)} L ${JOIN_X} ${midY(SF1_Y)} L ${JOIN_X} ${midY(SF2_Y)} L ${SF_X + CARD_W} ${midY(SF2_Y)}`}
          />
          <DrawPath on={on} d={1250} dur={400} width={2} stroke="var(--pink)" glow="drop-shadow(0 0 6px rgba(255,29,120,0.5))" path={`M ${JOIN_X} ${midY(FIN_Y)} L ${FIN_X} ${midY(FIN_Y)}`} />
        </g>
      </svg>

      <ScreenTitle on={on} x0={X0} x1={X1} y0={Y0} y1={TITLE_Y} title="Champions Cup" />

      {/* ── Left: the league's top 4 ── */}
      <Reveal on={on} d={480} className="absolute" style={{ left: X0 + 50, top: 290, width: 440 }}>
        <div className="label mb-4 text-[14px]">League top 4</div>
        <Panel className="w-full" radius={20}>
          <div className="px-6 py-2">
            {top4.map((t, i) => (
              <div key={t.id} className="flex items-center gap-4 border-b border-white/[0.06] py-3.5 last:border-b-0">
                <span className={`digits w-10 text-[24px] font-bold ${i === 0 ? "text-[var(--green)]" : i === 1 ? "text-[var(--pink)]" : "text-[var(--text-faint)]"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="name flex-1 truncate text-[24px]">{t.name}</span>
                <span className="digits text-[24px] text-[var(--text-dim)]">{t.points}</span>
              </div>
            ))}
          </div>
        </Panel>
        <p className="mt-5 text-center text-[16px] font-medium text-[var(--text-dim)]">
          Semi-finals: <span className="text-white">1st v 4th</span> · <span className="text-white">2nd v 3rd</span>
        </p>
      </Reveal>

      {/* ── Bracket ── */}
      <BracketCard
        on={on}
        d={700}
        round="sf1"
        label="Semi-final 1"
        x={SF_X}
        y={SF1_Y}
        match={sf1}
        names={names(sf1)}
        ranks={ranks(sf1)}
        onOpen={onOpen}
        dispatch={dispatch}
      />
      <BracketCard
        on={on}
        d={800}
        round="sf2"
        label="Semi-final 2"
        x={SF_X}
        y={SF2_Y}
        match={sf2}
        names={names(sf2)}
        ranks={ranks(sf2)}
        onOpen={onOpen}
        dispatch={dispatch}
      />
      <BracketCard
        on={on}
        d={1300}
        round="final"
        label="Final"
        x={FIN_X}
        y={FIN_Y}
        match={fin}
        names={names(fin)}
        ranks={[0, 0]}
        playable={canOpen(state, fin)}
        next={upNext === fin?.id}
        onOpen={onOpen}
        dispatch={dispatch}
        big
      />
      <BracketCard
        on={on}
        d={1450}
        round="third"
        label="3rd place"
        x={FIN_X}
        y={THIRD_Y}
        match={third}
        names={names(third)}
        ranks={[0, 0]}
        playable={canOpen(state, third)}
        next={upNext === third?.id}
        onOpen={onOpen}
        dispatch={dispatch}
      />

    </div>
  );
}

function BracketCard({
  on, d, round, label, x, y, match, names, ranks, playable = !!match && !match.empty, next, onOpen, dispatch, big,
}: {
  on: boolean;
  d: number;
  round: CupRound;
  label: string;
  x: number;
  y: number;
  match: Match | undefined;
  names: [string | null, string | null];
  /** league rank of each team (0 = don't show) */
  ranks: [number, number];
  /** can be opened now (the final waits for the 3rd place match) */
  playable?: boolean;
  /** the cup match to play next: it glows */
  next?: boolean;
  onOpen: Props["onOpen"];
  dispatch: Props["dispatch"];
  big?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const slot = match?.games[cupGame(round)];
  const status = slot ? slotStatus(slot) : "upcoming";
  const done = status === "done";
  const winner = cupWinner(match);
  const tie = done && winner === null;
  const score = (i: TeamId) => (slot ? gameScore(cupGame(round), slot.teams[i]) : 0);

  return (
    <Reveal on={on} d={d} className="absolute" style={{ left: x, top: y, width: CARD_W, height: CARD_H }}>
      <button
        ref={ref}
        data-match={match?.id ?? `cup-${round}`}
        onClick={() => {
          if (!playable) return;
          if (ref.current && match) onOpen(match.id, ref.current);
        }}
        className="group relative block h-full w-full cursor-pointer text-left transition-transform duration-200 hover:scale-[1.03]"
      >
        <Panel className="h-full w-full" radius={20} tracer={status === "live" || (playable && !done && (next ?? big))}>
          <span className="panel-hover" />
          <div className="flex h-full flex-col justify-center px-6">
            <div className="mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2.5">
                <span className={`pill text-[12px] ${big ? "pill--pink" : ""}`}>{label}</span>
                <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--text-faint)]">{GAME_INFO[cupGame(round)].title}</span>
              </span>
              <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--text-dim)]">
                {tie ? <span className="text-[var(--cell-red)]">Tie</span> : done ? "Done" : status === "live" ? <span className="pink-text blink">Live</span> : playable ? "Ready" : match && !match.empty ? "After 3rd place" : ""}
              </span>
            </div>
            {([0, 1] as TeamId[]).map((i) => {
              const name = names[i];
              const isWin = winner === i;
              const isLose = winner !== null && winner !== i;
              return (
                <div
                  key={i}
                  onClick={(e) => {
                    if (!tie || !match) return;
                    e.stopPropagation(); // pick the winner of a tie
                    dispatch({ type: "cupPick", id: match.id, team: i });
                  }}
                  className={`flex items-center gap-3 rounded-xl border px-4 ${big ? "py-2.5" : "py-2"} ${i === 0 ? "mb-2" : ""} ${
                    isWin
                      ? i === 0
                        ? "border-[rgba(0,232,122,0.45)] bg-[rgba(0,232,122,0.08)] shadow-[0_8px_24px_-12px_rgba(0,232,122,0.6)]"
                        : "border-[rgba(255,29,120,0.45)] bg-[rgba(255,29,120,0.08)] shadow-[0_8px_24px_-12px_rgba(255,29,120,0.6)]"
                      : tie
                        ? "border-[rgba(242,85,107,0.5)] hover:bg-[rgba(242,85,107,0.08)]"
                        : "border-white/[0.08] bg-white/[0.02]"
                  } ${isLose ? "opacity-40" : ""}`}
                >
                  <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${i === 0 ? "bg-[var(--green-soft)]" : "bg-[var(--pink-soft)]"}`} />
                  {ranks[i] > 0 && <span className="digits w-7 shrink-0 text-[16px] text-[var(--text-faint)]">#{ranks[i]}</span>}
                  <span
                    key={name ?? "?"}
                    className={`name min-w-0 flex-1 truncate ${big ? "text-[26px]" : "text-[22px]"} ${
                      name ? (isWin ? `${i ? "pink-text" : "neon-text"} slam` : "text-white slam") : "text-[var(--text-faint)]"
                    }`}
                  >
                    {name ?? "?"}
                  </span>
                  {done && <span className={`digits text-[26px] ${isWin ? (i ? "pink-text" : "neon-text") : "text-[var(--text-dim)]"}`}>{score(i)}</span>}
                </div>
              );
            })}
          </div>
        </Panel>
      </button>
    </Reveal>
  );
}
