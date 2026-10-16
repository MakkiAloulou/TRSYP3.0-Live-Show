"use client";

import { useEffect, useRef, useState } from "react";
import { matchStatus, teamTotal, type Action, type GameState, type Match } from "@/lib/game";
import { sfx } from "@/lib/sfx";
import { DrawPath, framePath, Line, Reveal } from "./Draw";
import HudFrame from "./HudFrame";

/* Screen 0: every match as a card. Click a card to open it (the stage zooms
   into it). Keyboard: N = new match (then 1–9 for team A and team B),
   hover a card + Delete twice = remove it. */

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
  const { matches, league } = state;
  const [picking, setPicking] = useState<{ a: string | null } | null>(null);
  const [armed, setArmed] = useState<string | null>(null);
  const hover = useRef<string | null>(null);
  const live = useRef({ active, picking, armed, league, dispatch });
  useEffect(() => {
    live.current = { active, picking, armed, league, dispatch };
  });

  // teams listed 1–9 in a fixed order (not by rank), so the keys never change
  const roster = [...league].sort((p, q) => parseInt(p.id.slice(1)) - parseInt(q.id.slice(1)));

  const pick = (id: string) => {
    const p = live.current.picking;
    if (!p) return;
    if (!p.a) {
      sfx.gridTick();
      setPicking({ a: id });
    } else if (id !== p.a) {
      sfx.gain();
      live.current.dispatch({ type: "addMatch", a: p.a, b: id });
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
        else if (e.key === "Backspace") setPicking({ a: null });
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
        e.preventDefault();
        sfx.timerStart();
        setPicking({ a: null });
        return;
      }
      if (e.key === "Delete" && hover.current) {
        e.preventDefault();
        const id = hover.current;
        if (arm === id) {
          sfx.shapeRemove();
          live.current.dispatch({ type: "deleteMatch", id });
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

  // grid sizing: 3 columns up to 9 matches, then 4 columns with shorter cards
  const n = matches.length + 0;
  const cols = n <= 9 ? 3 : 4;
  const rows = Math.max(1, Math.ceil(n / cols));
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
          TRSYP 3.0 · Polygame
        </div>
        <h1 className="neon-text mt-1 font-[family-name:var(--font-display)] text-[68px] uppercase leading-none tracking-[0.22em]">
          Matches
        </h1>
      </Reveal>

      {matches.length === 0 && (
        <Reveal on={on} d={500} className="absolute left-0 right-0 text-center" style={{ top: 520 }}>
          <span className="text-[26px] font-semibold uppercase tracking-[0.4em] text-[var(--text-dim)]">
            Press <span className="pink-text">N</span> to add a match
          </span>
        </Reveal>
      )}

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
        N new match · click a match to open · hover + Delete twice to remove · Z back here from any screen
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
  match, compact, armed, onEnter, onLeave, onOpen,
}: { match: Match; compact: boolean; armed: boolean; onEnter: () => void; onLeave: () => void; onOpen: (el: HTMLElement) => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const status = matchStatus(match);
  const [a, b] = match.teams;
  const ta = teamTotal(a.stats);
  const tb = teamTotal(b.stats);
  const lead = status === "done" ? (ta === tb ? -1 : ta > tb ? 0 : 1) : -1;
  const nameCls = (i: number) =>
    lead === -1 ? "text-[var(--text)]" : lead === i ? "neon-text" : "text-[var(--text-dim)] opacity-70";

  return (
    <button
      ref={ref}
      data-match={match.id}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onClick={() => ref.current && onOpen(ref.current)}
      className="group relative block h-full w-full cursor-pointer text-left transition-transform duration-200 hover:scale-[1.03] focus-visible:outline-none"
    >
      <HudFrame className="h-full w-full" cut={16} tracer={status === "live"} traceDuration={5}>
        <div className={`flex h-full flex-col justify-center ${compact ? "px-5" : "px-7"}`}>
          <div className="flex items-center justify-between">
            <span className="digits text-[14px] uppercase tracking-[0.35em] text-[var(--text-dim)]">
              Match {String(match.num).padStart(2, "0")}
            </span>
            <span className={`border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.3em] ${STATUS[status].cls}`}>
              {STATUS[status].label}
            </span>
          </div>
          <div
            className={`flex items-center justify-between gap-3 font-[family-name:var(--font-display)] uppercase tracking-[0.08em] ${compact ? "mt-1.5 text-[24px]" : "mt-3 text-[32px]"}`}
          >
            <span className={`truncate ${nameCls(0)}`}>{a.name}</span>
            <span className="pink-text shrink-0 text-[0.6em]">VS</span>
            <span className={`truncate text-right ${nameCls(1)}`}>{b.name}</span>
          </div>
          {status === "done" && (
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
            Press Delete again to remove
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
