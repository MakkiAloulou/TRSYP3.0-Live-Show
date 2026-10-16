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
  /** Mine */
  edge: string;
  cube: string;
  mine: string;
  /** Garden / Mine: final score of the game (typed; empty = use the screen's current total) */
  final: string;
}
export type StatField = keyof TeamStats;

export interface TeamState {
  name: string;
  /** Which of the 9 league teams this is (set when the match is created) */
  leagueId?: string;
  shapes: Record<string, ShapeState>;
  grid: GridCell[];
  timer: TimerState;
  points: number;
  stats: TeamStats;
  /** Garden: chances left */
  chances: number;
  /** Polygame: robot marked as PINNED */
  pinned?: boolean;
}

/** One of the 9 teams on the overall leaderboard */
export interface LeagueTeam {
  id: string;
  name: string;
  points: number;
  played: number;
}

/* The three competition games. The same pairs of teams play all of them, in
   order, and their score carries over from one game to the next. */
export const GAMES = ["polygame", "garden", "game3"] as const;
export type GameKind = (typeof GAMES)[number];
export const GAME_INFO: Record<GameKind, { num: number; title: string; ready: boolean }> = {
  polygame: { num: 1, title: "Polygame", ready: true },
  garden: { num: 2, title: "Garden", ready: true },
  game3: { num: 3, title: "Mine", ready: true },
};

/** One game played by one pair: both teams' boards/stats and its league bookkeeping */
export interface GameSlot {
  teams: [TeamState, TeamState];
  opened: boolean;
  committed: boolean;
  /** Points already added to the league for each team (so corrections add only the difference) */
  applied: Record<string, number>;
}

/** One pair of teams on screen 0, with a slot for every game */
export interface Match {
  id: string;
  num: number;
  games: Record<GameKind, GameSlot>;
}
export type MatchStatus = "upcoming" | "live" | "done";
export const slotStatus = (g: GameSlot): MatchStatus => (g.committed ? "done" : g.opened ? "live" : "upcoming");

export interface GameState {
  /** Working copy of the open match's two teams (mirrored into `matches`) */
  teams: [TeamState, TeamState];
  /** Overall standings, always kept sorted (points desc, previous order breaks ties) */
  league: LeagueTeam[];
  /** True once the open match's totals have been added to the league */
  matchCommitted: boolean;
  /** Points already added to the league by the open match */
  applied: Record<string, number>;
  matches: Match[];
  /** id of the open match (null = none opened yet) */
  current: string | null;
  /** which game screen 0 and the open match are on */
  game: GameKind;
  /** Garden: starting chances for every match */
  gardenChances: number;
}

export type Action =
  | { type: "setShape"; team: TeamId; id: string; state: ShapeState }
  | { type: "cycleHalf"; team: TeamId; index: number; half: 0 | 1 }
  | { type: "cycleCell"; team: TeamId; index: number; half: 0 | 1 }
  | { type: "editLabel"; team: TeamId; index: number; half: 0 | 1; key: string }
  | { type: "editStat"; team: TeamId; field: StatField; key: string }
  | { type: "toggleTimer"; team: TeamId; now: number }
  | { type: "startBoth"; now: number }
  | { type: "stopTimer"; team: TeamId; now: number }
  | { type: "resetTimer"; team: TeamId }
  | { type: "addPoints"; team: TeamId; delta: number }
  | { type: "rename"; team: TeamId; name: string }
  | { type: "resetAll" }
  | { type: "commitMatch" }
  | { type: "addMatch"; a: string; b: string }
  | { type: "deleteMatch"; id: string }
  | { type: "openMatch"; id: string }
  | { type: "selectGame"; game: GameKind }
  | { type: "useChance"; team: TeamId; delta: number }
  | { type: "togglePin"; team: TeamId }
  | { type: "setGardenChances"; n: number }
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
  edge: "",
  cube: "",
  mine: "",
  final: "",
});

const freshTeam = (name: string): TeamState => ({
  name,
  shapes: Object.fromEntries(SHAPES.map((s) => [s.id, "normal" as ShapeState])),
  grid: Array.from({ length: 25 }, (): GridCell => ({ colors: [0, 0], full: false, label: "", halfLabels: ["", ""] })),
  timer: freshTimer(),
  points: 0,
  stats: freshStats(),
  chances: 3,
});

/** Fill in anything a save from an older version is missing. */
const normTeam = (t: TeamState): TeamState => {
  const base = freshTeam(t.name);
  return { ...base, ...t, grid: (t.grid ?? base.grid).map(toCell), stats: { ...base.stats, ...t.stats } };
};

const normSlot = (g: GameSlot): GameSlot => ({
  teams: g.teams.map(normTeam) as GameSlot["teams"],
  opened: !!g.opened,
  committed: !!g.committed,
  applied: g.applied ?? {},
});

const freshSlot = (league: LeagueTeam[], a: string, b: string, chances: number): GameSlot => {
  const team = (tid: string) => ({ ...freshTeam(league.find((l) => l.id === tid)?.name ?? "?"), leagueId: tid, chances });
  return { teams: [team(a), team(b)], opened: false, committed: false, applied: {} };
};

const newMatch = (league: LeagueTeam[], id: string, num: number, a: string, b: string, chances: number): Match => ({
  id,
  num,
  games: {
    polygame: freshSlot(league, a, b, chances),
    garden: freshSlot(league, a, b, chances),
    game3: freshSlot(league, a, b, chances),
  },
});

export const normalizeState = (s: GameState): GameState => {
  const league = Array.isArray(s.league) && s.league.length ? s.league : freshLeague();
  const chances = s.gardenChances ?? 3;
  const matches = (Array.isArray(s.matches) ? s.matches : []).map((m) => {
    const old = m as unknown as Partial<GameSlot> & Match; // saves from before games existed
    const ids = (old.games?.polygame ?? old).teams?.map((t) => t.leagueId ?? "") ?? ["", ""];
    const base = newMatch(league, m.id, m.num, ids[0], ids[1], chances);
    const games = old.games ?? { polygame: { teams: old.teams!, opened: !!old.opened, committed: !!old.committed, applied: old.applied ?? {} } };
    return {
      id: m.id,
      num: m.num,
      games: Object.fromEntries(GAMES.map((g) => [g, games[g] ? normSlot(games[g]) : base.games[g]])) as Match["games"],
    };
  });
  return {
    league,
    teams: s.teams.map(normTeam) as GameState["teams"],
    matchCommitted: !!s.matchCommitted,
    applied: s.applied ?? {},
    matches,
    current: s.current ?? null,
    game: s.game ?? "polygame",
    gardenChances: chances,
  };
};

export const initialState = (): GameState => {
  const league = freshLeague();
  // one starter match so screen 0 isn't empty
  const first = newMatch(league, "m1", 1, "t6", "t7", 3); // fixed id: same on server and client
  return {
    teams: first.games.polygame.teams,
    league,
    matchCommitted: false,
    applied: {},
    matches: [first],
    current: null,
    game: "polygame",
    gardenChances: 3,
  };
};

/** Score a team brings into the current game from the games before it (same match). */
export const carriedIn = (s: GameState, team: TeamId): number => {
  const m = s.current ? s.matches.find((x) => x.id === s.current) : null;
  if (!m) return 0;
  return slotCarry(m, s.game, team);
};

/** Points a team scored in one game of a match. Polygame = Phase total; Garden / Mine = the typed
    final score, or the screen's points counter until one is typed. */
export const gameScore = (game: GameKind, t: TeamState) => {
  if (game === "polygame") return teamTotal(t.stats);
  const typed = parseFloat(t.stats.final);
  return Number.isFinite(typed) ? typed : t.points;
};

/** Sum of the games before `game` for this match. */
export const slotCarry = (m: Match, game: GameKind, team: TeamId) =>
  GAMES.slice(0, GAMES.indexOf(game)).reduce((sum, g) => sum + gameScore(g, m.games[g].teams[team]), 0);

/** Cumulative score shown for a team after `game` (carried + this game). */
export const cumulative = (m: Match, game: GameKind, team: TeamId) =>
  slotCarry(m, game, team) + gameScore(game, m.games[game].teams[team]);

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
  if (!s.current) return gains;
  for (const t of s.teams) {
    const lt = s.league.find((l) => (t.leagueId ? l.id === t.leagueId : sameName(l.name, t.name)));
    if (lt) gains[lt.id] = (gains[lt.id] ?? 0) + gameScore(s.game, t);
  }
  return gains;
};

/** What the leaderboard still has to apply for the open match (new totals minus what's already in). */
export const pendingGains = (s: GameState): Record<string, number> => {
  const now = matchGains(s);
  const out: Record<string, number> = {};
  for (const id of new Set([...Object.keys(now), ...Object.keys(s.applied)])) {
    const d = (now[id] ?? 0) - (s.applied[id] ?? 0);
    if (d !== 0) out[id] = d;
  }
  return out;
};

/** True when opening the leaderboard should animate an update. */
export const needsLeagueUpdate = (s: GameState) =>
  !!s.current && (!s.matchCommitted || Object.keys(pendingGains(s)).length > 0);

/** Take a match's points (and its "played") back out of the league. */
const revertApplied = (league: LeagueTeam[], applied: Record<string, number>, committed: boolean) =>
  sortLeague(
    league.map((l) =>
      l.id in applied
        ? { ...l, points: l.points - (applied[l.id] ?? 0), played: Math.max(0, l.played - (committed ? 1 : 0)) }
        : l,
    ),
  );

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

/** Every change to the open match is mirrored into its entry in `matches`. */
export function reducer(s: GameState, a: Action): GameState {
  const n = baseReducer(s, a);
  if (!n.current || a.type === "load") return n;
  if (n.teams === s.teams && n.matchCommitted === s.matchCommitted && n.applied === s.applied && n.matches === s.matches) return n;
  return {
    ...n,
    matches: n.matches.map((m) =>
      m.id === n.current
        ? {
            ...m,
            games: {
              ...m.games,
              [n.game]: { ...m.games[n.game], teams: n.teams, committed: n.matchCommitted, applied: n.applied },
            },
          }
        : m,
    ),
  };
}

function baseReducer(s: GameState, a: Action): GameState {
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
    case "startBoth":
      // One key starts both teams at the same instant (a stopped one resumes)
      return {
        ...s,
        teams: s.teams.map((t) => (t.timer.running ? t : { ...t, timer: toggle(t.timer, a.now) })) as GameState["teams"],
      };
    case "stopTimer":
      // Each team is stopped on its own key
      return updateTeam(s, a.team, (t) => (t.timer.running ? { ...t, timer: toggle(t.timer, a.now) } : t));
    case "resetTimer":
      return updateTeam(s, a.team, (t) => ({ ...t, timer: freshTimer() }));
    case "addPoints":
      return updateTeam(s, a.team, (t) => ({ ...t, points: Math.max(0, t.points + a.delta) }));
    case "rename":
      return updateTeam(s, a.team, (t) => ({ ...t, name: a.name }));
    case "resetAll":
      // Restart the open match: clear boards, timers, points and stats, and take
      // anything it already added back out of the league
      return {
        ...s,
        league: s.matchCommitted ? revertApplied(s.league, s.applied, true) : s.league,
        teams: s.teams.map((t) => ({ ...freshTeam(t.name), leagueId: t.leagueId, chances: s.gardenChances })) as GameState["teams"],
        matchCommitted: false,
        applied: {},
      };
    case "commitMatch": {
      // First time: add totals and count the game as played. Later (after a
      // correction): add only the difference.
      if (!needsLeagueUpdate(s)) return s;
      const diff = pendingGains(s);
      const first = !s.matchCommitted;
      const playing = new Set(Object.keys(matchGains(s)));
      const league = s.league.map((l) => ({
        ...l,
        points: l.points + (diff[l.id] ?? 0),
        played: l.played + (first && playing.has(l.id) ? 1 : 0),
      }));
      return { ...s, league: sortLeague(league), matchCommitted: true, applied: matchGains(s) };
    }
    case "addMatch": {
      const num = Math.max(0, ...s.matches.map((m) => m.num)) + 1;
      return { ...s, matches: [...s.matches, newMatch(s.league, `m${num}-${Date.now().toString(36)}`, num, a.a, a.b, s.gardenChances)] };
    }
    case "deleteMatch": {
      const m = s.matches.find((x) => x.id === a.id);
      if (!m) return s;
      // take every game this pair already put on the leaderboard back off
      const league = GAMES.reduce(
        (l, g) => (m.games[g].committed ? revertApplied(l, m.games[g].applied, true) : l),
        s.league,
      );
      return {
        ...s,
        league,
        matches: s.matches.filter((x) => x.id !== a.id),
        current: s.current === a.id ? null : s.current,
      };
    }
    case "openMatch": {
      const m = s.matches.find((x) => x.id === a.id);
      if (!m) return s;
      const slot = m.games[s.game];
      // names follow the league (in case a team was renamed there)
      const named = slot.teams.map((t) => ({
        ...t,
        name: s.league.find((l) => l.id === t.leagueId)?.name ?? t.name,
      })) as GameSlot["teams"];
      return {
        ...s,
        current: m.id,
        teams: named,
        matchCommitted: slot.committed,
        applied: slot.applied,
        matches: s.matches.map((x) =>
          x.id === m.id ? { ...x, games: { ...x.games, [s.game]: { ...slot, opened: true, teams: named } } } : x,
        ),
      };
    }
    case "selectGame":
      // leave any open match first, so nothing syncs into the wrong game
      return { ...s, game: a.game, current: null };
    case "togglePin":
      return updateTeam(s, a.team, (t) => ({ ...t, pinned: !t.pinned }));
    case "useChance":
      return updateTeam(s, a.team, (t) => ({ ...t, chances: Math.min(9, Math.max(0, t.chances + a.delta)) }));
    case "setGardenChances": {
      // new starting chances for every Garden game that isn't finished (the open one too)
      const n = Math.min(9, Math.max(1, a.n));
      const reset = (g: GameSlot): GameSlot =>
        g.committed ? g : { ...g, teams: g.teams.map((t) => ({ ...t, chances: n })) as GameSlot["teams"] };
      const teams =
        s.game === "garden" && !s.matchCommitted
          ? (s.teams.map((t) => ({ ...t, chances: n })) as GameState["teams"])
          : s.teams;
      return {
        ...s,
        gardenChances: n,
        teams,
        matches: s.matches.map((m) => ({ ...m, games: { ...m.games, garden: reset(m.games.garden) } })),
      };
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
    default:
      // unknown action (e.g. an old page still open during an update): change nothing
      return s;
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
