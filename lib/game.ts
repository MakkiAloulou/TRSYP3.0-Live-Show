// Polygame state: two teams, each with a shapes board, a 5x5 grid, a timer and points.

export type ShapeState = "normal" | "grey" | "removed";
export type GridColor = 0 | 1 | 2; // 0 white, 1 red, 2 blue
/** A grid square split on its "\" diagonal into [top-right, bottom-left] triangles.
    `full` = coloured as one square (no diagonal shown); otherwise the halves are separate. */
export interface GridCell {
  colors: [GridColor, GridColor];
  full: boolean;
  /** Number typed on the whole square (shown when full) */
  label: string;
  /** Numbers typed on each triangle (shown when split) */
  halfLabels: [string, string];
}
export type TeamId = 0 | 1;

export interface TimerState {
  running: boolean;
  startedAt: number | null; // epoch ms of the current run
  accumulated: number; // ms from previous runs
}

/** Phase Stats screen values — all typed by hand (strings, so "5:32", "87%" etc. work) */
export interface TeamStats {
  time: string;
  timePlus: string;
  position: string;
  positionPlus: string;
  accuracy: string;
  accuracyPlus: string;
  ph1: string;
  ph2: string;
  ph3: string;
}
export type StatField = keyof TeamStats;

export interface TeamState {
  name: string;
  shapes: Record<string, ShapeState>;
  grid: GridCell[];
  timer: TimerState;
  points: number;
  stats: TeamStats;
}

/** One of the 9 teams on the overall leaderboard */
export interface LeagueTeam {
  id: string;
  name: string;
  points: number;
  played: number;
}

export interface GameState {
  /** The two teams playing the current match */
  teams: [TeamState, TeamState];
  /** Overall standings, always kept sorted (points desc, previous order breaks ties) */
  league: LeagueTeam[];
  /** True once this match's totals have been added to the league */
  matchCommitted: boolean;
}

export type Action =
  | { type: "setShape"; team: TeamId; id: string; state: ShapeState }
  | { type: "cycleHalf"; team: TeamId; index: number; half: 0 | 1 }
  | { type: "cycleCell"; team: TeamId; index: number; half: 0 | 1 }
  | { type: "editLabel"; team: TeamId; index: number; half: 0 | 1; key: string }
  | { type: "editStat"; team: TeamId; field: StatField; key: string }
  | { type: "toggleTimer"; team: TeamId; now: number }
  | { type: "toggleBoth"; now: number }
  | { type: "resetTimer"; team: TeamId }
  | { type: "addPoints"; team: TeamId; delta: number }
  | { type: "rename"; team: TeamId; name: string }
  | { type: "resetAll" }
  | { type: "commitMatch" }
  | { type: "renameLeague"; id: string; name: string }
  | { type: "editLeaguePoints"; id: string; key: string }
  | { type: "load"; state: GameState };

/* ─── Shapes geometry (flat top view) ─────────────────────────────────
   5 columns; each column = 1 green triangle on top, a red and a blue
   triangle on top, a red and a blue cube, and a red and a blue triangle
   underneath. 35 pieces total.

   Numbering zigzags through each column (6 per column):
   red top 1 → red cube 2 → blue bottom 3 → blue top 4 → blue cube 5 →
   red bottom 6, then column 2 is 7–12, … up to 30. Green triangles
   are not numbered. */

export type ShapeKind = "green" | "red-tri" | "blue-tri" | "red-cube" | "blue-cube";

export interface ShapeDef {
  id: string;
  /** Shape number shown on the board; green triangles have none */
  num: number | null;
  kind: ShapeKind;
  label: string;
  points: [number, number][];
}

export const SHAPE_COLORS: Record<ShapeKind, string> = {
  green: "#5fc46b",
  "red-tri": "#f2707a",
  "blue-tri": "#6f72f2",
  "red-cube": "#f2707a",
  "blue-cube": "#6f72f2",
};

const COL_W = 100;
const TRI_H = 56;
const CUBE_H = COL_W / 2; // cubes are true squares (top view), like the grid cells
const SHEAR = 0; // no lean, so squares stay square

const shear = (pts: [number, number][]): [number, number][] =>
  pts.map(([x, y]) => [x + y * SHEAR, y]);

export const BOARD_W = COL_W * 5 + (TRI_H * 2 + CUBE_H) * SHEAR;
export const BOARD_H = TRI_H * 2 + CUBE_H;

export const SHAPES: ShapeDef[] = Array.from({ length: 5 }, (_, c) => {
  const x = c * COL_W;
  const r = x + COL_W;
  const m = x + COL_W / 2;
  const y1 = TRI_H;
  const y2 = TRI_H + CUBE_H;
  const y3 = TRI_H * 2 + CUBE_H;
  const n = c + 1;
  const b = c * 6;
  return [
    { id: `rt${n}`, num: b + 1, kind: "red-tri", label: `Red top triangle ${n}`, points: shear([[x, 0], [m, y1], [x, y1]]) },
    { id: `rc${n}`, num: b + 2, kind: "red-cube", label: `Red cube ${n}`, points: shear([[x, y1], [m, y1], [m, y2], [x, y2]]) },
    { id: `bb${n}`, num: b + 3, kind: "blue-tri", label: `Blue bottom triangle ${n}`, points: shear([[m, y2], [r, y2], [r, y3]]) },
    { id: `bt${n}`, num: b + 4, kind: "blue-tri", label: `Blue top triangle ${n}`, points: shear([[r, 0], [r, y1], [m, y1]]) },
    { id: `bc${n}`, num: b + 5, kind: "blue-cube", label: `Blue cube ${n}`, points: shear([[m, y1], [r, y1], [r, y2], [m, y2]]) },
    { id: `rb${n}`, num: b + 6, kind: "red-tri", label: `Red bottom triangle ${n}`, points: shear([[x, y2], [m, y2], [x, y3]]) },
    { id: `g${n}`, num: null, kind: "green", label: `Green triangle ${n}`, points: shear([[x, 0], [r, 0], [m, y1]]) },
  ] satisfies ShapeDef[];
}).flat();

/* ─── State ─────────────────────────────────────────────────────────── */

const freshTimer = (): TimerState => ({ running: false, startedAt: null, accumulated: 0 });

const freshStats = (): TeamStats => ({
  time: "",
  timePlus: "",
  position: "",
  positionPlus: "",
  accuracy: "",
  accuracyPlus: "",
  ph1: "",
  ph2: "",
  ph3: "",
});

const freshTeam = (name: string): TeamState => ({
  name,
  shapes: Object.fromEntries(SHAPES.map((s) => [s.id, "normal" as ShapeState])),
  grid: Array.from({ length: 25 }, (): GridCell => ({ colors: [0, 0], full: false, label: "", halfLabels: ["", ""] })),
  timer: freshTimer(),
  points: 0,
  stats: freshStats(),
});

/** Fill in anything a save from an older version is missing. */
export const normalizeState = (s: GameState): GameState => ({
  league: Array.isArray(s.league) && s.league.length ? s.league : freshLeague(),
  matchCommitted: !!s.matchCommitted,
  teams: s.teams.map((t) => {
    const base = freshTeam(t.name);
    return { ...base, ...t, grid: (t.grid ?? base.grid).map(toCell), stats: { ...base.stats, ...t.stats } };
  }) as GameState["teams"],
});

export const initialState = (): GameState => ({
  teams: [freshTeam("CUBOT"), freshTeam("TEST 2")],
  league: freshLeague(),
  matchCommitted: false,
});

function freshLeague(): LeagueTeam[] {
  // Starting order (everyone on 0): CUBOT starts 6th
  const order = ["TEAM 3", "TEAM 4", "TEAM 5", "TEAM 6", "TEAM 7", "CUBOT", "TEST 2", "TEAM 8", "TEAM 9"];
  return order.map((name, i) => ({ id: `t${i + 1}`, name, points: 0, played: 0 }));
}

/** Stable sort: more points first; equal points keep their previous order. */
const sortLeague = (l: LeagueTeam[]) => l.map((t, i) => ({ t, i })).sort((a, b) => b.t.points - a.t.points || a.i - b.i).map((x) => x.t);

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Points each league team would gain from the current match (by matching team names). */
export const matchGains = (s: GameState): Record<string, number> => {
  const gains: Record<string, number> = {};
  for (const t of s.teams) {
    const lt = s.league.find((l) => sameName(l.name, t.name));
    if (lt) gains[lt.id] = (gains[lt.id] ?? 0) + teamTotal(t.stats);
  }
  return gains;
};

/** Accepts any older saved / in-memory cell shape and returns a valid GridCell. */
export function toCell(raw: unknown): GridCell {
  const c = raw as Partial<GridCell> | [GridColor, GridColor] | null | undefined;
  if (Array.isArray(c)) return { colors: [c[0] ?? 0, c[1] ?? 0], full: false, label: "", halfLabels: ["", ""] };
  return {
    colors: Array.isArray(c?.colors) ? [c.colors[0] ?? 0, c.colors[1] ?? 0] : [0, 0],
    full: !!c?.full,
    label: c?.label ?? "",
    halfLabels: Array.isArray(c?.halfLabels) ? [c.halfLabels[0] ?? "", c.halfLabels[1] ?? ""] : ["", ""],
  };
}

const nextColor = (c: GridColor) => ((c + 1) % 3) as GridColor;

export const elapsedMs = (t: TimerState, now: number) =>
  t.accumulated + (t.running && t.startedAt !== null ? now - t.startedAt : 0);

const toggle = (t: TimerState, now: number): TimerState =>
  t.running
    ? { running: false, startedAt: null, accumulated: elapsedMs(t, now) }
    : { running: true, startedAt: now, accumulated: t.accumulated };

const updateTeam = (s: GameState, team: TeamId, fn: (t: TeamState) => TeamState): GameState => {
  const teams = [...s.teams] as GameState["teams"];
  teams[team] = fn(teams[team]);
  return { ...s, teams };
};

const updateCell = (s: GameState, team: TeamId, index: number, fn: (c: GridCell) => GridCell) =>
  updateTeam(s, team, (t) => {
    const grid = [...t.grid];
    grid[index] = fn(toCell(grid[index]));
    return { ...t, grid };
  });

export function reducer(s: GameState, a: Action): GameState {
  switch (a.type) {
    case "setShape":
      return updateTeam(s, a.team, (t) => ({ ...t, shapes: { ...t.shapes, [a.id]: a.state } }));
    case "cycleHalf":
      // One triangle: the square becomes "split" and keeps its diagonal
      return updateCell(s, a.team, a.index, (c) => {
        const colors: GridCell["colors"] = [...c.colors];
        colors[a.half] = nextColor(colors[a.half]);
        return { ...c, colors, full: false };
      });
    case "cycleCell":
      // Whole square: both halves move to the next colour of the half that was clicked.
      // Back to white → it's a plain square again (diagonal hint shows).
      return updateCell(s, a.team, a.index, (c) => {
        const next = nextColor(c.colors[a.half]);
        return { ...c, colors: [next, next], full: next !== 0 };
      });
    case "editLabel":
      // Typed while hovering: the whole square's number if it's full, else the hovered triangle's
      return updateCell(s, a.team, a.index, (c) => {
        const edit = (v: string) =>
          a.key === "Backspace" ? v.slice(0, -1) : a.key === "Delete" ? "" : (v + a.key).slice(-3);
        if (c.full) return { ...c, label: edit(c.label) };
        const halfLabels: GridCell["halfLabels"] = [...c.halfLabels];
        halfLabels[a.half] = edit(halfLabels[a.half]);
        return { ...c, halfLabels };
      });
    case "editStat":
      // Hover + type. Digits, ":", ".", "%", "-" ; Backspace / Delete
      return updateTeam(s, a.team, (t) => {
        const v = t.stats[a.field];
        const next = a.key === "Backspace" ? v.slice(0, -1) : a.key === "Delete" ? "" : (v + a.key).slice(0, 7);
        return { ...t, stats: { ...t.stats, [a.field]: next } };
      });
    case "toggleTimer":
      return updateTeam(s, a.team, (t) => ({ ...t, timer: toggle(t.timer, a.now) }));
    case "toggleBoth": {
      // If either is running, pause both; otherwise start both.
      const anyRunning = s.teams.some((t) => t.timer.running);
      return {
        ...s,
        teams: s.teams.map((t) =>
          t.timer.running === anyRunning ? { ...t, timer: toggle(t.timer, a.now) } : t,
        ) as GameState["teams"],
      };
    }
    case "resetTimer":
      return updateTeam(s, a.team, (t) => ({ ...t, timer: freshTimer() }));
    case "addPoints":
      return updateTeam(s, a.team, (t) => ({ ...t, points: Math.max(0, t.points + a.delta) }));
    case "rename":
      return updateTeam(s, a.team, (t) => ({ ...t, name: a.name }));
    case "resetAll":
      // New match: clear boards, timers, points and stats; keep the league
      return {
        ...s,
        teams: s.teams.map((t) => ({ ...freshTeam(t.name) })) as GameState["teams"],
        matchCommitted: false,
      };
    case "commitMatch": {
      if (s.matchCommitted) return s;
      const gains = matchGains(s);
      const league = s.league.map((l) =>
        l.id in gains ? { ...l, points: l.points + gains[l.id], played: l.played + 1 } : l,
      );
      return { ...s, league: sortLeague(league), matchCommitted: true };
    }
    case "renameLeague":
      return { ...s, league: s.league.map((l) => (l.id === a.id ? { ...l, name: a.name } : l)) };
    case "editLeaguePoints":
      return {
        ...s,
        league: sortLeague(
          s.league.map((l) => {
            if (l.id !== a.id) return l;
            const cur = String(l.points);
            const next = a.key === "Backspace" ? cur.slice(0, -1) : a.key === "Delete" ? "" : (cur === "0" ? "" : cur) + a.key;
            return { ...l, points: parseInt(next.slice(0, 5), 10) || 0 };
          }),
        ),
      };
    case "load":
      return normalizeState(a.state);
  }
}

/** Total score = Phase 1 + Phase 2 + Phase 3 (blank / unreadable count as 0). */
export const teamTotal = (st: TeamStats) =>
  [st.ph1, st.ph2, st.ph3].reduce((sum, v) => sum + (parseFloat(v) || 0), 0);

export const formatTime = (ms: number) => {
  const total = Math.floor(ms / 100);
  const tenths = total % 10;
  const secs = Math.floor(total / 10) % 60;
  const mins = Math.floor(total / 600);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
};
