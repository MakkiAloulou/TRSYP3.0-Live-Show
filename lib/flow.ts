/* The show's running order, shared by the big screen (which carries it out)
   and the remote (which labels its Next button with it):

   logo → 00 Homologation (opener → scores → leaderboard), once, before any game →
   Polygame title → line-up → match 1 (live → Phase Stats → Game Stats →
   leaderboard) → line-up → … match 4 → Garden title → line-up → … →
   Champions Cup title → bracket (1st v 4th, 2nd v 3rd) → semi-finals (Mine) →
   3rd place → final (both Polygame) → champion → logo */

import { CUP_LABEL, CUP_ROUNDS, cupGame, cupMatch, cupSlot, cupWinnerId, GAME_INFO, leagueMatches, nextMatchId, type GameKind, type GameState, type Match } from "./game";
import type { View } from "./remote";

export const STAGES: GameKind[] = ["polygame", "garden", "game3"];
export const stageMode = (g: GameKind) => (g === "game3" ? "cup" : "league");
/** A stage's name: the league games by their game, the third stage is the cup (Mine and Polygame). */
export const stageName = (g: GameKind) => (g === "game3" ? "Champions Cup" : GAME_INFO[g].title);
export const stageTitle = (g: GameKind) => `${String(GAME_INFO[g].num).padStart(2, "0")} · ${stageName(g)}`;

/** The rail across the stage openers: homologation, then the three games. */
export const RAIL: { key: "homologation" | GameKind; num: string; name: string }[] = [
  { key: "homologation", num: "00", name: "Homologation" },
  ...STAGES.map((g) => ({ key: g, num: String(GAME_INFO[g].num).padStart(2, "0"), name: stageName(g) })),
];


const pair = (m: Match, g: GameKind) => `${m.games[g].teams[0].name} vs ${m.games[g].teams[1].name}`;

/** The cup match to play next: the first one, in playing order, with both teams and not played yet. */
export const nextCupMatch = (s: GameState) =>
  CUP_ROUNDS.map((r) => cupMatch(s, r)).find((m) => m && !m.empty && !cupSlot(m).committed);

export type Step =
  | { kind: "intro"; label: string } // logo → the stage's title card
  | { kind: "list"; label: string } // title card → line-up / bracket
  | { kind: "open"; id: string; label: string } // line-up → the next match
  | { kind: "stage"; game: GameKind; label: string } // stage done → the next stage's title card
  | { kind: "logo"; label: string } // the end → logo
  | { kind: "crown"; label: string } // cup won → the champion ceremony
  | { kind: "homol"; label: string } // logo → the homologation opener (before any game)
  | { kind: "homolNext"; label: string } // homologation: opener → scores → leaderboard
  | { kind: "homolEnd"; label: string } // homologation done → the first game's title card
  | { kind: "screen"; label: string } // inside a match: the next screen
  | { kind: "none"; label: string }; // waiting on something else (a tie to settle)

const MATCH_NEXT: Record<"game" | "stats" | "final" | "board", (s: GameState) => string> = {
  game: (s) => (s.game === "polygame" ? "Show Phase Stats" : "Show Game Stats details"),
  stats: () => "Game Stats",
  // cup matches never touch the league table
  final: (s) => (s.mode === "cup" ? "Back to the bracket" : "Leaderboard"),
  board: () => "Back to the line-up",
};

export function nextStep(s: GameState, view: View, homol: 0 | 1 | 2 = 0): Step {
  const g = s.game;
  switch (view) {
    case "logo":
      if (!s.homolDone) return { kind: "homol", label: "Start 00 · Homologation" };
      return { kind: "intro", label: `Start ${stageTitle(g)}` };
    case "homologation":
      if (homol === 0) return { kind: "homolNext", label: "Show the homologation scores" };
      if (homol === 1) return { kind: "homolNext", label: "Show the leaderboard" };
      return { kind: "homolEnd", label: `Start ${stageTitle(g)}` };
    case "intro":
      return { kind: "list", label: s.mode === "cup" ? "Show the bracket" : "Show the line-up" };
    case "matches": {
      const id = nextMatchId(s, g);
      const m = id ? leagueMatches(s).find((x) => x.id === id) : undefined;
      if (m) return { kind: "open", id: m.id, label: `Start Match ${m.num} · ${pair(m, g)}` };
      const after = STAGES[STAGES.indexOf(g) + 1];
      return after ? { kind: "stage", game: after, label: `Next game: ${stageTitle(after)}` } : { kind: "logo", label: "Back to the logo" };
    }
    case "bracket": {
      if (cupWinnerId(cupMatch(s, "final"))) return { kind: "crown", label: "Crown the champion" };
      const m = nextCupMatch(s);
      if (m?.cup) return { kind: "open", id: m.id, label: `Start ${CUP_LABEL[m.cup]} · ${pair(m, cupGame(m.cup))}` };
      return { kind: "none", label: "Pick the tie winner first" };
    }
    case "champion":
      return { kind: "logo", label: "Back to the logo" };
    default:
      return { kind: "screen", label: MATCH_NEXT[view](s) };
  }
}
