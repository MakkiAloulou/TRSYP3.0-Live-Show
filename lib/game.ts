import { scoreFor } from "./scoring";

// Polygame state: two teams, each with a shapes board, a 5x5 grid, a timer and points.

/** normal = on the board · grey = used (placed on the grid) · frozen = locked by a pin penalty
    · removed = knocked off (older saves) */
export type ShapeState = "normal" | "grey" | "frozen" | "removed";
export type GridColor = 0 | 1 | 2; // 0 white, 1 red, 2 blue
/** A grid square split on its diagonal into two triangles. With a "\\" diagonal
    the halves are [top-right, bottom-left]; with "/" they are [top-left, bottom-right].
    `full` = coloured as one square (no diagonal shown); otherwise the halves are separate. */
export type Diag = "\\" | "/";
export interface GridCell {
  colors: [GridColor, GridColor];
  full: boolean;
  /** Number typed on the whole square (shown when full) */
  label: string;
  /** Numbers typed on each triangle (shown when split) */
  halfLabels: [string, string];
  /** which way the square is split */
  diag: Diag;
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
  /** Polygame, per phase: a corrected time ("m:ss.t"; empty = the timer's), position ("1" / "2")
      and accuracy total (0–20). Garden / Mine use `time` the same way. */
  time1: string;
  time2: string;
  time3: string;
  pos1: string;
  pos2: string;
  pos3: string;
  acc1: string;
  acc2: string;
  acc3: string;
  /** Garden: the attempt that succeeded ("1" / "2" / "3"), scans out of order */
  attempt: string;
  scans: string;
  /** Mine: crossing / lifting penalty ("1" = given) */
  penalty: string;
}
export type StatField = keyof TeamStats;

export interface TeamState {
  name: string;
  /** Which of the 8 league teams this is (set when the match is created) */
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
  /** Polygame: the timer's reading at the end of each phase (ms, cumulative) */
  splits?: number[];
  /** Polygame: when each green triangle was played to freeze the opponent (the screen's clock, ms) */
  greens?: Record<string, number>;
  /** Mine: when each glitch card was played (the screen's clock, ms) */
  cards?: Partial<Record<GlitchId, number>>;
}

/** Polygame: a green triangle isn't placed on the grid; played, it freezes the opponent's robot this long. */
export const GREEN_FREEZE_SECS = 20;

/* Mine: each team holds three glitch cards, each played once per match. A card
   hits the opponent for a few seconds. */
export type GlitchId = "jam" | "blind" | "onehand";
export const GLITCH_CARDS: { id: GlitchId; name: string; secs: number; color: "pink" | "green"; art: string }[] = [
  { id: "jam", name: "Signal Jam", secs: 5, color: "pink", art: "/glitch/signal-jam.png" },
  { id: "blind", name: "Blind Pilot", secs: 15, color: "green", art: "/glitch/blind-pilot.png" },
  { id: "onehand", name: "One Hand Control", secs: 15, color: "green", art: "/glitch/one-hand.png" },
];

/** One of the 8 teams on the overall leaderboard */
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
  /** League slot whose two teams haven't been chosen yet */
  empty?: boolean;
  /** Cup bracket position (cup matches only) */
  cup?: CupRound;
  /** Cup tie-break: the team picked by hand to go through */
  pick?: TeamId;
}

/* League = Polygame + Garden over the 4 drawn matches; Cup = Mine, a 4-team bracket. */
export type Mode = "league" | "cup";
export const MODE_GAMES: Record<Mode, GameKind[]> = { league: ["polygame", "garden"], cup: ["game3"] };
/* The cup, in playing order: two Mine semi-finals, then the 3rd place match and
   the final, both Polygame (3 phases). */
export type CupRound = "sf1" | "sf2" | "third" | "final";
export const CUP_ROUNDS: CupRound[] = ["sf1", "sf2", "third", "final"];
export const CUP_LABEL: Record<CupRound, string> = { sf1: "Semi-final 1", sf2: "Semi-final 2", third: "3rd place", final: "Final" };
/** The game a cup round is played in. */
export const cupGame = (r: CupRound): GameKind => (r === "sf1" || r === "sf2" ? "game3" : "polygame");
/** A cup match's slot: the game its round is played in. */
export const cupSlot = (m: Match) => m.games[cupGame(m.cup!)];
export const cupId = (r: CupRound) => `cup-${r}`;
/* The competition's eight teams, in the admin portal's order (ids t1…t8). */
const TEAMS: { name: string; branch: string; logo: string }[] = [
  { name: "IEEE RAS ENSIT", branch: "ENSIT SB", logo: "ensit" },
  { name: "HANNIBAL", branch: "ENICarthage SB", logo: "enicarthage" },
  { name: "AUTOBOTS", branch: "ESPRIT SB", logo: "esprit" },
  { name: "LONE WOLVES", branch: "IIT SB", logo: "iit" },
  { name: "SYNAPTECH", branch: "ISTMT SB", logo: "istmt" },
  { name: "HEPTABOT", branch: "ENETCom SB", logo: "enetcom" },
  { name: "SPARK", branch: "ENIG SB", logo: "enig" },
  { name: "NEXORA", branch: "ENIG SB", logo: "enig" },
];

/** A league team's IEEE student branch and its logo (public/branches), as on the draw. */
export const teamBranch = (leagueId: string | undefined) => {
  const t = leagueId ? TEAMS[parseInt(leagueId.slice(1), 10) - 1] : undefined;
  return t ? { branch: t.branch, logo: `/branches/${t.logo}.png` } : null;
};

/* The league draw made on the admin portal's /draw (saved 15 Oct 2026):
   each pair is [green corner, pink corner] = [team 1, team 2]. */
const DRAW: [string, string][] = [
  ["t4", "t1"], // LONE WOLVES vs IEEE RAS ENSIT
  ["t2", "t3"], // HANNIBAL vs AUTOBOTS
  ["t5", "t7"], // SYNAPTECH vs SPARK
  ["t8", "t6"], // NEXORA vs HEPTABOT
];
export const LEAGUE_SLOTS = DRAW.length;
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
  /** League or Cup (page −1) */
  mode: Mode;
  /** Garden: starting chances for every match */
  gardenChances: number;
  /** Homologation (before any game): each league team's score, 0–50, as typed */
  homologation: Record<string, string>;
  /** the homologation scores have been shown (and are counted in the league) */
  homolDone: boolean;
  /** points homologation has added to each team so far (so corrections add only the difference) */
  homolApplied: Record<string, number>;
}

export type Action =
  | { type: "setShape"; team: TeamId; id: string; state: ShapeState }
  | { type: "cycleHalf"; team: TeamId; index: number; half: 0 | 1 }
  | { type: "cycleCell"; team: TeamId; index: number; half: 0 | 1 }
  | { type: "editLabel"; team: TeamId; index: number; half: 0 | 1; key: string }
  /** drag a piece onto the grid: a cube fills the square (half null), a triangle one half */
  | { type: "placeShape"; team: TeamId; shape: string; index: number; half: 0 | 1 | null; diag?: Diag }
  /** empty a square; its pieces go back to the board */
  | { type: "clearCell"; team: TeamId; index: number }
  | { type: "editStat"; team: TeamId; field: StatField; key: string }
  /* whole-value versions, for the remote controller's form fields */
  | { type: "setStat"; team: TeamId; field: StatField; value: string }
  /** a whole stats form at once: the remote's draft, sent when the operator shows it */
  | { type: "setStats"; team: TeamId; stats: Partial<TeamStats> }
  | { type: "setLabel"; team: TeamId; index: number; half: 0 | 1; value: string }
  | { type: "setLeaguePoints"; id: string; points: number }
  /** homologation scores (0–50 each), shown and counted in the league table */
  | { type: "setHomologation"; scores: Record<string, string> }
  | { type: "toggleTimer"; team: TeamId; now: number }
  | { type: "startBoth"; now: number }
  | { type: "stopTimer"; team: TeamId; now: number }
  | { type: "resetTimer"; team: TeamId }
  | { type: "addPoints"; team: TeamId; delta: number }
  | { type: "rename"; team: TeamId; name: string }
  | { type: "resetAll" }
  | { type: "startOver" }
  | { type: "commitMatch" }
  | { type: "addMatch"; a: string; b: string }
  | { type: "deleteMatch"; id: string }
  | { type: "openMatch"; id: string }
  | { type: "selectMode"; mode: Mode }
  | { type: "setPair"; id: string; a: string; b: string }
  | { type: "clearMatch"; id: string }
  | { type: "cupDraw"; order: string[] }
  | { type: "cupReset" }
  | { type: "finishCupMatch" }
  | { type: "cupPick"; id: string; team: TeamId }
  | { type: "selectGame"; game: GameKind }
  | { type: "useChance"; team: TeamId; delta: number }
  | { type: "playCard"; team: TeamId; card: GlitchId; now: number }
  | { type: "playGreen"; team: TeamId; shape: string; now: number }
  | { type: "unplayGreen"; team: TeamId; shape: string }
  | { type: "unplayCard"; team: TeamId; card: GlitchId }
  | { type: "togglePin"; team: TeamId }
  /** pin a team and freeze some of its unused pieces (they can't be placed any more) */
  | { type: "pin"; team: TeamId; freeze: string[] }
  /** take the pin off (frozen pieces stay frozen) */
  | { type: "unpin"; team: TeamId }
  /** Polygame: the current phase ends for both teams. Each team's time is its own
      timer's reading (a team that already stopped keeps its finishing time). */
  | { type: "endPhase"; now: number }
  | { type: "undoPhase" }
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
  time1: "",
  time2: "",
  time3: "",
  pos1: "",
  pos2: "",
  pos3: "",
  acc1: "",
  acc2: "",
  acc3: "",
  attempt: "",
  scans: "",
  penalty: "",
});

const freshTeam = (name: string): TeamState => ({
  name,
  shapes: Object.fromEntries(SHAPES.map((s) => [s.id, "normal" as ShapeState])),
  grid: Array.from({ length: 25 }, (): GridCell => blankCell()),
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
  const team = (tid: string) =>
    tid
      ? { ...freshTeam(league.find((l) => l.id === tid)?.name ?? "?"), leagueId: tid, chances }
      : { ...freshTeam("TBD"), chances };
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

/** The 4 league matches from the draw (fixed ids m1…m4 so server and client render the same) */
const leagueSlots = (league: LeagueTeam[], chances: number): Match[] =>
  DRAW.map(([a, b], i) => newMatch(league, `m${i + 1}`, i + 1, a, b, chances));

/** A save from before the real teams and the draw (9 placeholder teams / 9 slots) is not loaded. */
const isCurrentSave = (s: GameState) =>
  Array.isArray(s.league) &&
  s.league.length === TEAMS.length &&
  TEAMS.every((_, i) => s.league.some((l) => l.id === `t${i + 1}`)) &&
  Array.isArray(s.matches) &&
  s.matches.filter((m) => !m.cup).length === LEAGUE_SLOTS;

export const normalizeState = (s: GameState): GameState => {
  if (!isCurrentSave(s)) return initialState();
  const league = s.league;
  const chances = s.gardenChances ?? 3;
  const matches = (Array.isArray(s.matches) ? s.matches : []).map((m) => {
    const old = m as unknown as Partial<GameSlot> & Match; // saves from before games existed
    const ids = (old.games?.polygame ?? old).teams?.map((t) => t.leagueId ?? "") ?? ["", ""];
    const base = newMatch(league, m.id, m.num, ids[0], ids[1], chances);
    const games = old.games ?? { polygame: { teams: old.teams!, opened: !!old.opened, committed: !!old.committed, applied: old.applied ?? {} } };
    return {
      id: m.id,
      num: m.num,
      empty: m.empty,
      cup: m.cup,
      pick: m.pick,
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
    mode: s.mode ?? "league",
    gardenChances: chances,
    homologation: s.homologation ?? {},
    homolDone: !!s.homolDone,
    homolApplied: s.homolApplied ?? {},
  };
};

export const initialState = (): GameState => seedCup(blankState());

const blankState = (): GameState => {
  const league = freshLeague();
  const matches = leagueSlots(league, 3);
  return {
    teams: matches[0].games.polygame.teams,
    league,
    matchCommitted: false,
    applied: {},
    matches,
    current: null,
    game: "polygame",
    mode: "league",
    gardenChances: 3,
    homologation: {},
    homolDone: false,
    homolApplied: {},
  };
};

/* ─── League / cup helpers ─────────────────────────────────────────── */

export const leagueMatches = (s: GameState) => s.matches.filter((m) => !m.cup);
export const cupMatch = (s: GameState, r: CupRound) => s.matches.find((m) => m.cup === r);
/** Whether a match can be opened: it has its teams, and the final always waits for the 3rd place match. */
export const canOpen = (s: GameState, m: Match | undefined) => {
  if (!m || m.empty) return false;
  if (m.cup !== "final") return true;
  const third = cupMatch(s, "third");
  return !third || cupSlot(third).committed;
};

/** The first league slot not yet done in `game` (and with teams) — glows on screen 0. */
export const nextMatchId = (s: GameState, game: GameKind) =>
  leagueMatches(s).find((m) => !m.empty && !m.games[game].committed)?.id ?? null;

/** Cup winner of a finished match: the higher score in its round's game, or the hand-picked team on a tie. */
export const cupWinner = (m: Match | undefined): TeamId | null => {
  if (!m?.cup || m.empty || !cupSlot(m).committed) return null;
  const g = cupGame(m.cup);
  const a = gameScore(g, cupSlot(m).teams[0]);
  const b = gameScore(g, cupSlot(m).teams[1]);
  if (a !== b) return a > b ? 0 : 1;
  return m.pick ?? null;
};
export const cupWinnerId = (m: Match | undefined) => {
  const w = cupWinner(m);
  return w === null || !m ? null : (cupSlot(m).teams[w].leagueId ?? null);
};
export const cupLoserId = (m: Match | undefined) => {
  const w = cupWinner(m);
  return w === null || !m ? null : (cupSlot(m).teams[w ? 0 : 1].leagueId ?? null);
};
/** A cup round has started once its match was opened. */
export const cupStarted = (s: GameState, r: CupRound) => {
  const m = s.matches.find((x) => x.cup === r);
  return !!m && cupSlot(m).opened;
};

/** Set (or replace) the two teams of a match. Anything it put on the league comes back off. */
const withPair = (s: GameState, m: Match, a: string, b: string): Match => ({
  ...newMatch(s.league, m.id, m.num, a, b, s.gardenChances),
  cup: m.cup,
  empty: !a || !b ? true : undefined,
});
const revertMatch = (league: LeagueTeam[], m: Match) =>
  GAMES.reduce((l, g) => (m.games[g].committed && !m.cup ? revertApplied(l, m.games[g].applied, true) : l), league);

/** Score a team brings into the current game from the games before it (same match). */
export const carriedIn = (s: GameState, team: TeamId): number => {
  const m = s.current ? s.matches.find((x) => x.id === s.current) : null;
  if (!m) return 0;
  return slotCarry(m, s.game, team);
};

/** Points a team scored in one game of a match, from the scoring system (lib/scoring.ts). */
export const gameScore = (game: GameKind, t: TeamState) => scoreFor(game, t);

/** Sum of the games before `game` for this match. */
export const slotCarry = (m: Match, game: GameKind, team: TeamId) =>
  GAMES.slice(0, GAMES.indexOf(game)).reduce((sum, g) => sum + gameScore(g, m.games[g].teams[team]), 0);

/** Cumulative score shown for a team after `game` (carried + this game). */
export const cumulative = (m: Match, game: GameKind, team: TeamId) =>
  slotCarry(m, game, team) + gameScore(game, m.games[game].teams[team]);

function freshLeague(): LeagueTeam[] {
  return TEAMS.map(({ name }, i) => ({ id: `t${i + 1}`, name, points: 0, played: 0 }));
}

/** Stable sort: more points first; equal points keep their previous order. */
/** A homologation score as points: 0–50, whole points. */
export const HOMOL_MAX = 50;
export const homolPoints = (raw: string | undefined) => Math.min(HOMOL_MAX, Math.max(0, Math.round(parseFloat(raw ?? "") || 0)));

const sortLeague = (l: LeagueTeam[]) => l.map((t, i) => ({ t, i })).sort((a, b) => b.t.points - a.t.points || a.i - b.i).map((x) => x.t);

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Points each league team would gain from the current match (by matching team names). */
export const matchGains = (s: GameState): Record<string, number> => {
  const gains: Record<string, number> = {};
  if (!s.current || s.matches.find((m) => m.id === s.current)?.cup) return gains; // cup points stay out of the league
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

export const blankCell = (diag: Diag = "\\"): GridCell => ({ colors: [0, 0], full: false, label: "", halfLabels: ["", ""], diag });

/** The half of a square a point falls in (x, y from 0 to 1 across the square). */
export const halfAt = (diag: Diag, x: number, y: number): 0 | 1 =>
  diag === "\\" ? (x > y ? 0 : 1) : x + y < 1 ? 0 : 1;

/** The shape numbers sitting on a square. */
const cellNums = (c: GridCell) => (c.full ? [c.label] : c.halfLabels).filter(Boolean);

/** Take shape `num` off a square (it's being moved elsewhere). */
const liftPiece = (c: GridCell, num: string): GridCell => {
  if (c.full) return c.label === num ? blankCell(c.diag) : c;
  if (!c.halfLabels.includes(num)) return c;
  const colors: GridCell["colors"] = [...c.colors];
  const halfLabels: GridCell["halfLabels"] = [...c.halfLabels];
  ([0, 1] as const).forEach((h) => {
    if (halfLabels[h] === num) {
      colors[h] = 0;
      halfLabels[h] = "";
    }
  });
  return { ...c, colors, halfLabels };
};

/** Pieces knocked off the grid go back to the board (placed = grey → normal). */
const freeShapes = (shapes: TeamState["shapes"], nums: string[]) => {
  const out = { ...shapes };
  for (const n of nums) {
    const def = SHAPES.find((x) => String(x.num) === n);
    if (def && out[def.id] === "grey") out[def.id] = "normal";
  }
  return out;
};

/** Accepts any older saved / in-memory cell shape and returns a valid GridCell. */
export function toCell(raw: unknown): GridCell {
  const c = raw as Partial<GridCell> | [GridColor, GridColor] | null | undefined;
  if (Array.isArray(c)) return { colors: [c[0] ?? 0, c[1] ?? 0], full: false, label: "", halfLabels: ["", ""], diag: "\\" };
  return {
    diag: c?.diag === "/" ? "/" : "\\",
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

/** The semi-final winners go to the final, the losers to the 3rd place match
    (each only until that match is opened). */
function fillFinal(s: GameState): GameState {
  const sf1 = cupMatch(s, "sf1");
  const sf2 = cupMatch(s, "sf2");
  const place = (st: GameState, r: CupRound, a: string, b: string): GameState => {
    const m = cupMatch(st, r);
    if (!m || cupSlot(m).opened) return st;
    const cur = cupSlot(m).teams.map((t) => t.leagueId ?? "");
    if (cur[0] === a && cur[1] === b) return st;
    return { ...st, matches: st.matches.map((x) => (x.id === m.id ? withPair(st, m, a, b) : x)) };
  };
  const n = place(s, "final", cupWinnerId(sf1) ?? "", cupWinnerId(sf2) ?? "");
  return place(n, "third", cupLoserId(sf1) ?? "", cupLoserId(sf2) ?? "");
}

/** Every change to the open match is mirrored into its entry in `matches`. */
/* The cup's semi-finals are seeded from the league table, never drawn:
   semi-final 1 = 1st vs 4th, semi-final 2 = 2nd vs 3rd. They follow the table
   until the first cup match is opened, then they're fixed. */
const cupSeeds = (s: GameState) => {
  const [a, b, c, d] = s.league.map((l) => l.id);
  return [a, d, b, c];
};

function seedCup(s: GameState): GameState {
  if (s.league.length < 4 || CUP_ROUNDS.some((r) => cupStarted(s, r))) return s;
  const [p, q, r, t] = cupSeeds(s);
  const has = (round: CupRound, x: string, y: string) => {
    const ids = cupMatch(s, round)?.games.game3.teams.map((tm) => tm.leagueId);
    return ids?.[0] === x && ids?.[1] === y;
  };
  if (has("sf1", p, q) && has("sf2", r, t) && cupMatch(s, "third") && cupMatch(s, "final")) return s;
  return baseReducer(s, { type: "cupDraw", order: [p, q, r, t] });
}

export function reducer(s: GameState, a: Action): GameState {
  const n = seedCup(baseReducer(s, a));
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
    case "setStat":
      return updateTeam(s, a.team, (t) => ({ ...t, stats: { ...t.stats, [a.field]: a.value.slice(0, 7) } }));
    case "placeShape": {
      const def = SHAPES.find((x) => x.id === a.shape);
      if (!def || def.kind === "green" || !def.num) return s;
      if (s.teams[a.team].shapes[def.id] === "frozen") return s; // frozen pieces can't be used
      const color: GridColor = def.kind.startsWith("red") ? 1 : 2;
      const num = String(def.num);
      return updateTeam(s, a.team, (t) => {
        // the piece leaves wherever it was before
        const grid = t.grid.map(toCell).map((c) => liftPiece(c, num));
        const target = grid[a.index];
        let freed: string[] = [];
        let cell: GridCell;
        if (a.half === null) {
          freed = cellNums(target);
          cell = { ...blankCell(target.diag), colors: [color, color], full: true, label: num };
        } else {
          const diag = a.diag ?? target.diag;
          const fresh = target.full || target.diag !== diag;
          const base = fresh ? blankCell(diag) : target;
          freed = fresh ? cellNums(target) : [base.halfLabels[a.half]].filter(Boolean);
          const colors: GridCell["colors"] = [...base.colors];
          const halfLabels: GridCell["halfLabels"] = [...base.halfLabels];
          colors[a.half] = color;
          halfLabels[a.half] = num;
          cell = { ...base, diag, full: false, colors, halfLabels };
        }
        grid[a.index] = cell;
        const shapes = freeShapes(t.shapes, freed.filter((n) => n !== num));
        shapes[def.id] = "grey";
        return { ...t, grid, shapes };
      });
    }
    case "clearCell":
      return updateTeam(s, a.team, (t) => {
        const grid = t.grid.map(toCell);
        const freed = cellNums(grid[a.index]);
        grid[a.index] = blankCell();
        return { ...t, grid, shapes: freeShapes(t.shapes, freed) };
      });
    case "setStats":
      return updateTeam(s, a.team, (t) => ({
        ...t,
        stats: {
          ...t.stats,
          ...Object.fromEntries(Object.entries(a.stats).map(([k, v]) => [k, String(v ?? "").slice(0, 7)])),
        },
      }));
    case "setLabel":
      return updateCell(s, a.team, a.index, (c) => {
        const v = a.value.replace(/\D/g, "").slice(0, 3);
        if (c.full) return { ...c, label: v };
        const halfLabels: GridCell["halfLabels"] = [...c.halfLabels];
        halfLabels[a.half] = v;
        return { ...c, halfLabels };
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
      return updateTeam(s, a.team, (t) => ({ ...t, timer: freshTimer(), splits: [] }));
    case "endPhase": {
      const done = Math.min(...s.teams.map((t) => t.splits?.length ?? 0));
      if (done >= 3 || s.teams.every((t) => !t.timer.running && !t.timer.accumulated)) return s;
      // both timers stop; Start both begins the next phase
      const end = (t: TeamState): TeamState => {
        const splits = (t.splits ?? []).slice(0, done);
        const at = Math.max(elapsedMs(t.timer, a.now), splits[splits.length - 1] ?? 0);
        return { ...t, splits: [...splits, at], timer: t.timer.running ? toggle(t.timer, a.now) : t.timer };
      };
      return { ...s, teams: s.teams.map(end) as GameState["teams"] };
    }
    case "undoPhase":
      return { ...s, teams: s.teams.map((t) => ({ ...t, splits: (t.splits ?? []).slice(0, -1) })) as GameState["teams"] };
    case "addPoints":
      return updateTeam(s, a.team, (t) => ({ ...t, points: Math.max(0, t.points + a.delta) }));
    case "rename":
      return updateTeam(s, a.team, (t) => ({ ...t, name: a.name }));
    case "startOver":
      // the whole show from scratch: homologation, every match, the league table and the cup
      return initialState();
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
    case "selectMode":
      return { ...s, mode: a.mode, game: MODE_GAMES[a.mode][0], current: null };
    case "setPair": {
      const m = s.matches.find((x) => x.id === a.id);
      if (!m || a.a === a.b) return s;
      return {
        ...s,
        league: sortLeague(revertMatch(s.league, m)),
        matches: s.matches.map((x) => (x.id === m.id ? withPair(s, m, a.a, a.b) : x)),
        current: s.current === m.id ? null : s.current,
      };
    }
    case "clearMatch": {
      const m = s.matches.find((x) => x.id === a.id);
      if (!m) return s;
      return {
        ...s,
        league: sortLeague(revertMatch(s.league, m)),
        matches: s.matches.map((x) => (x.id === m.id ? withPair(s, m, "", "") : x)),
        current: s.current === m.id ? null : s.current,
      };
    }
    case "cupDraw": {
      // a.order = 4 league ids: semi-final 1 gets [0, 1], semi-final 2 gets [2, 3]
      if (CUP_ROUNDS.some((r) => cupStarted(s, r))) return s; // locked once played
      const [p, q, r2, t] = a.order;
      const mk = (r: CupRound, x: string, y: string, num: number): Match => ({
        ...newMatch(s.league, cupId(r), num, x, y, s.gardenChances),
        cup: r,
        empty: !x || !y ? true : undefined,
      });
      return {
        ...s,
        matches: [...leagueMatches(s), mk("sf1", p, q, 101), mk("sf2", r2, t, 102), mk("third", "", "", 103), mk("final", "", "", 104)],
        current: s.current?.startsWith("cup-") ? null : s.current,
      };
    }
    case "cupReset":
      // results cleared; the reducer re-seeds the semi-finals from the table
      return { ...s, matches: leagueMatches(s), current: s.current?.startsWith("cup-") ? null : s.current };
    case "finishCupMatch": {
      // leaving a cup match's Game Stats: mark it played, then fill the final once both semis have a winner
      if (!s.current?.startsWith("cup-")) return s;
      let n: GameState = { ...s, matchCommitted: true };
      n = {
        ...n,
        matches: n.matches.map((m) =>
          m.id === s.current && m.cup
            ? { ...m, games: { ...m.games, [cupGame(m.cup)]: { ...cupSlot(m), teams: s.teams, committed: true } } }
            : m,
        ),
      };
      return fillFinal(n);
    }
    case "cupPick": {
      const n = { ...s, matches: s.matches.map((m) => (m.id === a.id ? { ...m, pick: a.team } : m)) };
      return fillFinal(n);
    }
    case "openMatch": {
      const m = s.matches.find((x) => x.id === a.id);
      if (!m || !canOpen(s, m)) return s;
      const game = m.cup ? cupGame(m.cup) : s.game;
      const slot = m.games[game];
      // names follow the league (in case a team was renamed there)
      const named = slot.teams.map((t) => ({
        ...t,
        name: s.league.find((l) => l.id === t.leagueId)?.name ?? t.name,
      })) as GameSlot["teams"];
      return {
        ...s,
        game,
        current: m.id,
        teams: named,
        matchCommitted: slot.committed,
        applied: slot.applied,
        matches: s.matches.map((x) =>
          x.id === m.id ? { ...x, games: { ...x.games, [game]: { ...slot, opened: true, teams: named } } } : x,
        ),
      };
    }
    case "selectGame":
      // leave any open match first, so nothing syncs into the wrong game
      return { ...s, game: a.game, current: null };
    case "togglePin":
      return updateTeam(s, a.team, (t) => ({ ...t, pinned: !t.pinned }));
    case "pin":
      return updateTeam(s, a.team, (t) => {
        const shapes = { ...t.shapes };
        for (const id of a.freeze.slice(0, 4)) if ((shapes[id] ?? "normal") === "normal") shapes[id] = "frozen";
        return { ...t, pinned: true, shapes };
      });
    case "unpin":
      // the pin comes off; its frozen pieces stay frozen for the rest of the match
      return updateTeam(s, a.team, (t) => ({ ...t, pinned: false }));
    case "useChance":
      return updateTeam(s, a.team, (t) => ({ ...t, chances: Math.min(9, Math.max(0, t.chances + a.delta)) }));
    case "playGreen": {
      // a green triangle, still unused: it greys out (for the rest of the match) and freezes the opponent
      const def = SHAPES.find((x) => x.id === a.shape);
      if (def?.kind !== "green") return s;
      return updateTeam(s, a.team, (t) =>
        (t.shapes[a.shape] ?? "normal") !== "normal"
          ? t
          : { ...t, shapes: { ...t.shapes, [a.shape]: "grey" }, greens: { ...t.greens, [a.shape]: a.now } },
      );
    }
    case "unplayGreen":
      return updateTeam(s, a.team, (t) => {
        if (t.greens?.[a.shape] === undefined) return t;
        const greens = { ...t.greens };
        delete greens[a.shape];
        return { ...t, shapes: { ...t.shapes, [a.shape]: "normal" }, greens };
      });
    case "playCard":
      // once per match
      return updateTeam(s, a.team, (t) => (t.cards?.[a.card] ? t : { ...t, cards: { ...t.cards, [a.card]: a.now } }));
    case "unplayCard":
      return updateTeam(s, a.team, (t) => {
        const cards = { ...t.cards };
        delete cards[a.card];
        return { ...t, cards };
      });
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
    case "setHomologation": {
      // count each team's homologation score in the league, replacing what an earlier send added
      const homologation = { ...s.homologation, ...a.scores };
      const applied: Record<string, number> = {};
      for (const l of s.league) applied[l.id] = homolPoints(homologation[l.id]);
      return {
        ...s,
        homologation,
        homolDone: true,
        homolApplied: applied,
        league: sortLeague(s.league.map((l) => ({ ...l, points: Math.max(0, l.points + applied[l.id] - (s.homolApplied[l.id] ?? 0)) }))),
      };
    }
    case "setLeaguePoints":
      return {
        ...s,
        league: sortLeague(s.league.map((l) => (l.id === a.id ? { ...l, points: Math.max(0, Math.round(a.points) || 0) } : l))),
      };
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


/** A team's time for the stats screens: "4:12.3" (empty before the timer has run). */
export const clockText = (ms: number) => {
  if (ms <= 0) return "";
  const tenths = Math.floor(ms / 100);
  return `${Math.floor(tenths / 600)}:${String(Math.floor(tenths / 10) % 60).padStart(2, "0")}.${tenths % 10}`;
};

export const formatTime = (ms: number) => {
  const total = Math.floor(ms / 100);
  const tenths = total % 10;
  const secs = Math.floor(total / 10) % 60;
  const mins = Math.floor(total / 600);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
};
