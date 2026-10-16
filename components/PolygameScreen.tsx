"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { initialState, reducer, type GameState } from "@/lib/game";
import HudFrame from "./HudFrame";
import ParticleField from "./ParticleField";
import ScanBar, { SCAN_W } from "./ScanBar";
import FinalScreen from "./FinalScreen";
import LeaderboardScreen from "./LeaderboardScreen";
import StatsScreen from "./StatsScreen";
import TeamPanel from "./TeamPanel";

const STAGE_W = 1920;
const STAGE_H = 1080;
const STORAGE_KEY = "trsyp3-polygame-v3";

/* Keyboard map by the letter printed on the key (works on AZERTY and QWERTY;
   caps lock / Shift don't matter). Shift + points key = ±5. */
const KEYS = {
  q: { type: "toggleTimer", team: 0 },
  a: { type: "resetTimer", team: 0 },
  w: { type: "points", team: 0, delta: 1 },
  s: { type: "points", team: 0, delta: -1 },
  p: { type: "toggleTimer", team: 1 },
  l: { type: "resetTimer", team: 1 },
  o: { type: "points", team: 1, delta: 1 },
  k: { type: "points", team: 1, delta: -1 },
} as const;

const VIEWS = ["game", "stats", "final", "board"] as const;

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

export default function PolygameScreen() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [scale, setScale] = useState(1);
  const [help, setHelp] = useState(false);
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
    if (busy.current || i >= VIEWS.length - 1) return;
    busy.current = true;
    viewRef.current = i + 1;
    setViewIdx(i + 1);
    let started = false;
    await tween(WIPE_MS, (p) => {
      placeWipe(i, easeInOut(p) * (STAGE_W + SCAN_W), true);
      // start drawing the next screen while the bar is still crossing
      if (!started && p > 0.45) {
        started = true;
        setDrawnAt(i + 1, true);
      }
    });
    setDrawnAt(i, false); // fully hidden now; reset so it draws in fresh on return
    busy.current = false;
    runQueued();
  };

  const goPrev = async () => {
    const i = viewRef.current;
    if (busy.current || i <= 0) return;
    busy.current = true;
    setDrawnAt(i, false); // the current screen un-draws first
    await wait(420);
    setDrawnAt(i - 1, true);
    // mirrored bar trails to the right of the edge, so run it past 0 to leave the screen
    await tween(WIPE_MS, (p) => placeWipe(i - 1, (1 - easeInOut(p)) * (STAGE_W + 2 * SCAN_W) - SCAN_W, false));
    viewRef.current = i - 1;
    setViewIdx(i - 1);
    busy.current = false;
    runQueued();
  };
  // A press during a transition is remembered and played right after it
  const queued = useRef<"next" | "prev" | null>(null);
  const runQueued = () => {
    const q = queued.current;
    queued.current = null;
    if (q === "next") void goNext();
    else if (q === "prev") void goPrev();
  };
  const nav = useRef({ goNext, goPrev });
  useEffect(() => {
    nav.current = { goNext, goPrev };
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

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (busy.current) queued.current = "next";
        else nav.current.goNext();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (busy.current) queued.current = "prev";
        else nav.current.goPrev();
        return;
      }
      if (e.key.toLowerCase() === "h") {
        setHelp((h) => !h);
        return;
      }
      // Game controls only work on the Polygame screen
      if (viewRef.current !== 0) return;

      if (e.code === "Space") {
        e.preventDefault();
        // Don't let Space also "click" a focused grid square / shape
        (document.activeElement as HTMLElement | null)?.blur();
        dispatch({ type: "toggleBoth", now });
        return;
      }
      const letter = e.key.toLowerCase();
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
      if (k.type === "points") dispatch({ type: "addPoints", team: k.team, delta: k.delta * (e.shiftKey ? 5 : 1) });
      else if (k.type === "toggleTimer") dispatch({ type: "toggleTimer", team: k.team, now });
      else dispatch({ type: "resetTimer", team: k.team });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    // overflow-clip (not hidden) so focusing a control can never scroll the stage
    <main
      onContextMenu={(e) => e.preventDefault()} // right click is a game control, never the browser menu
      className="fixed inset-0 flex items-center justify-center overflow-clip bg-[var(--bg)]">
      <div className="relative shrink-0 overflow-clip" style={{ width: STAGE_W * scale, height: STAGE_H * scale }}>
      <div
        className="absolute left-0 top-0 overflow-clip"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      >
        <ParticleField />

        {/* Bottom of the stack: Leaderboard */}
        <div ref={(el) => void (layerRefs.current[3] = el)} inert={view !== "board"} className="absolute inset-0 z-[5]">
          <LeaderboardScreen on={drawn[3]} active={view === "board"} state={state} dispatch={dispatch} />
        </div>

        {/* Game Stats */}
        <div ref={(el) => void (layerRefs.current[2] = el)} inert={view !== "final"} className="absolute inset-0 z-10">
          <FinalScreen on={drawn[2]} teams={state.teams} />
        </div>

        {/* Phase Stats */}
        <div ref={(el) => void (layerRefs.current[1] = el)} inert={view !== "stats"} className="absolute inset-0 z-20">
          <StatsScreen on={drawn[1]} active={view === "stats"} teams={state.teams} dispatch={dispatch} />
        </div>

        {/* Top: Polygame screen (opaque), clipped away by the scan bar on → */}
        <div ref={(el) => void (layerRefs.current[0] = el)} inert={view !== "game"} className="absolute inset-0 z-30 bg-[var(--bg)]">
        <ParticleField />
        <div className="relative flex h-full flex-col gap-4 px-8 pb-6 pt-6">
          {/* Header: game label | POLYGAME */}
          <HudFrame className="h-[96px] w-full shrink-0" cut={20} tracer traceDuration={14}>
            <div className="flex h-full items-center">
              <div className="flex h-full w-[360px] flex-col justify-center border-r border-[var(--neon-dim)] pl-10">
                <span className="text-[13px] font-semibold uppercase tracking-[0.4em] text-[var(--text-dim)]">
                  TRSYP 3.0 · Game 01
                </span>
                <span className="mt-1 text-[22px] font-semibold uppercase tracking-[0.2em] text-[var(--text)]">
                  Game name
                </span>
              </div>
              <h1 className="neon-text flex-1 text-center font-[family-name:var(--font-display)] text-[64px] uppercase leading-none tracking-[0.25em]">
                Polygame
              </h1>
              <div className="w-[360px]" />
            </div>
          </HudFrame>

          {/* Two teams, split down the middle */}
          <div className="relative grid min-h-0 flex-1 grid-cols-2 gap-16">
            <TeamPanel id={0} team={state.teams[0]} dispatch={dispatch} active={view === "game"} />
            <div
              className="absolute bottom-2 left-1/2 top-2 w-px -translate-x-1/2 bg-[var(--neon-dim)]"
              aria-hidden
            >
              <span className="absolute left-1/2 top-1/2 h-24 w-[3px] -translate-x-1/2 -translate-y-1/2 bg-[var(--pink)] shadow-[0_0_10px_var(--pink)]" />
            </div>
            <TeamPanel id={1} team={state.teams[1]} dispatch={dispatch} active={view === "game"} />
          </div>
        </div>
        </div>

        <ScanBar ref={barRef} />

        {help && <HelpOverlay onClose={() => setHelp(false)} />}
      </div>
      </div>
    </main>
  );
}

function HelpOverlay({ onClose }: { onClose: () => void }) {
  const rows: [string, string, string][] = [
    ["Start / pause timer", "Q", "P"],
    ["Reset timer", "A", "L"],
    ["Points +1  (Shift = +5)", "W", "O"],
    ["Points −1  (Shift = −5)", "S", "K"],
  ];
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <HudFrame className="w-[720px] p-10" cut={20}>
        <div className="p-10">
          <h3 className="neon-text mb-6 font-[family-name:var(--font-display)] text-3xl tracking-[0.2em]">CONTROLS</h3>
          <table className="w-full text-lg">
            <thead>
              <tr className="text-left text-sm uppercase tracking-[0.3em] text-[var(--text-dim)]">
                <th className="pb-3 font-semibold">Action</th>
                <th className="pb-3 font-semibold">Team 1</th>
                <th className="pb-3 font-semibold">Team 2</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([a, k1, k2]) => (
                <tr key={a}>
                  <td className="py-1.5">{a}</td>
                  <td><Kbd>{k1}</Kbd></td>
                  <td><Kbd>{k2}</Kbd></td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="mt-6 space-y-1.5 text-base text-[var(--text-dim)]">
            <li><Kbd>Space</Kbd> start / pause both timers</li>
            <li><Kbd>→</Kbd> next screen (Polygame → Phase Stats → Game Stats → Leaderboard) · <Kbd>←</Kbd> back</li>
            <li>Leaderboard: hover points and type · double-click a name to rename</li>
            <li>Phase Stats: hover any value and type (digits : . % -) · <Kbd>Backspace</Kbd> / <Kbd>Del</Kbd></li>
            <li><Kbd>Shift</Kbd>+<Kbd>X</Kbd> twice — new match (clears boards, timers, stats; keeps the leaderboard)</li>
            <li>Shapes: left click removes / brings back · right click greys / restores</li>
            <li>Grid: left click colours the whole square · right click colours one triangle (white → red → blue)</li>
            <li>Grid numbers: hover a square / triangle and type digits · <Kbd>Backspace</Kbd> deletes · <Kbd>Del</Kbd> clears</li>
            <li>Double-click a team name to rename · <Kbd>H</Kbd> toggles this panel</li>
          </ul>
        </div>
      </HudFrame>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="digits mx-0.5 inline-block min-w-8 border border-[var(--neon)] px-2 py-0.5 text-center text-[var(--neon)]">
      {children}
    </kbd>
  );
}
