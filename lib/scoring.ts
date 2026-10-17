/* TRSYP 3.0 scoring, from "Scoring system.pdf" and the jury scoring sheet.

   Polygame, 3 phases (Shape, Parity, Colour). Each phase, per team:
     position   before 5:00: 1st 30 · 2nd 10   after 5:00: 1st 20 · 2nd 0
     accuracy   up to 20 (5 blocks: fits the box +4 · hits the grid +2 · outpasses 0),
                entered as the phase's total
   Garden:
     position   before 3:00: 1st 30 · 2nd 15   after 3:00: 1st 15 · 2nd 0
     attempt    1st +20 · 2nd +10 · 3rd +0
     penalty    not respecting the scanning order: −20 per scan
   Mine:
     position   before 3:00: 1st 30 · 2nd 20   after 3:00: 1st 20 · 2nd 0
     contacts   edge −1 each · cube drop −2 each · mine −3 each
     penalty    crossing the unsafe line / crossing before scanning, then lifting the cube: −30

   Times come from the teams' timers: Polygame's from the split taken at the end
   of each phase, Garden's and Mine's from the timer itself. A time not recorded
   counts as on time. */

import type { GameKind, StatField, TeamState } from "./game";

export const LIMIT_MS: Record<GameKind, number> = { polygame: 5 * 60_000, garden: 3 * 60_000, game3: 3 * 60_000 };
export const limitText = (g: GameKind) => `${LIMIT_MS[g] / 60_000}:00`;

const POSITION_POINTS: Record<GameKind, { onTime: [number, number]; late: [number, number] }> = {
  polygame: { onTime: [30, 10], late: [20, 0] },
  garden: { onTime: [30, 15], late: [15, 0] },
  game3: { onTime: [30, 20], late: [20, 0] },
};

export const PHASE_NAMES = ["Shape", "Parity", "Colour"] as const;
export const PHASE_FIELDS: { pos: StatField; acc: StatField }[] = [
  { pos: "pos1", acc: "acc1" },
  { pos: "pos2", acc: "acc2" },
  { pos: "pos3", acc: "acc3" },
];
export const ATTEMPT_POINTS: Record<string, number> = { "1": 20, "2": 10, "3": 0 };
export const MAX_ACCURACY = 20;

export const num = (v: string | undefined) => {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : 0;
};

export const onTime = (g: GameKind, ms: number) => ms <= 0 || ms <= LIMIT_MS[g];

/** Points for finishing 1st ("1") or 2nd ("2"), on time or not. Nothing chosen = 0. */
export const positionPoints = (g: GameKind, pos: string, ms: number) =>
  pos === "1" || pos === "2" ? POSITION_POINTS[g][onTime(g, ms) ? "onTime" : "late"][pos === "1" ? 0 : 1] : 0;

/** "4:12.3" / "4:12" / "4.12" / "412" / "5" (minutes) → ms; null when empty or unreadable. */
export const parseClock = (raw: string | undefined): number | null => {
  const v = (raw ?? "").trim();
  if (!v) return null;
  const at = (min: number, sec: number, tenths = 0) => (sec >= 60 ? null : (min * 60 + sec) * 1000 + tenths * 100);
  // "4:12" / "4:12.3"
  let m = /^(\d+):(\d{1,2})(?:[.,](\d))?$/.exec(v);
  if (m) return at(+m[1], +m[2], m[3] ? +m[3] : 0);
  // a phone's number pad has no ":", so "4.12" / "4,12" mean 4:12 too ("4.5" = 4:50)
  m = /^(\d+)[.,](\d{1,2})$/.exec(v);
  if (m) return at(+m[1], m[2].length === 1 ? +m[2] * 10 : +m[2]);
  // digits only: "5" = 5:00, "412" = 4:12, "1030" = 10:30
  m = /^(\d{1,4})$/.exec(v);
  if (m) return v.length <= 2 ? at(+v, 0) : at(+v.slice(0, -2), +v.slice(-2));
  return null;
};

export const TIME_FIELDS: StatField[] = ["time1", "time2", "time3"];

/** Each Polygame phase's time as the timer measured it (from the splits at each phase end). */
export const timerPhaseTimes = (t: TeamState): number[] => {
  const s = t.splits ?? [];
  return s.map((v, i) => v - (i ? s[i - 1] : 0));
};

/** Each Polygame phase's time: a corrected one where it was edited, else the timer's. */
export const phaseTimes = (t: TeamState): number[] => {
  const measured = timerPhaseTimes(t);
  const n = Math.max(measured.length, ...TIME_FIELDS.map((f, i) => (parseClock(t.stats[f]) !== null ? i + 1 : 0)));
  return Array.from({ length: n }, (_, i) => parseClock(t.stats[TIME_FIELDS[i]]) ?? measured[i] ?? 0);
};

/** Garden / Mine time: a corrected one, else the team's timer. */
export const runTime = (t: TeamState) => parseClock(t.stats.time) ?? t.timer.accumulated;

export const accuracyPoints = (raw: string) => Math.min(MAX_ACCURACY, Math.max(0, num(raw)));

export const phaseScore = (t: TeamState, i: number) =>
  positionPoints("polygame", t.stats[PHASE_FIELDS[i].pos], phaseTimes(t)[i] ?? 0) + accuracyPoints(t.stats[PHASE_FIELDS[i].acc]);

/** One line of a game's score: what it is, the raw value, the points it gives. */
export interface ScoreLine {
  label: string;
  points: number;
}

export function scoreLines(g: GameKind, t: TeamState): ScoreLine[] {
  const s = t.stats;
  if (g === "polygame") return PHASE_FIELDS.map((_, i) => ({ label: `Phase ${i + 1}`, points: phaseScore(t, i) }));
  const ms = runTime(t);
  if (g === "garden")
    return [
      { label: "Position", points: positionPoints(g, s.position, ms) },
      { label: "Attempt", points: ATTEMPT_POINTS[s.attempt] ?? 0 },
      { label: "Scanning order", points: -20 * num(s.scans) },
    ];
  return [
    { label: "Position", points: positionPoints(g, s.position, ms) },
    { label: "Edge contact", points: -1 * num(s.edge) },
    { label: "Cube drop", points: -2 * num(s.cube) },
    { label: "Mine contact", points: -3 * num(s.mine) },
    { label: "Penalty", points: s.penalty === "1" ? -30 : 0 },
  ];
}

/** A team's score for one game. */
export const scoreFor = (g: GameKind, t: TeamState) => scoreLines(g, t).reduce((sum, l) => sum + l.points, 0);

/** "+30", "−40", "0" */
export const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
