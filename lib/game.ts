// Polygame state: two teams, each with a shapes board, a 5x5 grid, a timer and points.

export type ShapeState = "normal" | "grey" | "removed";
export type GridColor = 0 | 1 | 2; // 0 white, 1 red, 2 blue
export type TeamId = 0 | 1;

export interface TimerState {
  running: boolean;
  startedAt: number | null; // epoch ms of the current run
  accumulated: number; // ms from previous runs
}

export interface TeamState {
  name: string;
  shapes: Record<string, ShapeState>;
  grid: GridColor[];
  timer: TimerState;
  points: number;
}

export interface GameState {
  teams: [TeamState, TeamState];
}

export type Action =
  | { type: "setShape"; team: TeamId; id: string; state: ShapeState }
  | { type: "cycleCell"; team: TeamId; index: number }
  | { type: "toggleTimer"; team: TeamId; now: number }
  | { type: "toggleBoth"; now: number }
  | { type: "resetTimer"; team: TeamId }
  | { type: "addPoints"; team: TeamId; delta: number }
  | { type: "rename"; team: TeamId; name: string }
  | { type: "resetAll" }
  | { type: "load"; state: GameState };

/* ─── Shapes geometry (flat top view) ─────────────────────────────────
   5 columns; each column = 1 green triangle, 1 red + 1 blue triangle,
   1 red + 1 blue cube. 25 pieces total. A shear makes the band lean
   like the physical board. */

export type ShapeKind = "green" | "red-tri" | "blue-tri" | "red-cube" | "blue-cube";

export interface ShapeDef {
  id: string;
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
const TRI_H = 64;
const CUBE_H = 76;
const SHEAR = 0.32;

const shear = (pts: [number, number][]): [number, number][] =>
  pts.map(([x, y]) => [x + y * SHEAR, y]);

export const BOARD_W = COL_W * 5 + (TRI_H + CUBE_H) * SHEAR;
export const BOARD_H = TRI_H + CUBE_H;

export const SHAPES: ShapeDef[] = Array.from({ length: 5 }, (_, c) => {
  const x = c * COL_W;
  const m = x + COL_W / 2;
  const y1 = TRI_H;
  const y2 = TRI_H + CUBE_H;
  const n = c + 1;
  return [
    { id: `g${n}`, kind: "green", label: `Green triangle ${n}`, points: shear([[x, 0], [x + COL_W, 0], [m, y1]]) },
    { id: `rt${n}`, kind: "red-tri", label: `Red triangle ${n}`, points: shear([[x, 0], [m, y1], [x, y1]]) },
    { id: `bt${n}`, kind: "blue-tri", label: `Blue triangle ${n}`, points: shear([[x + COL_W, 0], [x + COL_W, y1], [m, y1]]) },
    { id: `rc${n}`, kind: "red-cube", label: `Red cube ${n}`, points: shear([[x, y1], [m, y1], [m, y2], [x, y2]]) },
    { id: `bc${n}`, kind: "blue-cube", label: `Blue cube ${n}`, points: shear([[m, y1], [x + COL_W, y1], [x + COL_W, y2], [m, y2]]) },
  ] satisfies ShapeDef[];
}).flat();

/* ─── State ─────────────────────────────────────────────────────────── */

const freshTimer = (): TimerState => ({ running: false, startedAt: null, accumulated: 0 });

const freshTeam = (name: string): TeamState => ({
  name,
  shapes: Object.fromEntries(SHAPES.map((s) => [s.id, "normal" as ShapeState])),
  grid: Array<GridColor>(25).fill(0),
  timer: freshTimer(),
  points: 0,
});

export const initialState = (): GameState => ({
  teams: [freshTeam("TEAM 1"), freshTeam("TEAM 2")],
});

export const elapsedMs = (t: TimerState, now: number) =>
  t.accumulated + (t.running && t.startedAt !== null ? now - t.startedAt : 0);

const toggle = (t: TimerState, now: number): TimerState =>
  t.running
    ? { running: false, startedAt: null, accumulated: elapsedMs(t, now) }
    : { running: true, startedAt: now, accumulated: t.accumulated };

const updateTeam = (s: GameState, team: TeamId, fn: (t: TeamState) => TeamState): GameState => {
  const teams = [...s.teams] as GameState["teams"];
  teams[team] = fn(teams[team]);
  return { teams };
};

export function reducer(s: GameState, a: Action): GameState {
  switch (a.type) {
    case "setShape":
      return updateTeam(s, a.team, (t) => ({ ...t, shapes: { ...t.shapes, [a.id]: a.state } }));
    case "cycleCell":
      return updateTeam(s, a.team, (t) => {
        const grid = [...t.grid];
        grid[a.index] = ((grid[a.index] + 1) % 3) as GridColor;
        return { ...t, grid };
      });
    case "toggleTimer":
      return updateTeam(s, a.team, (t) => ({ ...t, timer: toggle(t.timer, a.now) }));
    case "toggleBoth": {
      // If either is running, pause both; otherwise start both.
      const anyRunning = s.teams.some((t) => t.timer.running);
      return {
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
      return {
        teams: s.teams.map((t) => ({ ...freshTeam(t.name) })) as GameState["teams"],
      };
    case "load":
      return a.state;
  }
}

export const formatTime = (ms: number) => {
  const total = Math.floor(ms / 100);
  const tenths = total % 10;
  const secs = Math.floor(total / 10) % 60;
  const mins = Math.floor(total / 600);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
};
