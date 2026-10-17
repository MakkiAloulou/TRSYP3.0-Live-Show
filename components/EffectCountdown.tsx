"use client";

import Image from "next/image";
import { GLITCH_CARDS, GREEN_FREEZE_SECS, SHAPES, SHAPE_COLORS, type GameState, type TeamId } from "@/lib/game";
import { COUNTDOWN_MS, phaseOf, useEffectClock } from "./effectClock";

/* The countdown before a glitch card (Mine) or a green triangle (Polygame)
   takes effect: a band across the bottom half of the screen, under the
   cameras (which OBS covers), with what is played, by whom on whom, and a
   big 5…1 inside a draining ring. When it ends the effect starts on the
   teams' panels underneath. */

interface Pending {
  at: number;
  secs: number;
  by: TeamId;
  card?: (typeof GLITCH_CARDS)[number];
}

const R = 136;
const C = 2 * Math.PI * R;

export default function EffectCountdown({ state }: { state: GameState }) {
  const items: Pending[] = ([0, 1] as TeamId[]).flatMap((by) => {
    const t = state.teams[by];
    if (state.game === "game3")
      return GLITCH_CARDS.flatMap((card) => (t.cards?.[card.id] !== undefined ? [{ at: t.cards[card.id]!, secs: card.secs, by, card }] : []));
    if (state.game === "polygame") return Object.values(t.greens ?? {}).map((at) => ({ at, secs: GREEN_FREEZE_SECS, by }));
    return [];
  });
  const now = useEffectClock(items.map((i) => [i.at, i.secs] as const));
  // the latest one still counting down (two at once: the newer shows)
  const cd = items
    .map((i) => ({ ...i, p: phaseOf(i.at, i.secs, now) }))
    .filter((i) => i.p.kind === "arming")
    .sort((a, b) => b.at - a.at)[0];
  if (!cd || cd.p.kind !== "arming") return null;

  const left = cd.p.left;
  const sec = Math.ceil(left / 1000);
  const tone = cd.card ? `glitch--${cd.card.color}` : "glitch--tri";
  const by = state.teams[cd.by].name;
  const on = state.teams[cd.by ? 0 : 1].name;

  return (
    <div key={cd.at} className={`cd ${tone} pointer-events-none absolute bottom-[64px] left-8 right-8 top-[602px] z-40`} aria-live="assertive">
      <div className="cd-scrim absolute inset-0 rounded-[22px]" />
      <div className="relative flex h-full items-center justify-center gap-16 px-16">
        <div className="cd-art relative h-[270px] w-[300px] shrink-0">
          {cd.card ? <Image src={cd.card.art} alt="" fill sizes="300px" className="object-contain" /> : <GreenTriangle />}
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="label text-[18px]">{cd.card ? "Glitch card" : "Green triangle"}</span>
          <span className="cd-title title mt-3 whitespace-nowrap text-[68px] leading-none">{cd.card ? cd.card.name : "Freeze"}</span>
          <span className="name mt-6 flex items-center gap-4 whitespace-nowrap text-[32px] leading-none text-white">
            {by}
            <span className="text-[var(--text-faint)]">→</span>
            {on}
          </span>
          <span className="mt-4 text-[22px] text-[var(--text-dim)]">
            {cd.card ? `${cd.card.secs} s` : `Frozen for ${GREEN_FREEZE_SECS} s`}
          </span>
        </div>
        <div className="relative h-[300px] w-[300px] shrink-0">
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 300 300" aria-hidden>
            <circle cx="150" cy="150" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
            <circle
              className="cd-ring"
              cx="150"
              cy="150"
              r={R}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - left / COUNTDOWN_MS)}
            />
          </svg>
          <span key={sec} className="cd-digit digits absolute inset-0 flex items-center justify-center text-[200px] font-bold leading-none text-white">
            {sec}
          </span>
        </div>
      </div>
    </div>
  );
}

/** A green triangle as on the board, large. */
function GreenTriangle() {
  const def = SHAPES.find((s) => s.kind === "green")!;
  const xs = def.points.map((p) => p[0]);
  const ys = def.points.map((p) => p[1]);
  const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
  const [w, h] = [Math.max(...xs) - x0, Math.max(...ys) - y0];
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox={`${x0 - 6} ${y0 - 6} ${w + 12} ${h + 12}`} aria-hidden>
      <polygon points={def.points.map((p) => p.join(",")).join(" ")} fill={SHAPE_COLORS.green} stroke="#dfffe6" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
