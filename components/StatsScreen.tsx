"use client";

import { useEffect, useState, type ReactNode } from "react";
import { clockText, elapsedMs, type GameKind, type TeamId, type TeamState } from "@/lib/game";
import {
  accuracyPoints,
  ATTEMPT_POINTS,
  limitText,
  MAX_ACCURACY,
  num,
  onTime,
  parseClock,
  runTime,
  PHASE_FIELDS,
  PHASE_NAMES,
  phaseScore,
  phaseTimes,
  positionPoints,
  scoreFor,
} from "@/lib/scoring";
import { CountUp, DrawPath, Frame, Line, Reveal, ScreenTitle, timing } from "./Draw";

/* Phase Stats (Polygame) / Game Stats details (Garden, Mine): how each team's
   score was made, line by line, from the scoring system. Draws itself like a
   pen stroke when `on` turns true, and un-draws (quicker) when it turns false.
   The values arrive from the remote's stats form; times come from the timers. */

// Stage layout (1920×1080 px)
const X0 = 150;
const X1 = 1770;
const Y0 = 60;
const Y1 = 1020;
const MID = 960;
const TITLE_Y = 212;
const PAD = 70;
const HEAD_Y = 330; // column labels
const ROW0 = 362;
const TOTAL_LINE = 968;

const halfX = (t: TeamId) => (t === 0 ? [X0 + PAD, MID - PAD] : [MID + PAD, X1 - PAD]);

interface Props {
  on: boolean;
  game: GameKind;
  teams: [TeamState, TeamState];
}

/** One row of the table: label, the raw value, the points it gives. */
interface Row {
  label: ReactNode;
  value: ReactNode;
  points: number;
}

const ORD: Record<string, string> = { "1": "st", "2": "nd", "3": "rd" };
const Place = ({ p }: { p: string }) =>
  p ? (
    <>
      {p}
      <sup className="ml-0.5 text-[0.5em] uppercase">{ORD[p] ?? "th"}</sup>
    </>
  ) : (
    <Dash />
  );
const Dash = () => <span className="text-[var(--text-faint)]">—</span>;

function rowsFor(game: GameKind, t: TeamState, ms: number): Row[] {
  const s = t.stats;
  if (game === "garden")
    return [
      { label: "Position", value: <Place p={s.position} />, points: positionPoints(game, s.position, ms) },
      { label: "Attempt", value: <Place p={s.attempt} />, points: ATTEMPT_POINTS[s.attempt] ?? 0 },
      { label: "Scanning order", value: s.scans ? `${num(s.scans)} ✕` : <Dash />, points: -20 * num(s.scans) },
    ];
  return [
    { label: "Position", value: <Place p={s.position} />, points: positionPoints(game, s.position, ms) },
    { label: "Edge contact", value: num(s.edge), points: -num(s.edge) },
    { label: "Cube drop", value: num(s.cube), points: -2 * num(s.cube) },
    { label: "Mine contact", value: num(s.mine), points: -3 * num(s.mine) },
    { label: "Unsafe line", value: s.penalty === "1" ? "Yes" : "No", points: s.penalty === "1" ? -30 : 0 },
  ];
}

export default function StatsScreen({ on, game, teams }: Props) {
  const poly = game === "polygame";
  const rowH = poly ? 118 : game === "garden" ? 96 : 70;
  const rowCount = poly ? 3 : game === "garden" ? 4 : 6; // Garden / Mine: the time row + its score lines
  const lines = Array.from({ length: rowCount + 1 }, (_, i) => ROW0 + i * rowH);

  return (
    <div className="absolute inset-0" aria-hidden={!on}>
      {/* ── Lines ── */}
      <svg className="pointer-events-none absolute inset-0" width={1920} height={1080}>
        <g fill="none" strokeLinecap="round">
          <Frame on={on} x0={X0} y0={Y0} x1={X1} y1={Y1} />
          <Line on={on} d={260} dur={700} x1={X0} y1={TITLE_Y} x2={X1} y2={TITLE_Y} strong />
          <Line on={on} d={460} dur={760} x1={MID} y1={TITLE_Y} x2={MID} y2={Y1} strong />
          <Line on={on} d={900} dur={420} x1={MID} y1={540} x2={MID} y2={640} pink />
          {([0, 1] as TeamId[]).map((t) => {
            const [a, b] = halfX(t);
            const o = t * 60;
            return (
              <g key={t}>
                {lines.map((y, i) => (
                  <Line key={y} on={on} d={640 + i * 70 + o} dur={480} x1={a} y1={y} x2={b} y2={y} />
                ))}
                <DrawPath
                  on={on}
                  d={1320 + o}
                  dur={420}
                  path={`M ${(a + b) / 2 - 110} ${TOTAL_LINE} H ${(a + b) / 2 + 110}`}
                  stroke={t ? "var(--pink)" : "var(--green)"}
                  width={2}
                />
              </g>
            );
          })}
        </g>
      </svg>

      <ScreenTitle on={on} x0={X0} x1={X1} y0={Y0} y1={TITLE_Y} title={poly ? "Phase Stats" : "Game Stats"} />

      {([0, 1] as TeamId[]).map((t) => {
        const [a, b] = halfX(t);
        const w = b - a;
        const team = teams[t];
        const o = t * 60;
        const dot = <span className={`h-[7px] w-[7px] shrink-0 rounded-full ${t ? "bg-[var(--pink-soft)]" : "bg-[var(--green-soft)]"}`} />;
        return (
          <div key={t}>
            {/* team name */}
            <div className="absolute text-center" style={{ left: a, width: w, top: TITLE_Y + 26 }}>
              <h2
                className={`glitch reveal ${on ? "on" : ""} name flex items-center justify-center gap-5 text-[44px] leading-none text-white`}
                style={timing(on, 700 + o, 420)}
              >
                <span className={`diamond ${t ? "diamond--pink" : ""}`} />
                {team.name}
                <span className={`diamond ${t ? "diamond--pink" : ""}`} />
              </h2>
            </div>

            {poly ? (
              <>
                {/* column labels */}
                <Reveal on={on} d={740 + o} className="label absolute grid items-end text-[13px]" style={{ left: a, width: w, top: HEAD_Y - 6, gridTemplateColumns: COLS }}>
                  <span className="pl-2">Phase</span>
                  <span className="text-center">Time</span>
                  <span className="text-center">Pos.</span>
                  <span className="text-center">Accuracy</span>
                  <span className="pr-2 text-right">Points</span>
                </Reveal>
                {PHASE_FIELDS.map((f, i) => {
                  const ms = phaseTimes(team)[i] ?? 0;
                  return (
                    <Reveal
                      key={i}
                      on={on}
                      d={780 + i * 90 + o}
                      className="absolute grid items-center"
                      style={{ left: a, width: w, top: lines[i], height: rowH, gridTemplateColumns: COLS }}
                    >
                      <span className="flex flex-col gap-1 pl-2">
                        <span className="flex items-center gap-3 text-[22px] font-semibold text-white">
                          {dot}Phase {i + 1}
                        </span>
                        <span className="label pl-[19px] text-[13px]">{PHASE_NAMES[i]}</span>
                      </span>
                      <TimeCell game={game} ms={ms} />
                      <span className="digits text-center text-[36px] leading-none text-white">
                        <Place p={team.stats[f.pos]} />
                      </span>
                      <span className="digits text-center text-[36px] leading-none text-white">
                        {team.stats[f.acc] ? (
                          <>
                            <CountUp value={accuracyPoints(team.stats[f.acc])} on={on} delay={900 + i * 90 + o} />
                            <span className="text-[0.5em] text-[var(--text-faint)]">/{MAX_ACCURACY}</span>
                          </>
                        ) : (
                          <Dash />
                        )}
                      </span>
                      <Points value={phaseScore(team, i)} on={on} delay={1000 + i * 90 + o} big />
                    </Reveal>
                  );
                })}
              </>
            ) : (
              <>
                {/* the time row, then one row per score line */}
                <Reveal on={on} d={760 + o} className="absolute flex items-center" style={{ left: a, width: w, top: lines[0], height: rowH }}>
                  <span className="label flex w-[40%] items-center gap-3 pl-2 text-[18px]">
                    {dot}Time
                  </span>
                  <span className="w-[60%]">
                    <LiveTime game={game} team={team} />
                  </span>
                </Reveal>
                {rowsFor(game, team, runTime(team)).map((r, i) => (
                  <Reveal
                    key={i}
                    on={on}
                    d={840 + i * 80 + o}
                    className="absolute flex items-center"
                    style={{ left: a, width: w, top: lines[i + 1], height: rowH }}
                  >
                    <span className="label flex w-[40%] items-center gap-3 pl-2 text-[18px]">
                      {dot}
                      {r.label}
                    </span>
                    <span className="digits w-[30%] text-center text-[38px] leading-none text-white">{r.value}</span>
                    <span className="w-[30%]">
                      <Points value={r.points} on={on} delay={960 + i * 80 + o} />
                    </span>
                  </Reveal>
                ))}
              </>
            )}

            {/* the score */}
            <Reveal
              on={on}
              d={1330 + o}
              className="absolute flex flex-col items-center"
              // centred in the space between the last row and the closing line
              style={{ left: a, width: w, top: lines[rowCount] + (TOTAL_LINE - lines[rowCount] - (poly ? 130 : 112)) / 2 }}
            >
              <span className="label text-[16px]">{poly ? "Polygame score" : "Score"}</span>
              <span className={`digits mt-2 font-bold leading-none ${t ? "pink-text" : "neon-text"} ${poly ? "text-[96px]" : "text-[80px]"}`}>
                <CountUp value={scoreFor(game, team)} on={on} delay={1400 + o} />
              </span>
            </Reveal>
          </div>
        );
      })}
    </div>
  );
}

/** Polygame columns: phase · time · position · accuracy · points */
const COLS = "1.25fr 1.45fr 0.8fr 1.1fr 0.9fr";

function Points({ value, on, delay, big }: { value: number; on: boolean; delay: number; big?: boolean }) {
  const color = value > 0 ? "var(--green)" : value < 0 ? "var(--cell-red)" : "var(--text-faint)";
  return (
    <span className={`digits block pr-2 text-right font-bold leading-none ${big ? "text-[44px]" : "text-[36px]"}`} style={{ color }}>
      {value < 0 ? "−" : value > 0 ? "+" : ""}
      <CountUp value={Math.abs(value)} on={on} delay={delay} />
    </span>
  );
}

/** A time against the game's limit: "4:12.3" with a green "< 5:00" or a red "> 5:00". */
function TimeCell({ game, ms, size = 30 }: { game: GameKind; ms: number; size?: number }) {
  if (ms <= 0)
    return (
      <span className="digits text-center leading-none" style={{ fontSize: size }}>
        <Dash />
      </span>
    );
  const ok = onTime(game, ms);
  return (
    <span className="flex flex-col items-center gap-1.5">
      <span className="digits leading-none text-white" style={{ fontSize: size }}>
        {clockText(ms)}
      </span>
      <span className={`digits text-[15px] leading-none ${ok ? "text-[var(--green)]" : "text-[var(--cell-red)]"}`}>
        {ok ? "<" : ">"} {limitText(game)}
      </span>
    </span>
  );
}

/** Garden / Mine time: the team's timer, kept live if it's still running. */
function LiveTime({ game, team }: { game: GameKind; team: TeamState }) {
  const [now, setNow] = useState(() => Date.now());
  const timer = team.timer;
  useEffect(() => {
    if (!timer.running) return;
    const iv = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(iv);
  }, [timer.running]);
  return (
    <span className="flex justify-center">
      <TimeCell game={game} ms={parseClock(team.stats.time) ?? Math.max(timer.accumulated, elapsedMs(timer, now))} size={40} />
    </span>
  );
}

