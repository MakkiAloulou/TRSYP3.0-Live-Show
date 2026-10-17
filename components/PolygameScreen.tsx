"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { canOpen, CUP_LABEL, cupGame, cupMatch, cupSlot, cupWinner, GAME_INFO, gameScore, initialState, reducer, slotCarry, type Action, type GameKind, type GameState } from "@/lib/game";
import { nextStep, stageMode } from "@/lib/flow";
import { compact, readKey, saveKey, screenBus, useLink, type Command, type Screen, type View } from "@/lib/remote";
import Image from "next/image";
import logo from "@/public/trsyp-logo.png";
import Backdrop from "./Backdrop";
import { StrokeDefs } from "./Draw";
import ScanBar, { SCAN_W } from "./ScanBar";
import FinalScreen from "./FinalScreen";
import LeaderboardScreen from "./LeaderboardScreen";
import BracketScreen from "./BracketScreen";
import ChampionScreen, { type Crown } from "./ChampionScreen";
import EffectCountdown from "./EffectCountdown";
import HomologationScreen from "./HomologationScreen";
import LogoScreen from "./LogoScreen";
import StageScreen from "./StageScreen";
import MatchesScreen from "./MatchesScreen";
import StatsScreen from "./StatsScreen";
import TeamPanel from "./TeamPanel";

const STAGE_W = 1920;
const STAGE_H = 1080;
const STORAGE_KEY = "trsyp3-polygame-v8"; // v8: the 8 real teams and the 4 drawn league matches

/* Keyboard map by the letter printed on the key (works on AZERTY and QWERTY;
   caps lock / Shift don't matter). Shift + points key = ±5. */
const KEYS = {
  q: { type: "stopTimer", team: 0 },
  a: { type: "resetTimer", team: 0 },
  w: { type: "points", team: 0, delta: 1 },
  s: { type: "points", team: 0, delta: -1 },
  p: { type: "stopTimer", team: 1 },
  l: { type: "resetTimer", team: 1 },
  o: { type: "points", team: 1, delta: 1 },
  k: { type: "points", team: 1, delta: -1 },
} as const;

const VIEWS = ["game", "stats", "final", "board"] as const;
/** Which screens each game walks through with →. Layer 1 is Phase Stats for Polygame,
    and the Game Stats details table for Garden / Mine. */
const SEQ: Record<GameKind, number[]> = { polygame: [0, 1, 2, 3], garden: [0, 1, 2, 3], game3: [0, 1, 2] };
const seqOf = (s: GameState) => (s.mode === "cup" ? SEQ[s.game].filter((i) => i !== 3) : SEQ[s.game]);

const WIPE_MS = 820;
const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/** rAF tween 0→1; resolves when done (instantly with reduced motion). A timer
    guarantees it finishes on time even if the browser throttles frames. */
const tween = (ms: number, frame: (p: number) => void) =>
  new Promise<void>((done) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      frame(1);
      return done();
    }
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      frame(1);
      done();
    };
    const t0 = performance.now();
    const step = (now: number) => {
      if (finished) return;
      const p = Math.min(1, (now - t0) / ms);
      if (p >= 1) return finish();
      frame(p);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(finish, ms + 60);
  });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ZOOM_MS = 700;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type Rect = { x: number; y: number; w: number; h: number };
const FULL: Rect = { x: 0, y: 0, w: STAGE_W, h: STAGE_H };

export default function PolygameScreen() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [scale, setScale] = useState(1);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });
  const resetArm = useRef(0);

  // Screen switching. Screens are stacked top→bottom in this order; → wipes the
  // current one away with the scan bar (revealing the next, which draws itself),
  // ← un-draws the current one and wipes the previous one back in.
  const [viewIdx, setViewIdx] = useState(0);
  const [drawn, setDrawn] = useState<boolean[]>(() => VIEWS.map((_, i) => i === 0));
  const viewRef = useRef(0);
  const busy = useRef(false);
  const layerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const barRef = useRef<HTMLDivElement>(null);
  const view = VIEWS[viewIdx];

  const setDrawnAt = (i: number, on: boolean) =>
    setDrawn((d) => d.map((v, k) => (k === i ? on : v)));

  // `edge` = x of the wipe line. The layer stays visible only to the right of it.
  const placeWipe = (layer: number, edge: number, movingRight: boolean) => {
    const g = layerRefs.current[layer];
    const b = barRef.current;
    if (g) g.style.clipPath = `inset(0 0 0 ${Math.min(Math.max(edge, 0), STAGE_W)}px)`;
    if (b) b.style.transform = movingRight ? `translateX(${edge - SCAN_W}px)` : `translateX(${edge}px) scaleX(-1)`;
  };

  const goNext = async () => {
    const i = viewRef.current;
    const seq = seqOf(stateRef.current);
    const next = seq[seq.indexOf(i) + 1];
    if (busy.current) return;
    if (next === undefined) {
      // Cup: after Game Stats the match is done → back to the bracket, winner moves on
      if (stateRef.current.mode === "cup") dispatch({ type: "finishCupMatch" });
      // League: after the leaderboard → back to the line-up
      void backToList();
      return;
    }
    busy.current = true;
    viewRef.current = next;
    setViewIdx(next);
    let started = false;
    await tween(WIPE_MS, (p) => {
      placeWipe(i, easeInOut(p) * (STAGE_W + SCAN_W), true);
      // start drawing the next screen while the bar is still crossing
      if (!started && p > 0.45) {
        started = true;
        setDrawnAt(next, true);
      }
    });
    setDrawnAt(i, false); // fully hidden now; reset so it draws in fresh on return
    busy.current = false;
    runQueued();
  };

  const goPrev = async () => {
    const i = viewRef.current;
    const seq = seqOf(stateRef.current);
    const prev = seq[seq.indexOf(i) - 1];
    if (busy.current) return;
    if (prev === undefined) return void backToList(); // live match ← line-up
    busy.current = true;
    setDrawnAt(i, false); // the current screen un-draws first
    await wait(420);
    setDrawnAt(prev, true);
    // mirrored bar trails to the right of the edge, so run it past 0 to leave the screen
    await tween(WIPE_MS, (p) => placeWipe(prev, (1 - easeInOut(p)) * (STAGE_W + 2 * SCAN_W) - SCAN_W, false));
    viewRef.current = prev;
    setViewIdx(prev);
    busy.current = false;
    runQueued();
  };
  /* ── The layers above a match's screens, top to bottom: the logo, the
     stage's title card, the line-up / cup bracket. ── */
  const [listOpen, setListOpen] = useState(true);
  const [listOn, setListOn] = useState(false);
  const listOpenRef = useRef(true);
  // homologation, before any game: its opener (0), the scores (1), the leaderboard (2)
  const [homolOpen, setHomolOpen] = useState(false);
  const homolOpenRef = useRef(false);
  const [homolStep, setHomolStep] = useState<0 | 1 | 2>(0);
  const homolStepRef = useRef<0 | 1 | 2>(0);
  const [homolOn, setHomolOn] = useState(false);
  const homolRef = useRef<HTMLDivElement>(null);
  const [introOpen, setIntroOpen] = useState(true);
  const [introOn, setIntroOn] = useState(false);
  const introOpenRef = useRef(true);
  const [introGame, setIntroGame] = useState<GameKind>("polygame");
  const introRef = useRef<HTMLDivElement>(null);
  // the champion ceremony, above the bracket
  const [champOpen, setChampOpen] = useState(false);
  const champOpenRef = useRef(false);
  const champRef = useRef<HTMLDivElement>(null);
  const [champTake, setChampTake] = useState(0);
  const [logoOpen, setLogoOpen] = useState(true);
  const logoOpenRef = useRef(true);
  const logoRef = useRef<HTMLDivElement>(null);
  const [logoTake, setLogoTake] = useState(0);
  // Tab: the full league leaderboard over any screen
  const [boardOpen, setBoardOpen] = useState(false);
  const [boardOn, setBoardOn] = useState(false);
  const boardOpenRef = useRef(false);
  const toggleBoard = (open: boolean) => {
    if (open === boardOpenRef.current) return;
    boardOpenRef.current = open;
    if (open) {
      setBoardOpen(true);
      setTimeout(() => {
        setBoardOn(true);
      }, 120);
    } else {
      setBoardOn(false);
      setTimeout(() => setBoardOpen(false), 380);
    }
  };
  const stageRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<HTMLDivElement>(null);
  const [zoomLabel, setZoomLabel] = useState("");

  const toStage = (el: HTMLElement): Rect => {
    const s = stageRef.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const k = s.width / STAGE_W;
    return { x: (r.left - s.left) / k, y: (r.top - s.top) / k, w: r.width / k, h: r.height / k };
  };
  const placeZoom = (r: Rect, opacity: number) => {
    const z = zoomRef.current;
    if (!z) return;
    z.style.display = "block";
    z.style.left = `${r.x}px`;
    z.style.top = `${r.y}px`;
    z.style.width = `${r.w}px`;
    z.style.height = `${r.h}px`;
    z.style.opacity = String(opacity);
  };
  const hideZoom = () => {
    if (zoomRef.current) zoomRef.current.style.display = "none";
  };
  const placeList = (opacity: number, scale: number, origin: Rect, el: HTMLElement | null = listRef.current) => {
    const l = el;
    if (!l) return;
    l.style.opacity = String(opacity);
    l.style.transformOrigin = `${origin.x + origin.w / 2}px ${origin.y + origin.h / 2}px`;
    l.style.transform = `scale(${scale})`;
  };
  /** Put the four match screens back to "Polygame showing, nothing else drawn". */
  const resetFlow = (game: GameKind = stateRef.current.game) => {
    layerRefs.current.forEach((l) => l && (l.style.clipPath = ""));
    // games without Phase Stats keep that (empty) layer out of the way of the mouse
    const stats = layerRefs.current[1];
    if (stats && !SEQ[game].includes(1)) stats.style.clipPath = `inset(0 0 0 ${STAGE_W}px)`;
    setDrawn(VIEWS.map((_, i) => i === 0));
    viewRef.current = 0;
    setViewIdx(0);
  };

  const openMatch = async (id: string, card: HTMLElement) => {
    if (busy.current || !listOpenRef.current || introOpenRef.current || logoOpenRef.current) return;
    if (!canOpen(stateRef.current, stateRef.current.matches.find((x) => x.id === id))) return;
    busy.current = true;
    const from = toStage(card);
    const m = stateRef.current.matches.find((x) => x.id === id);
    const g = m?.cup ? cupGame(m.cup) : stateRef.current.game;
    setZoomLabel(m ? `${m.games[g].teams[0].name}  VS  ${m.games[g].teams[1].name}` : "");
    dispatch({ type: "openMatch", id });
    resetFlow(g);
    const game = layerRefs.current[0];
    await tween(ZOOM_MS, (p) => {
      const q = easeInOut(p);
      placeZoom({ x: lerp(from.x, 0, q), y: lerp(from.y, 0, q), w: lerp(from.w, STAGE_W, q), h: lerp(from.h, STAGE_H, q) }, 1);
      placeList(1 - q, 1 + 0.25 * q, from);
      if (game) game.style.transform = `scale(${1.08 - 0.08 * q})`;
    });
    listOpenRef.current = false;
    setListOpen(false);
    setListOn(false);
    if (game) game.style.transform = "";
    await tween(260, (p) => placeZoom(FULL, 1 - p));
    hideZoom();
    busy.current = false;
  };

  const backToList = async () => {
    if (busy.current || listOpenRef.current) return;
    busy.current = true;
    const cur = stateRef.current.current;
    const card = cur ? listRef.current?.querySelector<HTMLElement>(`[data-match="${cur}"]`) : null;
    const to: Rect = card ? toStage(card) : { x: STAGE_W / 2 - 240, y: STAGE_H / 2 - 90, w: 480, h: 180 };
    const m = stateRef.current.matches.find((x) => x.id === cur);
    setZoomLabel(m ? `${m.games[stateRef.current.game].teams[0].name}  VS  ${m.games[stateRef.current.game].teams[1].name}` : "");
    // cover the current screen, then shrink back into the card
    await tween(200, (p) => placeZoom(FULL, p));
    resetFlow();
    listOpenRef.current = true;
    setListOpen(true);
    setListOn(true);
    await tween(ZOOM_MS, (p) => {
      const q = easeInOut(p);
      placeZoom({ x: lerp(0, to.x, q), y: lerp(0, to.y, q), w: lerp(STAGE_W, to.w, q), h: lerp(STAGE_H, to.h, q) }, 1);
      placeList(q, 1.25 - 0.25 * q, to);
    });
    placeList(1, 1, to);
    await tween(220, (p) => placeZoom(to, 1 - p));
    hideZoom();
    if (stateRef.current.mode === "cup" && stateRef.current.game !== "game3") dispatch({ type: "selectGame", game: "game3" });
    busy.current = false;
  };
  // A press during a transition is remembered and played right after it
  const queued = useRef<"next" | "prev" | null>(null);
  const runQueued = () => {
    const q = queued.current;
    queued.current = null;
    if (q === "next") void goNext();
    else if (q === "prev") void goPrev();
  };

  /* ── Dissolves between the logo, the title card and the line-up ── */
  const setLayer = (el: HTMLElement | null, opacity: number, scale: number, blur: number) => {
    if (!el) return;
    el.style.opacity = String(opacity);
    el.style.transform = scale === 1 ? "" : `scale(${scale})`;
    el.style.filter = blur > 0.1 ? `blur(${blur}px)` : "";
  };
  /** Switch the game being played (the line-up under the title card follows). */
  const selectStage = (g: GameKind) => {
    if (g === stateRef.current.game) return;
    dispatch({ type: "selectMode", mode: stageMode(g) });
    dispatch({ type: "selectGame", game: g });
  };

  /* Each of these runs in sequence, never as a cross-fade: one screen clears
     away completely, then the next one builds itself. */

  /** Logo → a stage's opener: the logo swells and dissolves, then the title builds. */
  const logoToIntro = async (g: GameKind) => {
    if (busy.current || !logoOpenRef.current) return;
    busy.current = true;
    setIntroGame(g);
    selectStage(g);
    setIntroOn(false);
    setListOn(false);
    introOpenRef.current = true;
    setIntroOpen(true);
    await tween(560, (p) => {
      const q = easeInOut(p);
      setLayer(logoRef.current, 1 - q, 1 + 0.1 * q, 16 * q);
    });
    logoOpenRef.current = false;
    setLogoOpen(false);
    setLayer(logoRef.current, 1, 1, 0);
    setIntroOn(true);
    await wait(500);
    busy.current = false;
  };

  /** Opener → line-up / bracket: the title clears away, then the line-up draws itself in. */
  const introToList = async () => {
    if (busy.current || logoOpenRef.current || !introOpenRef.current) return;
    busy.current = true;
    setIntroOn(false);
    await wait(340);
    setListOn(true);
    await tween(420, (p) => setLayer(introRef.current, 1 - easeInOut(p), 1, 0));
    introOpenRef.current = false;
    setIntroOpen(false);
    setLayer(introRef.current, 1, 1, 0);
    busy.current = false;
  };

  /** Line-up → a stage's opener (the next game, or back to this one's). */
  const listToIntro = async (g: GameKind) => {
    if (busy.current || logoOpenRef.current || introOpenRef.current || !listOpenRef.current) return;
    busy.current = true;
    setListOn(false); // the line-up un-draws first
    await wait(480);
    setIntroGame(g);
    selectStage(g);
    setIntroOn(false);
    setLayer(introRef.current, 0, 1, 0);
    introOpenRef.current = true;
    setIntroOpen(true);
    await tween(300, (p) => setLayer(introRef.current, p, 1, 0));
    setLayer(introRef.current, 1, 1, 0);
    setIntroOn(true);
    await wait(500);
    busy.current = false;
  };

  /** Opener → another stage's opener (a jump from the remote). */
  const swapIntro = async (g: GameKind) => {
    if (busy.current || !introOpenRef.current || logoOpenRef.current) return;
    busy.current = true;
    setIntroOn(false);
    await wait(360);
    setIntroGame(g);
    selectStage(g);
    setIntroOn(true);
    await wait(500);
    busy.current = false;
  };

  /** Logo → the homologation opener: the logo swells and dissolves, then the title builds. */
  const logoToHomol = async () => {
    if (busy.current || !logoOpenRef.current) return;
    busy.current = true;
    homolStepRef.current = 0;
    setHomolStep(0);
    setHomolOn(false);
    homolOpenRef.current = true;
    setHomolOpen(true);
    await tween(560, (p) => {
      const q = easeInOut(p);
      setLayer(logoRef.current, 1 - q, 1 + 0.1 * q, 16 * q);
    });
    logoOpenRef.current = false;
    setLogoOpen(false);
    setLayer(logoRef.current, 1, 1, 0);
    setHomolOn(true);
    await wait(500);
    busy.current = false;
  };

  /** Within homologation: the current screen clears away, then the next builds. */
  const homolGo = async (step: 0 | 1 | 2) => {
    if (busy.current || !homolOpenRef.current) return;
    busy.current = true;
    setHomolOn(false);
    await wait(460);
    homolStepRef.current = step;
    setHomolStep(step);
    await wait(30);
    setHomolOn(true);
    await wait(500);
    busy.current = false;
  };

  /** Homologation done → the first game's title card. */
  const homolToIntro = async () => {
    if (busy.current || !homolOpenRef.current) return;
    busy.current = true;
    setHomolOn(false);
    await wait(460);
    const g = stateRef.current.game;
    setIntroGame(g);
    setIntroOn(false);
    introOpenRef.current = true;
    setIntroOpen(true);
    await tween(300, (p) => setLayer(homolRef.current, 1 - p, 1, 0));
    homolOpenRef.current = false;
    setHomolOpen(false);
    setLayer(homolRef.current, 1, 1, 0);
    setIntroOn(true);
    await wait(500);
    busy.current = false;
  };

  /** Anywhere → the logo: the screen fades to dark, then the logo builds again. */
  const toLogo = async () => {
    if (busy.current || logoOpenRef.current) return;
    busy.current = true;
    if (boardOpenRef.current) toggleBoard(false);
    setLayer(logoRef.current, 0, 1, 0);
    setLogoTake((n) => n + 1); // a fresh logo, so its build-in plays again
    logoOpenRef.current = true;
    setLogoOpen(true);
    await tween(480, (p) => setLayer(logoRef.current, easeInOut(p), 1, 0));
    setLayer(logoRef.current, 1, 1, 0);
    if (!listOpenRef.current) {
      resetFlow();
      // opening a match faded the line-up out and zoomed it: put it back, or it would
      // count as open while the match underneath shows through
      setLayer(listRef.current, 1, 1, 0);
      if (listRef.current) listRef.current.style.transformOrigin = "";
      hideZoom();
      listOpenRef.current = true;
      setListOpen(true);
    }
    setListOn(false);
    introOpenRef.current = true;
    setIntroOpen(true);
    setIntroOn(false);
    champOpenRef.current = false;
    setChampOpen(false);
    homolOpenRef.current = false;
    setHomolOpen(false);
    setHomolOn(false);
    busy.current = false;
  };

  /** Bracket → the champion ceremony. */
  const crown = async () => {
    if (busy.current || champOpenRef.current || !listOpenRef.current) return;
    busy.current = true;
    setListOn(false); // the bracket clears away first
    await wait(420);
    setChampTake((n) => n + 1);
    champOpenRef.current = true;
    setChampOpen(true);
    setLayer(champRef.current, 0, 1, 0);
    await tween(500, (p) => setLayer(champRef.current, easeInOut(p), 1, 0));
    setLayer(champRef.current, 1, 1, 0);
    busy.current = false;
  };

  /** Ceremony → back to the bracket. */
  const uncrown = async () => {
    if (busy.current || !champOpenRef.current) return;
    busy.current = true;
    await tween(420, (p) => setLayer(champRef.current, 1 - easeInOut(p), 1, 0));
    champOpenRef.current = false;
    setChampOpen(false);
    setLayer(champRef.current, 1, 1, 0);
    setListOn(true);
    busy.current = false;
  };

  /** Zoom into a match card of the line-up / bracket. */
  const openMatchById = (id: string) => {
    const card = listRef.current?.querySelector<HTMLElement>(`[data-match="${id}"]`);
    if (card) void openMatch(id, card);
  };

  /** What's on screen right now (from refs, so it's current inside callbacks). */
  const viewNow = (): View =>
    logoOpenRef.current
      ? "logo"
      : homolOpenRef.current
        ? "homologation"
        : champOpenRef.current
        ? "champion"
        : introOpenRef.current
        ? "intro"
        : listOpenRef.current
          ? stateRef.current.mode === "cup"
            ? "bracket"
            : "matches"
          : VIEWS[viewRef.current];

  /** The show's Next (lib/flow.ts decides what that is from here). */
  const doNext = () => {
    if (boardOpenRef.current) return;
    const v = viewNow();
    if (v === "game" || v === "stats" || v === "final" || v === "board") {
      if (busy.current) queued.current = "next";
      else void goNext();
      return;
    }
    if (busy.current) return;
    const step = nextStep(stateRef.current, v, homolStepRef.current);
    if (step.kind === "homol") void logoToHomol();
    else if (step.kind === "homolNext") void homolGo((homolStepRef.current + 1) as 1 | 2);
    else if (step.kind === "homolEnd") void homolToIntro();
    else if (step.kind === "intro") void logoToIntro(stateRef.current.game);
    else if (step.kind === "list") void introToList();
    else if (step.kind === "open") openMatchById(step.id);
    else if (step.kind === "stage") void listToIntro(step.game);
    else if (step.kind === "logo") void toLogo();
    else if (step.kind === "crown") void crown();
  };

  const doPrev = () => {
    if (boardOpenRef.current) return;
    const v = viewNow();
    if (v === "game" || v === "stats" || v === "final" || v === "board") {
      if (busy.current) queued.current = "prev";
      else void goPrev();
      return;
    }
    if (v === "intro") void toLogo();
    else if (v === "homologation") {
      if (homolStepRef.current > 0) void homolGo((homolStepRef.current - 1) as 0 | 1);
      else void toLogo();
    } else if (v === "champion") void uncrown();
    else if (v === "matches" || v === "bracket") void listToIntro(stateRef.current.game);
  };

  /** Remote jump to a stage's title card (only between matches). */
  const jumpStage = (g: GameKind | "homologation") => {
    const v = viewNow();
    if (g === "homologation") {
      if (v === "logo") void logoToHomol();
      return;
    }
    if (v === "logo") void logoToIntro(g);
    else if (v === "intro") void swapIntro(g);
    else if (v === "matches" || v === "bracket") void listToIntro(g);
  };

  const listNav = useRef({ openMatch, backToList, toggleBoard, doNext, doPrev, toLogo, jumpStage, openMatchById, viewNow });
  useEffect(() => {
    listNav.current = { openMatch, backToList, toggleBoard, doNext, doPrev, toLogo, jumpStage, openMatchById, viewNow };
  });


  // Restore saved state (survives a page refresh mid-match). The ref makes it
  // run once even when dev StrictMode re-runs effects.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const saved = raw ? (JSON.parse(raw) as GameState) : null;
      if (saved?.teams?.length === 2) dispatch({ type: "load", state: saved }); // "load" fills in anything older saves lack
    } catch {}
  }, []);

  useEffect(() => {
    if (!restored.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  // Fit the 1920x1080 stage to the window
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const now = Date.now();

      // Tab: league leaderboard over any screen (Tab / Esc closes)
      if (e.key === "Tab") {
        e.preventDefault();
        listNav.current.toggleBoard(!boardOpenRef.current);
        return;
      }
      if (boardOpenRef.current) {
        if (e.key === "Escape") listNav.current.toggleBoard(false);
        return; // nothing else reacts while the leaderboard is up
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        listNav.current.doNext();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        listNav.current.doPrev();
        return;
      }
      if (e.key === "Home") {
        e.preventDefault();
        void listNav.current.toLogo();
        return;
      }
      // Z: from a match, straight back to the line-up
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (!listOpenRef.current) void listNav.current.backToList();
        return;
      }
      // the cup bracket handles its own key (D)
      if (listOpenRef.current || introOpenRef.current || logoOpenRef.current) return;
      // Game controls only work on the Polygame screen
      if (viewRef.current !== 0) return;

      if (e.code === "Space") {
        e.preventDefault();
        // Don't let Space also "click" a focused grid square / shape
        (document.activeElement as HTMLElement | null)?.blur();
        dispatch({ type: "startBoth", now });
        return;
      }
      const letter = e.key.toLowerCase();
      // Polygame: R pins / unpins team 1, U team 2
      if (stateRef.current.game === "polygame" && (letter === "r" || letter === "u")) {
        e.preventDefault();
        const team = letter === "r" ? 0 : 1;
        dispatch({ type: "togglePin", team });
        return;
      }
      if (stateRef.current.game === "garden") {
        // Shift + 1–9: starting chances for every Garden match
        const digit = /^(Digit|Numpad)([1-9])$/.exec(e.code)?.[2];
        if (digit && e.shiftKey) {
          e.preventDefault();
          dispatch({ type: "setGardenChances", n: +digit });
          return;
        }
        // E / D: team 1 uses / gets back a chance · I / J: team 2
        const ch = ({ e: [0, -1], d: [0, 1], i: [1, -1], j: [1, 1] } as Record<string, [0 | 1, number]>)[letter];
        if (ch) {
          e.preventDefault();
          const [team, delta] = ch;
          dispatch({ type: "useChance", team, delta });
          return;
        }
      }
      // Shift+X twice within 2s resets both boards, timers and points
      if (letter === "x" && e.shiftKey) {
        if (now - resetArm.current < 2000) {
          dispatch({ type: "resetAll" });
          resetArm.current = 0;
        } else {
          resetArm.current = now;
        }
        return;
      }
      const k = KEYS[letter as keyof typeof KEYS];
      if (!k) return;
      e.preventDefault();
      if (k.type === "points") {
        dispatch({ type: "addPoints", team: k.team, delta: k.delta * (e.shiftKey ? 5 : 1) });
      } else if (k.type === "stopTimer") {
        dispatch({ type: "stopTimer", team: k.team, now });
      } else {
        dispatch({ type: "resetTimer", team: k.team });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── Remote controller ──
     The key arrives once in the URL (?key=…) and is remembered on this device. */
  const [remoteKey, setRemoteKey] = useState<string | null>(null);
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("key");
    if (fromUrl) {
      saveKey(fromUrl);
      // keep the key out of the address bar
      window.history.replaceState(null, "", window.location.pathname);
    }
    const t = setTimeout(() => setRemoteKey(fromUrl ?? readKey()), 0);
    return () => clearTimeout(t);
  }, []);

  const screenView: View = logoOpen
    ? "logo"
    : homolOpen
      ? "homologation"
      : champOpen
      ? "champion"
      : introOpen
      ? "intro"
      : listOpen
        ? state.mode === "cup"
          ? "bracket"
          : "matches"
        : VIEWS[viewIdx];
  const screen: Screen = { view: screenView, overlay: boardOpen, homol: homolStep };
  const [pulse, setPulse] = useState(0);
  const [toast, setToast] = useState<{ key: number; text: string } | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3700);
    return () => clearTimeout(t);
  }, [toast]);

  const onCommand = (c: Command) => {
    const L = listNav.current;
    switch (c.type) {
      case "hello":
        setPulse((n) => n + 1);
        return;
      case "action": {
        // timers run on this screen's clock
        const a = c.action;
        const now = Date.now();
        const timed: Action =
          a.type === "startBoth" || a.type === "stopTimer" || a.type === "toggleTimer" || a.type === "endPhase" || a.type === "playCard" || a.type === "playGreen" ? { ...a, now } : a;
        dispatch(timed);
        // stats corrected during the match: say so on screen
        if (a.type === "setStats" && L.viewNow() === "game") {
          const phases = [1, 2, 3].filter((n) => Object.keys(a.stats).some((k) => k.endsWith(String(n)) && /^(time|pos|acc)\d$/.test(k)));
          const text =
            stateRef.current.game === "polygame" && phases.length
              ? `Phase ${phases.join(" & ")} · scores updated`
              : "Scores updated";
          setToast((cur) => ({ key: cur && Date.now() - cur.key < 400 ? cur.key : Date.now(), text }));
        }
        return;
      }
      case "next":
      case "prev":
        // meant for what the remote saw on screen: if this screen shows something else (another
        // screen on the same key, or a tap repeated while a transition runs), it isn't for this one
        if (c.from && (busy.current || c.from !== L.viewNow() || (c.from === "homologation" && c.homol !== homolStepRef.current))) return;
        return c.type === "next" ? L.doNext() : L.doPrev();
      case "home":
        return void L.toLogo();
      case "stage":
        return L.jumpStage(c.game);
      case "overlay":
        return L.toggleBoard(c.open);
      case "openMatch": {
        const v = L.viewNow();
        if (v === "matches" || v === "bracket") L.openMatchById(c.id);
        return;
      }
      case "cupReset":
        screenBus?.dispatchEvent(new Event(c.type));
        return;
    }
  };
  const { send } = useLink<Command>(remoteKey, "screen", (c) => onCommand(c));
  // tells this page apart from any other screen open on the same key
  const [screenId] = useState(() => Math.random().toString(36).slice(2, 10));

  // Tell the controllers what's on screen: after every change (once things
  // settle for 100 ms), when one says hello, and every few seconds as a heartbeat.
  useEffect(() => {
    const t = setTimeout(() => send({ state: compact(state), screen, sentAt: Date.now(), screenId }), 100);
    return () => clearTimeout(t);
  }, [state, screenView, boardOpen, pulse, homolStep]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const iv = setInterval(() => setPulse((n) => n + 1), 4000);
    return () => clearInterval(iv);
  }, []);

  const cupRound = state.current ? state.matches.find((m) => m.id === state.current)?.cup : undefined;

  // the cup's champion, for the ceremony
  const fin = cupMatch(state, "final");
  const winner = cupWinner(fin);
  const crownData: Crown | null =
    fin && winner !== null
      ? {
          name: cupSlot(fin).teams[winner].name,
          id: cupSlot(fin).teams[winner].leagueId ?? "",
          corner: winner,
          score: gameScore(cupGame("final"), cupSlot(fin).teams[winner]),
          runnerUp: cupSlot(fin).teams[winner ? 0 : 1].name,
          runnerScore: gameScore(cupGame("final"), cupSlot(fin).teams[winner ? 0 : 1]),
        }
      : null;

  // scores carried into this game, and the cumulative totals for Game Stats
  const openM = state.current ? state.matches.find((m) => m.id === state.current) : undefined;
  // Game Stats: this game's score only (the leaderboard keeps the running total)
  const totals: [number, number] = [gameScore(state.game, state.teams[0]), gameScore(state.game, state.teams[1])];
  const carry: [number, number] = openM ? [slotCarry(openM, state.game, 0), slotCarry(openM, state.game, 1)] : [0, 0];

  return (
    // overflow-clip (not hidden) so focusing a control can never scroll the stage
    <main
      onContextMenu={(e) => e.preventDefault()} // right click is a game control, never the browser menu
      className="fixed inset-0 flex cursor-none items-center justify-center overflow-clip bg-[var(--bg)] [&_*]:cursor-none">
      <div className="relative shrink-0 overflow-clip" style={{ width: STAGE_W * scale, height: STAGE_H * scale }}>
      <div
        ref={stageRef}
        className="absolute left-0 top-0 overflow-clip"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      >
        <StrokeDefs />
        <Backdrop />

        {/* Bottom of the stack: Leaderboard */}
        <div ref={(el) => void (layerRefs.current[3] = el)} inert={view !== "board"} className="absolute inset-0 z-[5]">
          <LeaderboardScreen on={drawn[3]} active={!listOpen && view === "board"} state={state} dispatch={dispatch} />
        </div>

        {/* Game Stats */}
        <div ref={(el) => void (layerRefs.current[2] = el)} inert={view !== "final"} className="absolute inset-0 z-10">
          <FinalScreen on={drawn[2]} teams={state.teams} totals={totals} title={GAME_INFO[state.game].title} />
        </div>

        {/* Phase Stats */}
        <div ref={(el) => void (layerRefs.current[1] = el)} inert={view !== "stats"} className="absolute inset-0 z-20">
          <StatsScreen on={drawn[1]} game={state.game} teams={state.teams} />
        </div>

        {/* Top: Polygame screen (opaque), clipped away by the scan bar on → */}
        <div ref={(el) => void (layerRefs.current[0] = el)} inert={view !== "game"} className="absolute inset-0 z-30 bg-[var(--bg)]">
        <Backdrop />
        <div className="relative flex h-full flex-col gap-4 px-8 pb-6 pt-6">
          {/* Header: logo | POLYGAME | game number */}
          <header className="relative flex h-[96px] w-full shrink-0 items-center px-4">
            <div className="w-[360px]">
              <Image src={logo} alt="TRSYP 3.0" priority className="h-[46px] w-auto object-cover" style={{ aspectRatio: "2000 / 330" }} />
            </div>
            <h1 className="title flex-1 text-center leading-none text-white" style={{ fontSize: cupRound ? 50 : 60, textShadow: "0 0 40px rgba(0,232,122,0.35)" }}>
              {cupRound ? `${CUP_LABEL[cupRound]} · ${GAME_INFO[state.game].title}` : GAME_INFO[state.game].title}
            </h1>
            <div className="w-[360px]" />
            {/* the navbar's edge: green into pink, fading at both ends */}
            <span
              className="absolute bottom-0 left-0 right-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, rgba(0,232,122,0.4) 20%, rgba(255,255,255,0.12) 50%, rgba(255,29,120,0.4) 80%, transparent)" }}
              aria-hidden
            />
          </header>

          {/* Two teams, split down the middle */}
          <div className="relative grid min-h-0 flex-1 grid-cols-2 gap-16">
            <TeamPanel
              id={0}
              team={state.teams[0]}
              opponent={state.teams[1]}
              dispatch={dispatch}
              active={!listOpen && view === "game"}
              variant={state.game === "garden" ? "garden" : state.game === "game3" ? "mine" : "polygame"}
              carried={carry[0]}
            />
            <div
              className="absolute bottom-2 left-1/2 top-2 w-px -translate-x-1/2"
              style={{ background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.1) 15%, rgba(255,255,255,0.1) 85%, transparent)" }}
              aria-hidden
            >
              {/* level with the middle of the cameras */}
              <span className="vs-disc absolute left-1/2 top-[226px] w-[60px] -translate-x-1/2 text-[16px]">VS</span>
            </div>
            <TeamPanel
              id={1}
              team={state.teams[1]}
              opponent={state.teams[0]}
              dispatch={dispatch}
              active={!listOpen && view === "game"}
              variant={state.game === "garden" ? "garden" : state.game === "game3" ? "mine" : "polygame"}
              carried={carry[1]}
            />
          </div>
        </div>
        {/* a card or green triangle about to take effect: its countdown, big */}
        <EffectCountdown state={state} />
        </div>

        {/* Screen 0: match list (opaque, on top while open) */}
        <div
          ref={listRef}
          inert={!listOpen}
          // closed: invisible and click-through, so the match screens underneath get the mouse
          className={`absolute inset-0 z-[35] bg-[var(--bg)] ${listOpen ? "" : "pointer-events-none invisible"}`}
        >
          <Backdrop />
          {state.mode === "cup" ? (
            <BracketScreen
              on={listOn}
              active={listOpen && !introOpen && !logoOpen && !boardOpen}
              state={state}
              dispatch={dispatch}
              onOpen={(id, el) => void listNav.current.openMatch(id, el)}
            />
          ) : (
            <MatchesScreen
              on={listOn}
              state={state}
              onOpen={(id, el) => void listNav.current.openMatch(id, el)}
            />
          )}
        </div>

        {/* Homologation, before any game (opaque, above the title card while open) */}
        <div
          ref={homolRef}
          inert={!homolOpen}
          className={`absolute inset-0 z-[37] bg-[var(--bg)] ${homolOpen ? "" : "pointer-events-none invisible"}`}
        >
          <Backdrop />
          {homolOpen && homolStep === 0 && <StageScreen on={homolOn} game="homologation" />}
          {homolOpen && homolStep === 1 && <HomologationScreen on={homolOn} state={state} />}
          {homolOpen && homolStep === 2 && (
            <LeaderboardScreen on={homolOn} active={false} readOnly state={state} dispatch={dispatch} badges={state.homolApplied} />
          )}
        </div>

        {/* The stage's title card (opaque, above the line-up while open) */}
        <div
          ref={introRef}
          inert={!introOpen}
          className={`absolute inset-0 z-[36] bg-[var(--bg)] ${introOpen ? "" : "pointer-events-none invisible"}`}
        >
          <Backdrop />
          <StageScreen on={introOn} game={introGame} />
        </div>

        {/* The champion ceremony (opaque, above the bracket while open) */}
        <div
          ref={champRef}
          inert={!champOpen}
          className={`absolute inset-0 z-[37] bg-[var(--bg)] ${champOpen ? "" : "pointer-events-none invisible"}`}
        >
          {champOpen && crownData && <ChampionScreen crown={crownData} take={champTake} />}
        </div>

        {/* Home: the logo (opaque, top of the stack while open) */}
        <div
          ref={logoRef}
          inert={!logoOpen}
          className={`absolute inset-0 z-[39] bg-[var(--bg)] ${logoOpen ? "" : "pointer-events-none invisible"}`}
        >
          <Backdrop />
          <LogoScreen key={logoTake} />
        </div>

        {/* Tab: the league leaderboard over everything (read-only, never adds points) */}
        {boardOpen && (
          <div
            className="absolute inset-0 z-[45] bg-[var(--bg)] transition-[opacity,transform] duration-300 ease-out"
            style={{ opacity: boardOn ? 1 : 0, transform: boardOn ? "scale(1)" : "scale(1.04)" }}
          >
            <Backdrop />
            <LeaderboardScreen on={boardOn} active={false} readOnly state={state} dispatch={dispatch} />
          </div>
        )}

        {/* the card that grows into a full screen (and shrinks back) */}
        <div
          ref={zoomRef}
          aria-hidden
          className="pointer-events-none absolute z-[38] hidden overflow-hidden rounded-[20px] border border-[rgba(0,232,122,0.45)] bg-[var(--surface-solid)] shadow-[0_0_60px_rgba(0,232,122,0.25)]"
        >
          <div className="flex h-full w-full items-center justify-center">
            <span className="title whitespace-pre text-[42px] text-white">
              {zoomLabel}
            </span>
          </div>
        </div>

        {/* a stats update during the match */}
        {toast && view === "game" && !listOpen && (
          <div
            key={toast.key}
            className="stats-toast btn-rim title pointer-events-none absolute left-1/2 top-[130px] z-[32] whitespace-nowrap px-8 py-3 text-[22px] tracking-[0.12em] text-white"
          >
            {toast.text}
          </div>
        )}

        <ScanBar ref={barRef} />

      </div>
      </div>
      <div aria-hidden className="stage-light pointer-events-none z-[1]" style={{ mixBlendMode: "screen" }} />
    </main>
  );
}
