"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { initialState, reducer, type GameState } from "@/lib/game";
import HudFrame from "./HudFrame";
import ParticleField from "./ParticleField";
import TeamPanel from "./TeamPanel";

const STAGE_W = 1920;
const STAGE_H = 1080;
const STORAGE_KEY = "trsyp3-polygame-v1";

/* Keyboard map (by physical key, so layout/caps lock don't matter).
   Shift + points key = ±5. */
const KEYS = {
  KeyQ: { type: "toggleTimer", team: 0 },
  KeyA: { type: "resetTimer", team: 0 },
  KeyW: { type: "points", team: 0, delta: 1 },
  KeyS: { type: "points", team: 0, delta: -1 },
  KeyP: { type: "toggleTimer", team: 1 },
  KeyL: { type: "resetTimer", team: 1 },
  KeyO: { type: "points", team: 1, delta: 1 },
  KeyK: { type: "points", team: 1, delta: -1 },
} as const;

export default function PolygameScreen() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [scale, setScale] = useState(1);
  const [help, setHelp] = useState(false);
  const resetArm = useRef(0);

  // Restore saved state (survives a page refresh mid-match). The ref makes it
  // run once even when dev StrictMode re-runs effects.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "load", state: JSON.parse(raw) as GameState });
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

      if (e.code === "Space") {
        e.preventDefault();
        // Don't let Space also "click" a focused grid square / shape
        (document.activeElement as HTMLElement | null)?.blur();
        dispatch({ type: "toggleBoth", now });
        return;
      }
      if (e.code === "KeyH") {
        setHelp((h) => !h);
        return;
      }
      // Shift+X twice within 2s resets both boards, timers and points
      if (e.code === "KeyX" && e.shiftKey) {
        if (now - resetArm.current < 2000) {
          dispatch({ type: "resetAll" });
          resetArm.current = 0;
        } else {
          resetArm.current = now;
        }
        return;
      }
      const k = KEYS[e.code as keyof typeof KEYS];
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
    <main className="fixed inset-0 flex items-center justify-center overflow-clip bg-[var(--bg)]">
      <div className="relative shrink-0 overflow-clip" style={{ width: STAGE_W * scale, height: STAGE_H * scale }}>
      <div
        className="absolute left-0 top-0 overflow-clip"
        style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: "0 0" }}
      >
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
            <TeamPanel id={0} team={state.teams[0]} dispatch={dispatch} />
            <div
              className="absolute bottom-2 left-1/2 top-2 w-px -translate-x-1/2 bg-[var(--neon-dim)]"
              aria-hidden
            >
              <span className="absolute left-1/2 top-1/2 h-24 w-[3px] -translate-x-1/2 -translate-y-1/2 bg-[var(--pink)] shadow-[0_0_10px_var(--pink)]" />
            </div>
            <TeamPanel id={1} team={state.teams[1]} dispatch={dispatch} />
          </div>
        </div>

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
            <li><Kbd>Shift</Kbd>+<Kbd>X</Kbd> twice — reset everything</li>
            <li>Click a shape: Grey / Remove / Restore · Click a grid square: white → red → blue</li>
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
