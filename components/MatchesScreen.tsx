"use client";

import { useEffect, useRef, useState } from "react";
import {
  cumulative,
  GAME_INFO,
  leagueMatches,
  nextMatchId,
  slotStatus,
  type Action,
  type GameKind,
  type GameState,
  type Match,
} from "@/lib/game";
import { sfx } from "@/lib/sfx";
import { DrawPath, framePath, Line, Reveal } from "./Draw";
import HudFrame from "./HudFrame";

/* Screen 0 (league): the 9 match slots as cards. Click a card to open it (the
   stage zooms into it). Played matches are dimmed, the next one to play
   glows. Hover a slot + N = set its two teams (1–9, then 1–9);
   hover + Delete twice = clear the slot. */

const X0 = 150;
const X1 = 1770;
const Y0 = 60;
const Y1 = 1020;
const CUT = 28;
const TITLE_Y = 212;
const GRID_TOP = 262;
const GRID_BOTTOM = 960;

interface Props {
  on: boolean;
  active: boolean;
  state: GameState;
  dispatch: (a: Action) => void;
  onOpen: (id: string, card: HTMLElement) => void;
}

export default function MatchesScreen({ on, active, state, dispatch, onOpen }: Props) {
  const { league } = state;
  const matches = leagueMatches(state);
  const nextId = nextMatchId(state, state.game);
  // which slot is being filled, and team A once chosen
  const [picking, setPicking] = useState<{ slot: string; a: string | null } | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const hover = useRef<string | null>(null);
  const firstEmpty = leagueMatches(state).find((m) => m.empty)?.id ?? null;
  const live = useRef({ active, picking, armed, league, dispatch, firstEmpty });
  useEffect(() => {
    live.current = { active, picking, armed, league, dispatch, firstEmpty };
  });

  // teams listed 1–9 in a fixed order (not by rank), so the keys never change
  const roster = [...league].sort((p, q) => parseInt(p.id.slice(1)) - parseInt(q.id.slice(1)));

  const pick = (id: string) => {
    const p = live.current.picking;
    if (!p) return;
    if (!p.a) {
      sfx.gridTick();
      setPicking({ ...p, a: id });
    } else if (id !== p.a) {
      sfx.gain();
      live.current.dispatch({ type: "setPair", id: p.slot, a: p.a, b: id });
      setPicking(null);
    }
  };
  const pickRef = useRef(pick);
  useEffect(() => {
    pickRef.current = pick;
  });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const { active: on, picking: p, armed: arm } = live.current;
      if (!on || e.ctrlKey || e.metaKey || e.altKey) return;
      const letter = e.key.toLowerCase();

      if (p) {
        e.preventDefault();
        if (e.key === "Escape") setPicking(null);
        else if (e.key === "Backspace") setPicking({ ...p, a: null });
        else {
          const digit = /^(Digit|Numpad)([1-9])$/.exec(e.code)?.[2];
          if (digit) {
            const ordered = [...live.current.league].sort((x, y) => parseInt(x.id.slice(1)) - parseInt(y.id.slice(1)));
            const t = ordered[+digit - 1];
            if (t) pickRef.current(t.id);
          }
        }
        return;
      }
      if (letter === "n") {
        // fill the hovered slot (or the first empty one)
        const slot = hover.current ?? live.current.firstEmpty;
        if (!slot) return;
        e.preventDefault();
        sfx.timerStart();
        setPicking({ slot, a: null });
        return;
      }
      if (e.key === "Delete" && hover.current) {
        e.preventDefault();
        const id = hover.current;
        if (arm === id) {
          sfx.shapeRemove();
          live.current.dispatch({ type: "clearMatch", id });
          setArmed(null);
        } else {
          sfx.pointDown();
          setArmed(id);
        }
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  // a "press Delete again" warning expires after 2 s
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(null), 2000);
    return () => clearTimeout(t);
  }, [armed]);

  // 9 slots: a 3 × 3 grid
  const cols = 3;
  const rows = 3;
  const gap = 28;
  const cardW = (X1 - X0 - 120 - gap * (cols - 1)) / cols;
  const cardH = Math.min(190, (GRID_BOTTOM - GRID_TOP - gap * (rows - 1)) / rows);

  return (
    <div className="absolute inset-0" aria-hidden={!on}>
      <svg className="pointer-events-none absolute inset-0" width={1920} height={1080}>
        <g fill="none" strokeLinecap="square">
          <DrawPath on={on} d={0} dur={1100} path={framePath(X0, Y0, X1, Y1, CUT)} glow="drop-shadow(0 0 5px rgba(41,224,143,0.85))" />
          <Line on={on} d={260} dur={700} x1={X0} y1={TITLE_Y} x2={X1} y2={TITLE_Y} strong />
        </g>
      </svg>

      <Reveal on={on} d={320} className="absolute left-0 right-0 text-center" style={{ top: Y0 + 26 }}>
        <div className="text-[15px] font-semibold uppercase tracking-[0.55em] text-[var(--text-dim)]">
          TRSYP 3.0 · Game {String(GAME_INFO[state.game].num).padStart(2, "0")} · {GAME_INFO[state.game].title}
        </div>
        <h1 className="neon-text mt-1 font-[family-name:var(--font-display)] text-[68px] uppercase leading-none tracking-[0.22em]">
          Matches
        </h1>
      </Reveal>

      {matches.map((m, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        return (
          <Reveal
            key={m.id}
            on={on}
            d={480 + i * 60}
            className="absolute"
            style={{ left: X0 + 60 + col * (cardW + gap), top: GRID_TOP + row * (cardH + gap), width: cardW, height: cardH }}
          >
            <Card
              match={m}
              game={state.game}
              next={m.id === nextId}
              compact={cardH < 150}
              armed={armed === m.id}
              onEnter={() => (hover.current = m.id)}
              onLeave={() => (hover.current = null)}
              onOpen={(el) => onOpen(m.id, el)}
            />
          </Reveal>
        );
      })}

      <Reveal on={on} d={900} className="absolute left-0 right-0 text-center text-[13px] uppercase tracking-[0.4em] text-[var(--text-dim)] opacity-70" style={{ top: Y1 - 40 }}>
        Click a match to open · hover a slot + N to set its teams · hover + Delete twice to clear · Tab leaderboard · Z back
      </Reveal>

      {picking && (
        <Picker
          roster={roster}
          a={picking.a}
          onPick={(id) => pickRef.current(id)}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}

const STATUS = {
  upcoming: { label: "Upcoming", cls: "text-[var(--text-dim)] border-[var(--neon-dim)]" },
  live: { label: "Live", cls: "pink-text border-[var(--pink)] blink" },
  done: { label: "Done", cls: "neon-text border-[var(--neon)]" },
} as const;

function Card({
  match, game, next, compact, armed, onEnter, onLeave, onOpen,
}: {
  match: Match;
  game: GameKind;
  next: boolean;
  compact: boolean;
  armed: boolean;
  onEnter: () => void;
  onLeave: () => void;
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
  const nameCls = (i: number) =>
    lead === -1 ? "text-[var(--text)]" : lead === i ? "neon-text" : "text-[var(--text-dim)] opacity-70";

  const empty = !!match.empty;
  const done = status === "done";
  return (
    <button
      ref={ref}
      data-match={match.id}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onClick={() => {
        if (empty) return sfx.pointDown(); // no teams yet
        if (ref.current) onOpen(ref.current);
      }}
      className={`group relative block h-full w-full cursor-pointer text-left transition-[transform,opacity,filter] duration-300 focus-visible:outline-none ${
        next ? "next-match z-10" : "hover:scale-[1.03]"
      } ${done ? "opacity-45 grayscale-[70%] hover:opacity-80" : ""} ${empty ? "opacity-60" : ""}`}
    >
      <HudFrame className="h-full w-full" cut={16} tracer={next || status === "live"} traceDuration={next ? 3.5 : 5}>
        <div className={`flex h-full flex-col justify-center ${compact ? "px-5" : "px-7"}`}>
          <div className="flex items-center justify-between">
            <span className="digits text-[14px] uppercase tracking-[0.35em] text-[var(--text-dim)]">
              Match {String(match.num).padStart(2, "0")}
            </span>
            {empty ? (
              <span className="border border-[var(--neon-dim)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3em] text-[var(--text-dim)]">
                Set teams
              </span>
            ) : next ? (
              <span className="pink-text blink border border-[var(--pink)] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3em]">
                Next match
              </span>
            ) : (
              <span className={`border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3em] ${STATUS[status].cls}`}>
                {STATUS[status].label}
              </span>
            )}
          </div>
          <div
            className={`flex items-center justify-between gap-3 font-[family-name:var(--font-display)] uppercase tracking-[0.08em] ${compact ? "mt-1.5 text-[24px]" : "mt-3 text-[32px]"}`}
          >
            <span className={`truncate ${empty ? "text-[var(--neon-dim)]" : nameCls(0)}`}>{a.name}</span>
            <span className="pink-text shrink-0 text-[0.6em]">VS</span>
            <span className={`truncate text-right ${empty ? "text-[var(--neon-dim)]" : nameCls(1)}`}>{b.name}</span>
          </div>
          {done && (
            <div className={`digits flex justify-between ${compact ? "text-[20px]" : "mt-1 text-[28px]"}`}>
              <span className={nameCls(0)}>{ta}</span>
              <span className={nameCls(1)}>{tb}</span>
            </div>
          )}
        </div>
        {/* hover glow */}
        <span className="pointer-events-none absolute inset-0 opacity-0 shadow-[inset_0_0_30px_rgba(41,224,143,0.35)] transition-opacity duration-200 group-hover:opacity-100" />
        {armed && (
          <span className="absolute inset-0 flex items-center justify-center bg-[#1a0610]/85 text-[15px] font-semibold uppercase tracking-[0.3em] text-[var(--cell-red)]">
            Press Delete again to clear
          </span>
        )}
      </HudFrame>
    </button>
  );
}

function Picker({
  roster, a, onPick, onClose,
}: { roster: GameState["league"]; a: string | null; onPick: (id: string) => void; onClose: () => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/65" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <HudFrame className="w-[860px]" cut={22} tracer>
          <div className="p-10">
            <h3 className="neon-text font-[family-name:var(--font-display)] text-[36px] uppercase tracking-[0.2em]">New match</h3>
            <p className="mt-1 text-[15px] font-semibold uppercase tracking-[0.35em] text-[var(--text-dim)]">
              {a ? "Pick team B" : "Pick team A"} — press 1–9 · Backspace undo · Esc cancel
            </p>
            <div className="mt-7 grid grid-cols-3 gap-3">
              {roster.map((t, i) => {
                const chosen = t.id === a;
                return (
                  <button
                    key={t.id}
                    disabled={chosen}
                    onClick={() => onPick(t.id)}
                    className={`flex cursor-pointer items-center gap-3 border px-4 py-3 text-left transition-colors duration-150 ${
                      chosen
                        ? "border-[var(--pink)] bg-[var(--pink-dim)]/20"
                        : "border-[var(--neon-dim)] hover:border-[var(--neon)] hover:bg-[var(--neon-faint)]"
                    }`}
                  >
                    <span className="digits pink-text text-[24px]">{i + 1}</span>
                    <span className="truncate font-[family-name:var(--font-display)] text-[22px] uppercase tracking-[0.08em]">{t.name}</span>
                    {chosen && <span className="ml-auto text-[11px] uppercase tracking-[0.3em] text-[var(--pink)]">Team A</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </HudFrame>
      </div>
    </div>
  );
}
