"use client";

import { useEffect, useState } from "react";

/* Timed effects (Mine glitch cards, Polygame green triangles). Each one is
   stamped with the screen's clock when it's played, counts down on screen
   for COUNTDOWN_MS, then runs for its own seconds, then is used up. */

export const COUNTDOWN_MS = 5000;

export type Phase =
  | { kind: "ready" } // not played
  | { kind: "arming"; left: number } // the countdown before it takes effect
  | { kind: "live"; left: number } // in effect
  | { kind: "used" };

/** Where an effect played at `at` stands at `now` (`left` in ms). One played a moment
    ago can be ahead of a `now` that isn't ticking yet: it counts as just played. */
export const phaseOf = (at: number | undefined, secs: number, now: number): Phase => {
  if (at === undefined) return { kind: "ready" };
  const t = Math.max(0, now - at);
  if (t < COUNTDOWN_MS) return { kind: "arming", left: COUNTDOWN_MS - t };
  const left = secs * 1000 - (t - COUNTDOWN_MS);
  return left > 0 ? { kind: "live", left } : { kind: "used" };
};

/** The clock for timed effects ([played at, seconds] each): ticks every frame while one
    is counting down or running, else holds still. */
export function useEffectClock(effects: readonly (readonly [number | undefined, number])[]) {
  const [now, setNow] = useState(() => Date.now());
  const ticking = effects.some(([at, secs]) => {
    const k = phaseOf(at, secs, now).kind;
    return k === "arming" || k === "live";
  });
  useEffect(() => {
    if (!ticking) return;
    let raf = 0;
    const tick = () => {
      setNow(Date.now());
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ticking]);
  return now;
}
