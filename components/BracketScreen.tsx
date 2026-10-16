"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  cupMatch,
  cupWinner,
  cupWinnerId,
  gameScore,
  slotStatus,
  type Action,
  type CupRound,
  type GameState,
  type Match,
  type TeamId,
} from "@/lib/game";
import { sfx } from "@/lib/sfx";
import { DrawPath, framePath, Line, Reveal } from "./Draw";
import HudFrame from "./HudFrame";

/* Cup (Mine): the league's top 4 on the left, DRAW shuffles them like a slot
   machine into two semi-finals, the winners meet in the final, and the final
   winner is crowned CHAMPION. Click a match card to play it. */

const X0 = 150;
const X1 = 1770;
const Y0 = 60;
const Y1 = 1020;
const CUT = 28;
const TITLE_Y = 212;

// bracket geometry (stage px)
const CARD_W = 430;
const CARD_H = 196;
const SF_X = 720;
const SF1_Y = 300;
const SF2_Y = 680;
const FIN_X = 1270;
const FIN_Y = 560;
const JOIN_X = 1205;
const CHAMP_Y = 300;

const ROLL_MS = 1900;
const LOCK_AT = [900, 1230, 1560, 1890]; // each slot stops rolling in turn

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
  const locked = [sf1, sf2, fin].some((m) => m?.games.game3.opened);
  const championId = cupWinnerId(fin);
  const champion = championId ? state.league.find((l) => l.id === championId)?.name ?? null : null;

  // slot-machine draw: rolling names per slot until each locks
  const [roll, setRoll] = useState<{ names: string[]; lockedCount: number } | null>(null);
  const [resetArm, setResetArm] = useState(false);
  const live = useRef({ active, locked, top4, rolling: false, dispatch, resetArm });
  useEffect(() => {
    live.current = { active, locked, top4, rolling: !!roll, dispatch, resetArm };
  });

  const draw = () => {
    const { locked: lk, top4: t4, rolling } = live.current;
    if (lk || rolling || t4.length < 4) return sfx.pointDown();
    const order = [...t4.map((t) => t.id)].sort(() => Math.random() - 0.5);
    const names = (id: string) => t4.find((t) => t.id === id)!.name;
    const t0 = performance.now();
    sfx.timerStart();
    let lastTick = 0;
    const iv = window.setInterval(() => {
      const el = performance.now() - t0;
      const lockedCount = LOCK_AT.filter((t) => el >= t).length;
      setRoll({
        lockedCount,
        names: order.map((id, i) => (i < lockedCount ? names(id) : t4[Math.floor(Math.random() * 4)].name)),
      });
      if (el - lastTick > 70) {
        sfx.keyTick();
        lastTick = el;
      }
      if (LOCK_AT.includes(Math.round(el / 10) * 10)) sfx.gridTick();
      if (el >= ROLL_MS) {
        clearInterval(iv);
        sfx.gain();
        live.current.dispatch({ type: "cupDraw", order });
        setTimeout(() => setRoll(null), 50);
      }
    }, 45);
  };
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const { active: on, locked: lk } = live.current;
      if (!on || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (e.key.toLowerCase() !== "d") return;
      e.preventDefault();
      if (e.shiftKey) {
        // Shift+D twice: reset the whole cup
        if (live.current.resetArm) {
          sfx.newMatch();
          live.current.dispatch({ type: "cupReset" });
          setResetArm(false);
        } else {
          sfx.pointDown();
          setResetArm(true);
        }
        return;
      }
      if (!lk) drawRef.current();
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);
  useEffect(() => {
    if (!resetArm) return;
    const t = setTimeout(() => setResetArm(false), 2500);
    return () => clearTimeout(t);
  }, [resetArm]);

  // champion fanfare when a champion appears on screen
  const lastChamp = useRef<string | null>(null);
  useEffect(() => {
    if (!on || !championId || lastChamp.current === championId) return;
    lastChamp.current = championId;
    sfx.slam(0.9);
    sfx.shimmer(1.0);
    sfx.gain(1.3);
  }, [on, championId]);

  // names shown in the 4 semi-final spots (rolling during the draw)
  const spot = (m: Match | undefined, i: 0 | 1, rollIdx: number) =>
    roll ? roll.names[rollIdx] : m && !m.empty ? m.games.game3.teams[i].name : null;

  const midY = (y: number) => y + CARD_H / 2;

  return (
    <div className="absolute inset-0" aria-hidden={!on}>
      <svg className="pointer-events-none absolute inset-0" width={1920} height={1080}>
        <g fill="none" strokeLinecap="square">
          <DrawPath on={on} d={0} dur={1100} path={framePath(X0, Y0, X1, Y1, CUT)} glow="drop-shadow(0 0 5px rgba(41,224,143,0.85))" />
          <Line on={on} d={260} dur={700} x1={X0} y1={TITLE_Y} x2={X1} y2={TITLE_Y} strong />
          {/* bracket connectors */}
          <DrawPath
            on={on}
            d={900}
            dur={700}
            width={2}
            glow="drop-shadow(0 0 4px rgba(41,224,143,0.7))"
            path={`M ${SF_X + CARD_W} ${midY(SF1_Y)} L ${JOIN_X} ${midY(SF1_Y)} L ${JOIN_X} ${midY(SF2_Y)} L ${SF_X + CARD_W} ${midY(SF2_Y)}`}
          />
          <DrawPath on={on} d={1250} dur={400} width={2} stroke="var(--pink)" glow="drop-shadow(0 0 6px var(--pink))" path={`M ${JOIN_X} ${midY(FIN_Y)} L ${FIN_X} ${midY(FIN_Y)}`} />
          <DrawPath
            on={on}
            d={1500}
            dur={400}
            width={2}
            stroke="var(--pink)"
            glow="drop-shadow(0 0 6px var(--pink))"
            path={`M ${FIN_X + CARD_W / 2} ${FIN_Y} L ${FIN_X + CARD_W / 2} ${CHAMP_Y + 150}`}
          />
        </g>
      </svg>

      <Reveal on={on} d={320} className="absolute left-0 right-0 text-center" style={{ top: Y0 + 26 }}>
        <div className="text-[15px] font-semibold uppercase tracking-[0.55em] text-[var(--text-dim)]">TRSYP 3.0 · Cup · Mine</div>
        <h1 className="neon-text mt-1 font-[family-name:var(--font-display)] text-[68px] uppercase leading-none tracking-[0.22em]">
          Champions Cup
        </h1>
      </Reveal>

      {/* ── Left: the league's top 4 + DRAW ── */}
      <Reveal on={on} d={480} className="absolute" style={{ left: X0 + 50, top: 290, width: 440 }}>
        <div className="mb-3 text-[15px] font-semibold uppercase tracking-[0.45em] text-[var(--text-dim)]">League top 4</div>
        <HudFrame className="w-full" cut={16}>
          <div className="px-6 py-3">
            {top4.map((t, i) => (
              <div key={t.id} className="flex items-center gap-4 border-b border-[var(--neon-dim)] py-3 last:border-b-0">
                <span className="digits pink-text w-10 text-[30px]">{String(i + 1).padStart(2, "0")}</span>
                <span className="flex-1 truncate font-[family-name:var(--font-display)] text-[28px] uppercase tracking-[0.08em]">{t.name}</span>
                <span className="digits text-[26px] text-[var(--text-dim)]">{t.points}</span>
              </div>
            ))}
          </div>
        </HudFrame>
        <button
          onClick={() => drawRef.current()}
          disabled={locked || !!roll}
          className={`mt-8 w-full cursor-pointer border-2 py-5 font-[family-name:var(--font-display)] text-[40px] uppercase tracking-[0.35em] transition-[transform,box-shadow] duration-200 disabled:cursor-not-allowed ${
            locked
              ? "border-[var(--neon-dim)] text-[var(--neon-dim)]"
              : "neon-text border-[var(--neon)] shadow-[0_0_24px_rgba(41,224,143,0.45)] enabled:hover:scale-[1.03] enabled:hover:shadow-[0_0_40px_rgba(41,224,143,0.7)]"
          }`}
        >
          {roll ? "Drawing…" : locked ? "Draw locked" : sf1 ? "Redraw" : "Draw"}
        </button>
        <div className="mt-3 text-center text-[12px] uppercase tracking-[0.35em] text-[var(--text-dim)]">
          {resetArm ? <span className="text-[var(--cell-red)]">Shift+D again to reset the cup</span> : "D draw · Shift+D twice reset"}
        </div>
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
        names={[spot(sf1, 0, 0), spot(sf1, 1, 1)]}
        rolling={roll ? [roll.lockedCount <= 0, roll.lockedCount <= 1] : [false, false]}
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
        names={[spot(sf2, 0, 2), spot(sf2, 1, 3)]}
        rolling={roll ? [roll.lockedCount <= 2, roll.lockedCount <= 3] : [false, false]}
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
        names={[fin && !fin.games.game3.teams[0].name.startsWith("TBD") ? fin.games.game3.teams[0].name : null, fin && !fin.games.game3.teams[1].name.startsWith("TBD") ? fin.games.game3.teams[1].name : null]}
        rolling={[false, false]}
        onOpen={onOpen}
        dispatch={dispatch}
        big
      />

      {/* ── Champion spot ── */}
      <Reveal on={on} d={1600} className="absolute flex flex-col items-center" style={{ left: FIN_X, width: CARD_W, top: CHAMP_Y - 60 }}>
        <Trophy lit={!!champion} />
        {champion ? (
          <div key={championId} className="relative flex flex-col items-center">
            <span className="slam pink-text mt-2 font-[family-name:var(--font-display)] text-[26px] uppercase tracking-[0.5em]" style={{ "--delay": "500ms" } as CSSProperties}>
              Champion
            </span>
            <span
              className="slam neon-text font-[family-name:var(--font-display)] text-[54px] uppercase leading-none tracking-[0.1em]"
              style={{ "--delay": "900ms", textShadow: "0 0 18px rgba(41,224,143,0.9), 0 0 60px rgba(41,224,143,0.5), 5px 0 0 rgba(255,79,216,0.5)" } as CSSProperties}
            >
              {champion}
            </span>
            <span className="shockwave absolute left-1/2 top-1/2 h-32 w-32 rounded-full border-[3px] border-[var(--pink)] shadow-[0_0_30px_var(--pink)]" style={{ "--delay": "1000ms" } as CSSProperties} />
            <span className="shockwave absolute left-1/2 top-1/2 h-32 w-32 rounded-full border-2 border-[var(--neon)]" style={{ "--delay": "1180ms" } as CSSProperties} />
          </div>
        ) : (
          <span className="mt-2 text-[15px] font-semibold uppercase tracking-[0.5em] text-[var(--text-dim)]">Champion</span>
        )}
      </Reveal>

      <Reveal on={on} d={1000} className="absolute left-0 right-0 text-center text-[13px] uppercase tracking-[0.4em] text-[var(--text-dim)] opacity-70" style={{ top: Y1 - 40 }}>
        D draw · click a match to play it · the higher Mine score goes through · Tab leaderboard · Z back
      </Reveal>
    </div>
  );
}

function BracketCard({
  on, d, round, label, x, y, match, names, rolling, onOpen, dispatch, big,
}: {
  on: boolean;
  d: number;
  round: CupRound;
  label: string;
  x: number;
  y: number;
  match: Match | undefined;
  names: [string | null, string | null];
  rolling: [boolean, boolean];
  onOpen: Props["onOpen"];
  dispatch: Props["dispatch"];
  big?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const slot = match?.games.game3;
  const status = slot ? slotStatus(slot) : "upcoming";
  const done = status === "done";
  const winner = cupWinner(match);
  const tie = done && winner === null;
  const playable = !!match && !match.empty;
  const score = (i: TeamId) => (slot ? gameScore("game3", slot.teams[i]) : 0);

  return (
    <Reveal on={on} d={d} className="absolute" style={{ left: x, top: y, width: CARD_W, height: CARD_H }}>
      <button
        ref={ref}
        data-match={match?.id ?? `cup-${round}`}
        onClick={() => {
          if (!playable) return sfx.pointDown();
          if (ref.current && match) onOpen(match.id, ref.current);
        }}
        className="group relative block h-full w-full cursor-pointer text-left transition-transform duration-200 hover:scale-[1.03]"
      >
        <HudFrame className="h-full w-full" cut={16} tracer={status === "live" || (playable && !done && big)}>
          <div className="flex h-full flex-col justify-center px-6">
            <div className="mb-2 flex items-center justify-between">
              <span className={`text-[14px] font-semibold uppercase tracking-[0.4em] ${big ? "pink-text" : "text-[var(--text-dim)]"}`}>{label}</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-dim)]">
                {tie ? <span className="text-[var(--cell-red)]">Tie — click the winner</span> : done ? "Done" : status === "live" ? <span className="pink-text blink">Live</span> : playable ? "Ready" : ""}
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
                    sfx.gain();
                    dispatch({ type: "cupPick", id: match.id, team: i });
                  }}
                  className={`flex items-center justify-between border px-4 ${big ? "py-2.5" : "py-2"} ${i === 0 ? "mb-2" : ""} ${
                    isWin
                      ? "border-[var(--neon)] bg-[var(--neon-faint)] shadow-[0_0_14px_rgba(41,224,143,0.4)]"
                      : tie
                        ? "border-[var(--cell-red)] hover:bg-[#1a0610]"
                        : "border-[var(--neon-dim)]"
                  } ${isLose ? "opacity-40" : ""}`}
                >
                  <span
                    key={name ?? "?"}
                    className={`truncate font-[family-name:var(--font-display)] uppercase tracking-[0.08em] ${big ? "text-[30px]" : "text-[26px]"} ${
                      name ? (rolling[i] ? "pink-text" : isWin ? "neon-text slam" : "text-[var(--text)] slam") : "text-[var(--neon-dim)]"
                    }`}
                  >
                    {name ?? "?"}
                  </span>
                  {done && <span className={`digits text-[28px] ${isWin ? "neon-text" : "text-[var(--text-dim)]"}`}>{score(i)}</span>}
                </div>
              );
            })}
          </div>
        </HudFrame>
      </button>
    </Reveal>
  );
}

function Trophy({ lit }: { lit: boolean }) {
  return (
    <svg
      width="110"
      height="110"
      viewBox="0 0 24 24"
      fill="none"
      stroke={lit ? "var(--neon)" : "var(--neon-dim)"}
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={lit ? "pulse-glow" : ""}
      style={lit ? { filter: "drop-shadow(0 0 12px rgba(41,224,143,0.9))" } : undefined}
    >
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
    </svg>
  );
}
