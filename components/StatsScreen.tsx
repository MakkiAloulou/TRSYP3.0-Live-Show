"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { GAME_INFO, teamTotal, type Action, type GameKind, type StatField, type TeamId, type TeamState } from "@/lib/game";
import { sfx } from "@/lib/sfx";
import { CountUp, framePath, Line, Reveal, timing } from "./Draw";

/* Phase Stats (Polygame) / Game Stats details (Garden, Mine): a table that
   draws itself like a pen stroke when `on` turns true, and un-draws (last
   pieces first, quicker) when it turns false. Every value is typed by
   hovering it — same as the grid. */

// Stage layout (1920×1080 px)
const X0 = 150;
const X1 = 1770;
const Y0 = 60;
const Y1 = 1020;
const MID = 960;
const CUT = 28;
const TITLE_Y = 212;
const PAD = 70;
const ROW0 = 336;
const ROW_H = 96;
const PH_TOP = 668;
const PH_BOT = 790;
const TOTAL_LINE = 968;

const halfX = (t: TeamId) => (t === 0 ? [X0 + PAD, MID - PAD] : [MID + PAD, X1 - PAD]);

type RowKind = "time" | "position" | "accuracy" | "number";
interface Row {
  label: string;
  value: StatField;
  /** bonus field (omitted = no bonus on this row) */
  plus?: StatField;
  kind: RowKind;
}

const TIME: Row = { label: "Time", value: "time", plus: "timePlus", kind: "time" };
const POSITION: Row = { label: "Position", value: "position", plus: "positionPlus", kind: "position" };
const ROWS: Record<GameKind, Row[]> = {
  polygame: [TIME, POSITION, { label: "Accuracy", value: "accuracy", plus: "accuracyPlus", kind: "accuracy" }],
  garden: [TIME, POSITION],
  game3: [
    TIME,
    { label: "Edge contact", value: "edge", kind: "number" },
    { label: "Cube drop", value: "cube", kind: "number" },
    { label: "Mine contact", value: "mine", kind: "number" },
  ],
};
const PHASES: StatField[] = ["ph1", "ph2", "ph3"];

interface Props {
  on: boolean;
  active: boolean;
  game: GameKind;
  teams: [TeamState, TeamState];
  dispatch: (a: Action) => void;
}

export default function StatsScreen({ on, active, game, teams, dispatch }: Props) {
  const rows = ROWS[game];
  const phases = game === "polygame"; // Polygame: Phase 1–3 box; others: one final score
  const ROW_LINES = Array.from({ length: rows.length + 1 }, (_, i) => ROW0 + i * ROW_H);
  const rowsEnd = ROW_LINES[ROW_LINES.length - 1];
  const hasBonus = rows.some((r) => r.plus);
  const hover = useRef<{ team: TeamId; field: StatField } | null>(null);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!activeRef.current || !hover.current || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = statKey(e);
      if (!key) return;
      e.preventDefault();
      sfx.keyTick();
      dispatch({ type: "editStat", team: hover.current.team, field: hover.current.field, key });
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, [dispatch]);

  const field = (team: TeamId, f: StatField, children: ReactNode, className = "") => (
    <span
      onPointerEnter={() => (hover.current = { team, field: f })}
      onPointerLeave={() => (hover.current = null)}
      className={`inline-block min-h-[1em] min-w-[3ch] cursor-text px-1.5 outline-offset-4 hover:outline-1 hover:outline-dashed hover:outline-[var(--pink-dim)] ${className}`}
    >
      {children}
    </span>
  );

  return (
    <div className="absolute inset-0" aria-hidden={!on}>
      {/* ── Lines ── */}
      <svg className="pointer-events-none absolute inset-0" width={1920} height={1080}>
        <g fill="none" strokeLinecap="square">
          {/* outer frame, chamfered like the HUD */}
          <path
            pathLength={1}
            className={`draw ${on ? "on" : ""}`}
            style={{ ...timing(on, 0, 1100), filter: "drop-shadow(0 0 5px rgba(41,224,143,0.85))" }}
            stroke="var(--neon)"
            strokeWidth={2}
            d={framePath(X0, Y0, X1, Y1, CUT)}
          />
          <Line on={on} d={260} dur={700} x1={X0} y1={TITLE_Y} x2={X1} y2={TITLE_Y} strong />
          <Line on={on} d={460} dur={760} x1={MID} y1={TITLE_Y} x2={MID} y2={Y1} strong />
          {/* pink accent on the centre divider */}
          <Line on={on} d={900} dur={420} x1={MID} y1={540} x2={MID} y2={640} pink />

          {([0, 1] as TeamId[]).map((t) => {
            const [a, b] = halfX(t);
            const third = (b - a) / 3;
            const o = t * 60;
            return (
              <g key={t}>
                {ROW_LINES.map((y, i) => (
                  <Line key={y} on={on} d={640 + i * 70 + o} dur={480} x1={a} y1={y} x2={b} y2={y} />
                ))}
                {/* phase score box (Polygame only) */}
                {phases && (
                  <>
                    <path
                      pathLength={1}
                      className={`draw ${on ? "on" : ""}`}
                      style={timing(on, 940 + o, 620)}
                      stroke="var(--neon)"
                      strokeWidth={1.6}
                      d={`M ${a} ${PH_TOP} L ${b} ${PH_TOP} L ${b} ${PH_BOT} L ${a} ${PH_BOT} Z`}
                    />
                    <Line on={on} d={1160 + o} dur={260} x1={a + third} y1={PH_TOP} x2={a + third} y2={PH_BOT} strong />
                    <Line on={on} d={1220 + o} dur={260} x1={a + 2 * third} y1={PH_TOP} x2={a + 2 * third} y2={PH_BOT} strong />
                  </>
                )}
                <Line on={on} d={1320 + o} dur={420} x1={(a + b) / 2 - 110} y1={TOTAL_LINE} x2={(a + b) / 2 + 110} y2={TOTAL_LINE} pink />
              </g>
            );
          })}
        </g>
      </svg>

      {/* ── Title ── */}
      <Reveal on={on} d={320} className="absolute left-0 right-0 text-center" style={{ top: Y0 + 26 }}>
        <div className="text-[15px] font-semibold uppercase tracking-[0.55em] text-[var(--text-dim)]">
          TRSYP 3.0 · {GAME_INFO[game].title}
        </div>
        <h1 className="neon-text mt-1 font-[family-name:var(--font-display)] text-[68px] uppercase leading-none tracking-[0.22em]">
          {phases ? "Phase Stats" : "Game Stats"}
        </h1>
      </Reveal>

      {/* ── Each team ── */}
      {([0, 1] as TeamId[]).map((t) => {
        const [a, b] = halfX(t);
        const w = b - a;
        const st = teams[t].stats;
        const o = t * 60;
        const total = teamTotal(st);
        const finalTyped = st.final !== "";
        return (
          <div key={t}>
            {/* team name */}
            <div className="absolute text-center" style={{ left: a, width: w, top: TITLE_Y + 26 }}>
              <h2
                className={`glitch neon-text reveal ${on ? "on" : ""} font-[family-name:var(--font-display)] text-[46px] uppercase leading-none tracking-[0.14em]`}
                style={timing(on, 700 + o, 420)}
              >
                <span className="mr-4 inline-block h-2.5 w-2.5 -translate-y-2 rotate-45 bg-[var(--pink)] shadow-[0_0_8px_var(--pink)]" />
                {teams[t].name}
                <span className="ml-4 inline-block h-2.5 w-2.5 -translate-y-2 rotate-45 bg-[var(--pink)] shadow-[0_0_8px_var(--pink)]" />
              </h2>
            </div>

            {/* column header over the bonus points */}
            {hasBonus && <Reveal
              on={on}
              d={740 + o}
              className="absolute pr-2 text-right text-[13px] font-semibold uppercase tracking-[0.4em] text-[var(--pink)]"
              style={{ left: a, width: w, top: ROW_LINES[0] - 26 }}
            >
              Bonus
            </Reveal>}

            {/* one row per stat */}
            {rows.map((r, i) => {
              const top = ROW_LINES[i];
              const h = ROW_LINES[i + 1] - top;
              return (
                <Reveal
                  key={r.label}
                  on={on}
                  d={760 + i * 80 + o}
                  className="absolute flex items-center"
                  style={{ left: a, width: w, top, height: h }}
                >
                  <span className="flex w-[34%] items-center gap-3 pl-2 text-[20px] font-semibold uppercase tracking-[0.3em] text-[var(--text-dim)]">
                    <span className="h-1.5 w-1.5 rotate-45 bg-[var(--neon)]" />
                    {r.label}
                  </span>
                  <span className="digits w-[38%] text-center text-[48px] leading-none text-[var(--text)]">
                    {field(t, r.value, <Value raw={st[r.value]} kind={r.kind} on={on} delay={900 + i * 80 + o} blank />)}
                  </span>
                  <span className="digits w-[28%] pr-2 text-right text-[40px] leading-none">
                    {r.plus && field(t, r.plus, <Bonus raw={st[r.plus]} />)}
                  </span>
                </Reveal>
              );
            })}

            {/* phase scores */}
            {phases && PHASES.map((f, i) => (
              <Reveal
                key={f}
                on={on}
                d={1180 + i * 70 + o}
                className="absolute flex flex-col items-center justify-center"
                style={{ left: a + (w / 3) * i, width: w / 3, top: PH_TOP, height: PH_BOT - PH_TOP }}
              >
                <span className="text-[15px] font-semibold uppercase tracking-[0.4em] text-[var(--text-dim)]">
                  Phase {i + 1}
                </span>
                <span className="digits mt-1 text-[50px] leading-none text-[var(--text)]">
                  {field(t, f, <Value raw={st[f]} kind="number" on={on} delay={1250 + i * 70 + o} />)}
                </span>
              </Reveal>
            ))}

            {/* total (Polygame) / final score of this game (Garden, Mine) */}
            {phases ? (
              <Reveal
                on={on}
                d={1330 + o}
                className="absolute flex flex-col items-center"
                style={{ left: a, width: w, top: PH_BOT + 34 }}
              >
                <span className="text-[17px] font-semibold uppercase tracking-[0.5em] text-[var(--text-dim)]">
                  Total score
                </span>
                <span className="digits pink-text mt-1 text-[96px] leading-none">
                  <CountUp value={total} on={on} delay={1400 + o} />
                </span>
              </Reveal>
            ) : (
              <Reveal
                on={on}
                d={1250 + o}
                className="absolute flex flex-col items-center"
                style={{ left: a, width: w, top: rowsEnd + (TOTAL_LINE - rowsEnd) / 2 - 92 }}
              >
                <span className="text-[17px] font-semibold uppercase tracking-[0.5em] text-[var(--text-dim)]">
                  Final score
                </span>
                <span className="digits pink-text mt-1 text-[110px] leading-none">
                  {field(
                    t,
                    "final",
                    finalTyped ? (
                      <Value raw={st.final} kind="number" on={on} delay={1350 + o} />
                    ) : (
                      // nothing typed yet: show this game's points counter, dimmed
                      <span className="opacity-60">
                        <CountUp value={teams[t].points} on={on} delay={1350 + o} />
                      </span>
                    ),
                  )}
                </span>
              </Reveal>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── pieces ─────────────────────────────────────────────────────────── */

const EMPTY = <span className="text-[var(--neon-dim)]">—</span>;
const NUMERIC = /^-?\d+(\.\d+)?$/;

/** Time limit the time row is compared against (fixed). */
const TIME_LIMIT_S = 5 * 60;

/** "4:12" → 252 s; "4" or "4.5" → minutes. null if it can't be read. */
const toSeconds = (raw: string): number | null => {
  const m = /^(\d+):(\d{1,2})(?:\.\d+)?$/.exec(raw);
  if (m) return +m[1] * 60 + +m[2];
  return NUMERIC.test(raw) ? parseFloat(raw) * 60 : null;
};

function Value({
  raw, kind, on, delay, blank,
}: { raw: string; kind: "time" | "position" | "accuracy" | "number"; on: boolean; delay: number; blank?: boolean }) {
  if (!raw) return blank ? null : EMPTY;
  if (kind === "time") {
    const secs = toSeconds(raw);
    if (secs === null) return <>{raw}</>;
    const under = secs < TIME_LIMIT_S;
    const sign = under ? "<" : secs > TIME_LIMIT_S ? ">" : "=";
    return (
      <>
        {raw}
        <span className={`ml-3 text-[0.55em] ${under ? "neon-text" : secs > TIME_LIMIT_S ? "text-[var(--cell-red)]" : "text-[var(--text-dim)]"}`}>
          {sign} 5:00
        </span>
      </>
    );
  }
  if (!NUMERIC.test(raw)) return <>{raw}</>;
  const n = parseFloat(raw);
  if (kind === "position")
    return (
      <>
        <CountUp value={n} on={on} delay={delay} />
        <sup className="ml-0.5 text-[0.45em] uppercase">{ordinal(n)}</sup>
      </>
    );
  return (
    <>
      <CountUp value={n} on={on} delay={delay} decimals={raw.split(".")[1]?.length ?? 0} />
      {kind === "accuracy" && <span className="text-[0.6em]">%</span>}
    </>
  );
}

/** Bonus points: shown exactly as typed, nothing when empty. */
function Bonus({ raw }: { raw: string }) {
  if (!raw) return null;
  return <span className={raw.startsWith("-") ? "text-[var(--cell-red)]" : "neon-text"}>{raw}</span>;
}

const ordinal = (n: number) => {
  const v = Math.abs(Math.round(n)) % 100;
  if (v >= 11 && v <= 13) return "th";
  return ["th", "st", "nd", "rd"][v % 10] ?? "th";
};

/** Keys accepted while hovering a value. Digits by physical key (AZERTY-safe). */
function statKey(e: KeyboardEvent): string | null {
  const digit = /^(Digit|Numpad)([0-9])$/.exec(e.code)?.[2];
  if (digit) return digit;
  if (e.key === "Backspace" || e.key === "Delete") return e.key;
  if (e.code === "NumpadDecimal") return ".";
  if (e.code === "NumpadSubtract") return "-";
  if ([":", ".", "%", "-"].includes(e.key)) return e.key;
  return null;
}
