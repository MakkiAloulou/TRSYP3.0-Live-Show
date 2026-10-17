"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { elapsedMs, formatTime, GLITCH_CARDS, GREEN_FREEZE_SECS, type Action, type GameKind, type TeamId, type TeamState, type TimerState } from "@/lib/game";
import { phaseScore, scoreFor } from "@/lib/scoring";
import ColorGrid from "./ColorGrid";
import { phaseOf, useEffectClock, type Phase } from "./effectClock";
import Panel from "./Panel";
import ShapesBoard from "./ShapesBoard";

interface Props {
  id: TeamId;
  team: TeamState;
  /** the other team (Mine: its glitch cards hit this one) */
  opponent?: TeamState;
  dispatch: (a: Action) => void;
  /** false while another screen is showing, so typing can't edit this grid */
  active: boolean;
  /** Polygame shows shapes + grid; Garden shows the chances counter; Mine shows nothing there */
  variant?: "polygame" | "garden" | "mine";
  /** Score carried in from earlier games (added to the current total) */
  carried?: number;
}

export default function TeamPanel({ id, team, opponent, dispatch, active, variant = "polygame" }: Props) {
  const [editing, setEditing] = useState(false);
  const frozen = Object.entries(team.shapes).filter(([, v]) => v === "frozen").map(([k]) => k).sort();
  const game: GameKind = variant === "mine" ? "game3" : variant;
  // Polygame: the clock shows the phase in progress from 0 (or the phase just ended)
  const splits = team.splits ?? [];
  const inPhase = team.timer.running || team.timer.accumulated > (splits[splits.length - 1] ?? 0);
  const sinceMs = inPhase ? (splits[splits.length - 1] ?? 0) : (splits[splits.length - 2] ?? 0);
  const timerLabel =
    variant !== "polygame"
      ? "Timer"
      : splits.length >= 3
        ? "All phases done"
        : inPhase || splits.length === 0
          ? `Phase ${splits.length + 1}`
          : `Phase ${splits.length} done`;
  const score = scoreFor(game, team);
  const st = team.stats;
  // Polygame: the opponent's green triangle freezing this team (the latest, if two overlap)
  const greens = Object.values(opponent?.greens ?? {});
  const now = useEffectClock(greens.map((at) => [at, GREEN_FREEZE_SECS] as const));
  // in effect once its countdown is over (the countdown itself shows across the screen)
  const ice =
    variant === "polygame"
      ? greens
          .map((at) => ({ at, p: phaseOf(at, GREEN_FREEZE_SECS, now) }))
          .filter((x) => x.p.kind === "live")
          .sort((a, b) => b.at - a.at)[0]
      : undefined;
  const iceAt = ice?.at;
  const iceLeft = ice?.p.kind === "live" ? ice.p.left : null;
  const phasesScored = [0, 1, 2]
    .filter((i) => st[`pos${i + 1}` as "pos1"] || st[`acc${i + 1}` as "acc1"] || st[`time${i + 1}` as "time1"])
    .map((i) => ({ i, pts: phaseScore(team, i) }));

  return (
    <section className="flex h-full flex-col items-center gap-3" aria-label={team.name}>
      {/* Team name — double-click to rename. PINNED sits beside it: the camera
          area below is covered by the OBS stream, so nothing can go there. */}
      <div className="relative flex h-[46px] w-full items-center justify-center gap-5">
        <span className={`diamond ${id ? "diamond--pink" : ""}`} />
        {editing ? (
          <input
            autoFocus
            defaultValue={team.name}
            aria-label="Team name"
            onBlur={(e) => {
              dispatch({ type: "rename", team: id, name: e.currentTarget.value.trim() || team.name });
              setEditing(false);
            }}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
            }}
            className="name w-[420px] border-b border-[var(--green)] bg-transparent text-center text-[32px] text-[var(--green)] outline-none"
          />
        ) : (
          <h2
            onDoubleClick={() => setEditing(true)}
            className="name cursor-text select-none text-[32px] leading-none text-white"
          >
            {team.name}
          </h2>
        )}
        <span className={`diamond ${id ? "diamond--pink" : ""}`} />
        {variant === "polygame" && team.pinned && (
          <span className="slam title absolute right-6 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-full border border-[rgba(242,85,107,0.6)] bg-[#1a0711] px-5 py-2 text-[22px] leading-none text-[var(--cell-red)] shadow-[0_10px_30px_-10px_rgba(242,85,107,0.8)]">
            <PinIcon />
            Pinned
          </span>
        )}
      </div>

      {/* Live camera placeholder — the video is laid over this when screen sharing */}
      <Panel className="h-[396px] w-[704px] shrink-0" radius={16} corner={id} tracer traceDuration={id === 0 ? 8 : 9.5}>
        <div className="flex h-full w-full items-center justify-center">
          {/* only a guide for lining up the OBS camera: the stream covers this area */}
          <span className="title text-[24px] tracking-[0.3em] text-white/15">Cam {id + 1}</span>
        </div>
      </Panel>

      {/* Polygame: shapes board (left) + 5x5 grid (right) · Garden: chances left */}
      {variant === "mine" ? (
        <MinePanel id={id} team={team} opponent={opponent} />
      ) : variant === "garden" ? (
        <Chances
          value={team.chances}
          onChange={(delta) => dispatch({ type: "useChance", team: id, delta })}
        />
      ) : (
      <div className="relative flex h-[290px] w-full items-stretch gap-4 px-2">
        {/* frozen by the opponent's green triangle: frost sweeps the boards, a veil holds while it lasts */}
        {iceLeft !== null && (
          <div key={iceAt} className="ice-veil pointer-events-none absolute inset-0 z-10 overflow-hidden rounded-[20px]" aria-hidden>
            <div className="frost-sweep absolute inset-0" />
          </div>
        )}
        <Panel className="min-w-0 flex-1" quiet>
          <div className="flex h-full flex-col px-5 pb-3 pt-3.5">
            <Label>Shapes</Label>
            <div className="min-h-0 flex-1 pt-1">
              <ShapesBoard
                shapes={team.shapes}
                onChange={(sid, state) => dispatch({ type: "setShape", team: id, id: sid, state })}
              />
            </div>
          </div>
          {/* pin penalty: frost sweeps the board while the pieces freeze, with the count */}
          {frozen.length > 0 && (
            <div key={frozen.join()} className="pointer-events-none absolute inset-0 overflow-hidden rounded-[18px]" aria-hidden>
              <div className="frost-sweep absolute inset-0" />
              <span className="frost-label title absolute bottom-3 left-1/2 whitespace-nowrap rounded-full border border-[#bfe9ff]/60 bg-[#06223a]/85 px-5 py-1.5 text-[18px] tracking-[0.14em] text-[#dff5ff]">
                {frozen.length} {frozen.length === 1 ? "piece" : "pieces"} frozen
              </span>
            </div>
          )}
        </Panel>
        <Panel className="w-[290px] shrink-0" quiet>
          <div className="flex h-full flex-col items-center px-4 pb-4 pt-3.5">
            <Label>Grid</Label>
            <div className="min-h-0 flex-1 pt-2">
              <ColorGrid
                grid={team.grid}
                active={active}
                onCell={(i, half) => dispatch({ type: "cycleCell", team: id, index: i, half })}
                onHalf={(i, half) => dispatch({ type: "cycleHalf", team: id, index: i, half })}
                onKey={(i, half, key) => dispatch({ type: "editLabel", team: id, index: i, half, key })}
              />
            </div>
          </div>
        </Panel>
      </div>
      )}

      {/* Timer | score (Mine shows them large above, in place of the boards) */}
      {variant !== "mine" && (
      <Panel className={`h-[112px] w-full shrink-0 ${iceLeft !== null ? "ice-panel" : ""}`} corner={id}>
        <div className="grid h-full grid-cols-2">
          <div className="flex flex-col items-center justify-center gap-1.5 border-r border-white/[0.07]">
            {iceLeft !== null ? (
              <span key={iceAt} className="ice-tag title flex items-center gap-2 rounded-full px-3 py-[3px] text-[13px] leading-none">
                <SnowIcon />
                Frozen
                <span className="digits text-[14px] font-bold normal-case">{(iceLeft / 1000).toFixed(1)}s</span>
              </span>
            ) : (
              <Label>{timerLabel}</Label>
            )}
            <TimerDisplay timer={team.timer} since={variant === "polygame" ? sinceMs : 0} />
          </div>
          <div className="flex flex-col items-center justify-center gap-1.5">
            <Label>Score</Label>
            {/* the scored stats sent so far; it bumps whenever an update lands */}
            <span key={score} className={`score-bump digits text-[46px] font-bold leading-none ${id ? "pink-text" : "neon-text"}`} aria-live="polite">
              {score}
            </span>
            {variant === "polygame" && phasesScored.length > 0 && (
              <span className="flex gap-2">
                {phasesScored.map((p) => (
                  <span key={p.i} className="digits rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[13px] text-[var(--text-dim)]">
                    P{p.i + 1} <span className="text-white">{p.pts}</span>
                  </span>
                ))}
              </span>
            )}
          </div>
        </div>
        {iceLeft !== null && (
          <span className="ice-drain absolute bottom-0 left-0 h-[3px] rounded-full" style={{ width: `${(iceLeft / (GREEN_FREEZE_SECS * 1000)) * 100}%` }} />
        )}
      </Panel>
      )}
    </section>
  );
}

function SnowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11M9 3.5l3 2.5 3-2.5M9 20.5l3-2.5 3 2.5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
  );
}

/** Mine: the team's three glitch cards above its timer. No score: it's shown after the match.
    A card the opponent plays shows above this team's timer while it lasts. */
function MinePanel({ id, team, opponent }: { id: TeamId; team: TeamState; opponent?: TeamState }) {
  const now = useEffectClock([team, opponent].flatMap((t) => GLITCH_CARDS.map((c) => [t?.cards?.[c.id], c.secs] as const)));
  // the opponent's card hitting this team (the latest, if two overlap)
  const hit = GLITCH_CARDS.map((c) => ({ c, at: opponent?.cards?.[c.id], p: phaseOf(opponent?.cards?.[c.id], c.secs, now) }))
    .flatMap((h) => (h.p.kind === "live" ? [{ ...h, left: h.p.left }] : []))
    .sort((a, b) => b.at! - a.at!)[0];
  return (
    <Panel className="h-[414px] w-full shrink-0" corner={id}>
      <div className="flex h-full flex-col px-6 pb-5 pt-5">
        <div className="grid min-h-0 flex-1 grid-cols-3 gap-4">
          {GLITCH_CARDS.map((c) => (
            <GlitchTile key={c.id} card={c} at={team.cards?.[c.id]} phase={phaseOf(team.cards?.[c.id], c.secs, now)} />
          ))}
        </div>
        <div className={`mt-4 flex shrink-0 flex-col items-center gap-2 ${hit ? `glitch-hit glitch--${hit.c.color}` : ""}`}>
          {/* a fixed-height row, so the timer never moves when a card hits */}
          <div className="flex h-[34px] shrink-0 items-center">
            {hit ? (
              <span key={hit.at} className="glitch-hit-tag title flex items-center gap-3 rounded-full px-5 py-1.5 text-[16px] leading-none">
                {hit.c.name}
                <span className="digits text-[18px] font-bold normal-case">{(hit.left / 1000).toFixed(1)}s</span>
              </span>
            ) : (
              <Label>Timer</Label>
            )}
          </div>
          <TimerDisplay timer={team.timer} size={84} />
        </div>
      </div>
    </Panel>
  );
}

/** One glitch card: ready (full colour), arming (its countdown is on screen), live (glitches
    in, then drains), used (greyed). */
function GlitchTile({ card, at, phase }: { card: (typeof GLITCH_CARDS)[number]; at?: number; phase: Phase }) {
  const state = phase.kind;
  const left = phase.kind === "live" || phase.kind === "arming" ? phase.left : 0;
  return (
    <div
      key={at ?? "ready"}
      data-state={state}
      className={`glitch-tile glitch--${card.color} relative flex min-h-0 flex-col items-center overflow-hidden rounded-[18px] border px-3 pb-3.5 pt-2`}
    >
      <div className="relative min-h-0 w-full flex-1">
        <Image src={card.art} alt="" fill sizes="260px" className="glitch-art object-contain" />
      </div>
      <span className="glitch-name title mt-1 whitespace-nowrap text-[17px] leading-none">{card.name}</span>
      <span className="glitch-time digits mt-2 text-[15px] font-semibold leading-none">
        {state === "live" ? `${(left / 1000).toFixed(1)}s` : state === "arming" ? `in ${Math.ceil(left / 1000)}` : state === "used" ? "Used" : `${card.secs}s`}
      </span>
      {state === "live" && (
        <span className="glitch-drain absolute bottom-0 left-0 h-[4px]" style={{ width: `${(left / (card.secs * 1000)) * 100}%` }} />
      )}
    </div>
  );
}

/** Garden: big "chances left" number. Left click uses one, right click gives one back. */
function Chances({ value, onChange }: { value: number; onChange: (delta: number) => void }) {
  const out = value === 0;
  return (
    <Panel className="h-[290px] w-full shrink-0" tracer={out}>
      <button
        onClick={() => onChange(-1)}
        onContextMenu={(e) => {
          e.preventDefault();
          onChange(1);
        }}
        aria-label={`Chances left: ${value}`}
        className="relative flex h-full w-full cursor-pointer flex-col items-center justify-center"
      >
        <Label>Chances left</Label>
        <span
          key={value}
          className={`slam digits mt-3 text-[160px] font-bold leading-none ${out ? "text-[var(--cell-red)]" : "text-white"}`}
          style={{ textShadow: out ? "0 0 40px rgba(242,85,107,0.5)" : "0 0 40px rgba(0,232,122,0.3)" }}
        >
          {value}
        </span>
        {out && (
          <span className="blink title absolute right-10 top-1/2 -translate-y-1/2 rounded-full border border-[rgba(242,85,107,0.55)] bg-[rgba(242,85,107,0.1)] px-7 py-2 text-[36px] text-[var(--cell-red)]">
            OUT
          </span>
        )}
      </button>
    </Panel>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="label text-[13px]">{children}</span>
  );
}

function TimerDisplay({ timer, since = 0, size = 52 }: { timer: TimerState; since?: number; size?: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timer.running) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [timer.running]);

  // `now` can lag one frame behind a fresh start, so never show less than what's banked
  const ms = Math.max(0, Math.max(timer.accumulated, elapsedMs(timer, now)) - since);
  return (
    <span
      className={`digits leading-none ${timer.running ? "neon-text" : "text-white"}`}
      style={{ fontSize: size }}
      role="timer"
    >
      {formatTime(ms)}
    </span>
  );
}
