import { type GameState, type Match } from "./game";

/* The shape each Polygame match asks for, on the 5 × 5 grid (rows and
   columns 0-4). A part is a whole square, or the triangle half of one,
   named by the corner its right angle is in. Drawn by the organisers:
   league matches 1-3 are T, R and S, the 3rd place match Y, the final P. */

type Corner = "tl" | "tr" | "bl" | "br";
export interface Part {
  r: number;
  c: number;
  tri?: Corner;
}
export interface Target {
  letter: string;
  parts: Part[];
  /** what it may be built from (shown with it) */
  pieces: { cubes: number; triangles: number };
}

const sq = (r: number, c: number): Part => ({ r, c });
const tri = (r: number, c: number, corner: Corner): Part => ({ r, c, tri: corner });

const P32 = { cubes: 3, triangles: 2 };

export const TARGETS = {
  // five squares: two of them are made of two triangles each (3 cubes + 4 triangles)
  T: { letter: "T", parts: [sq(1, 1), sq(1, 2), sq(1, 3), sq(2, 2), sq(3, 2)], pieces: { cubes: 3, triangles: 4 } },
  R: { letter: "R", parts: [tri(1, 1, "br"), sq(1, 2), sq(2, 1), sq(3, 1), tri(3, 2, "tr")], pieces: P32 },
  S: { letter: "S", parts: [sq(1, 2), tri(1, 3, "bl"), sq(2, 2), sq(3, 2), tri(3, 1, "br")], pieces: P32 },
  Y: { letter: "Y", parts: [tri(0, 1, "bl"), tri(0, 3, "br"), sq(1, 2), sq(2, 2), sq(3, 2)], pieces: P32 },
  P: { letter: "P", parts: [sq(1, 2), sq(2, 2), sq(3, 2), tri(1, 3, "bl"), tri(2, 3, "tl")], pieces: P32 },
} satisfies Record<string, Target>;

const LEAGUE: Target[] = [TARGETS.T, TARGETS.R, TARGETS.S];

/** The shape a match asks for: Polygame only (league 1-3, then the 3rd place match and the final). */
export const targetFor = (m: Match | undefined): Target | null => {
  if (!m || m.empty) return null;
  if (m.cup === "third") return TARGETS.Y;
  if (m.cup === "final") return TARGETS.P;
  if (m.cup) return null; // the semi-finals are Mine
  return LEAGUE[m.num - 1] ?? null;
};

/** The shape of the open match, while it's a Polygame one. */
export const currentTarget = (s: GameState) =>
  s.game === "polygame" ? targetFor(s.matches.find((m) => m.id === s.current)) : null;

type Pt = [number, number];

/** A part's corners in grid units (x = column, y = row). */
export const partPoints = ({ r, c, tri: t }: Part): Pt[] => {
  const tl: Pt = [c, r];
  const tr: Pt = [c + 1, r];
  const bl: Pt = [c, r + 1];
  const br: Pt = [c + 1, r + 1];
  if (!t) return [tl, tr, br, bl];
  return { tl: [tl, tr, bl], tr: [tl, tr, br], bl: [tl, bl, br], br: [tr, br, bl] }[t];
};

/** The shape's outline: every part edge that isn't shared with another part. */
export const outlineEdges = (t: Target): [Pt, Pt][] => {
  const key = ([a, b]: [Pt, Pt]) => [a.join(","), b.join(",")].sort().join("|");
  const count = new Map<string, { edge: [Pt, Pt]; n: number }>();
  for (const p of t.parts) {
    const pts = partPoints(p);
    pts.forEach((a, i) => {
      const edge: [Pt, Pt] = [a, pts[(i + 1) % pts.length]];
      const k = key(edge);
      const e = count.get(k);
      if (e) e.n++;
      else count.set(k, { edge, n: 1 });
    });
  }
  return [...count.values()].filter((e) => e.n === 1).map((e) => e.edge);
};
