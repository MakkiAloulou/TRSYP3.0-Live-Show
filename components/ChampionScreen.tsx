"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import logo from "@/public/trsyp-logo.png";
import Branch from "./Branch";
import Confetti from "./Confetti";

/* The crowning, after the cup final. Played once, in order:
     0.0 s  the spotlight opens, light rays start turning
     0.5 s  the trophy draws itself in the champion's colour, then fills and glows
     1.9 s  CHAMPION builds letter by letter
     2.7 s  the team name slams in: flash, shockwaves, burst, confetti cannons
     3.4 s  the branch logo and the final's score settle underneath
   The champion's corner colour (green / pink) leads everything. */

export interface Crown {
  name: string;
  /** league id, for the branch logo */
  id: string;
  corner: 0 | 1;
  score: number;
  runnerUp: string;
  runnerScore: number;
}

const RGB = ["0,232,122", "255,29,120"] as const;

const BURST = Array.from({ length: 56 }, (_, i) => {
  const ang = (i / 56) * Math.PI * 2 + (i % 3) * 0.11;
  const dist = 300 + ((i * 89) % 420);
  return { dx: Math.round(Math.cos(ang) * dist * 1.6), dy: Math.round(Math.sin(ang) * dist * 0.7), size: 5 + (i % 4) * 3, alt: i % 3 === 0, lag: (i % 6) * 22 };
});

export default function ChampionScreen({ crown, take }: { crown: Crown; take: number }) {
  const main = RGB[crown.corner];
  const accent = RGB[crown.corner ? 0 : 1];
  const c = (rgb: string, a = 1) => `rgba(${rgb},${a})`;
  const v = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;
  const word = "CHAMPION";
  const nameSize = crown.name.length > 12 ? 112 : crown.name.length > 9 ? 132 : 156;

  return (
    <div key={take} className="champ absolute inset-0 overflow-hidden" style={{ "--main": c(main), "--main-soft": c(main, 0.35), "--accent": c(accent) } as CSSProperties}>
      {/* spotlight from above, and rays turning behind the trophy */}
      <div
        className="champ-spot absolute inset-0"
        style={{ background: `radial-gradient(38% 70% at 50% -8%, ${c(main, 0.32)}, transparent 70%), radial-gradient(60% 50% at 50% 40%, ${c(main, 0.08)}, transparent 70%)` }}
      />
      <div className="champ-rays absolute left-1/2 top-[300px] h-[1500px] w-[1500px]" />

      {/* a white flash when the name lands */}
      <div className="champ-flash absolute inset-0 bg-white" style={v(2700)} />

      <Confetti active fireAt={2700} />

      <div className="absolute left-1/2 top-[58px] -translate-x-1/2">
        <Image src={logo} alt="TRSYP 3.0" className="champ-fade h-[38px] w-auto object-cover" style={{ aspectRatio: "2000 / 330", ...v(200) }} />
      </div>

      {/* the trophy */}
      <div className="champ-trophy absolute left-1/2 top-[140px]" style={v(500)}>
        <Trophy main={main} accent={accent} />
      </div>

      <div className="absolute inset-x-0 top-[520px] flex flex-col items-center">
        <div className="title text-[46px] leading-none tracking-[0.62em] text-white" aria-label={word}>
          {[...word].map((ch, i) => (
            <span key={i} className="champ-char inline-block" style={{ "--c": i } as CSSProperties} aria-hidden>
              {ch}
            </span>
          ))}
        </div>

        {/* the name, with shockwaves and a burst behind it */}
        <div className="relative mt-10 flex h-[170px] items-center justify-center">
          {/* rings and burst wait unseen until the name lands */}
          <div className="champ-at absolute inset-0" style={v(2700)}>
          <span className="shockwave absolute left-1/2 top-1/2 h-48 w-48 rounded-full border-[4px]" style={{ borderColor: c(main), boxShadow: `0 0 40px ${c(main)}`, ...v(2780) }} />
          <span className="shockwave absolute left-1/2 top-1/2 h-48 w-48 rounded-full border-2" style={{ borderColor: c(accent), ...v(2960) }} />
          <span className="shockwave absolute left-1/2 top-1/2 h-48 w-48 rounded-full border" style={{ borderColor: "rgba(255,255,255,0.7)", ...v(3140) }} />
          {BURST.map((p, i) => (
            <span
              key={i}
              className="burst absolute left-1/2 top-1/2 rounded-full"
              style={
                {
                  width: p.size,
                  height: p.size,
                  background: c(p.alt ? accent : main),
                  boxShadow: `0 0 12px ${c(p.alt ? accent : main)}`,
                  "--dx": `${p.dx}px`,
                  "--dy": `${p.dy}px`,
                  ...v(2760 + p.lag),
                } as CSSProperties
              }
            />
          ))}
          </div>
          <h1
            className="title champ-name relative whitespace-nowrap leading-none"
            style={{
              ...v(2700),
              fontSize: nameSize,
              color: c(main),
              textShadow: `0 0 24px ${c(main, 0.85)}, 0 0 90px ${c(main, 0.45)}, 4px 0 0 ${c(accent, 0.35)}`,
            }}
          >
            {crown.name}
          </h1>
        </div>

        <div className="champ-rise mt-10 flex flex-col items-center gap-6" style={v(3400)}>
          <Branch id={crown.id} height={86} />
          <div className="flex items-center gap-5 text-[24px] font-medium text-[var(--text-dim)]">
            <span className="h-px w-24" style={{ background: `linear-gradient(90deg, transparent, ${c(main, 0.6)})` }} />
            <span>
              Final <span className="digits mx-2 text-[30px] font-bold text-white">{crown.score}</span>–
              <span className="digits mx-2 text-[30px] font-bold text-white/60">{crown.runnerScore}</span>
              {crown.runnerUp}
            </span>
            <span className="h-px w-24" style={{ background: `linear-gradient(90deg, ${c(main, 0.6)}, transparent)` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** A trophy that draws itself (outline), then fills with the champion's colour. */
function Trophy({ main, accent }: { main: string; accent: string }) {
  const paths = [
    "M6 9H4.5a2.5 2.5 0 0 1 0-5H6",
    "M18 9h1.5a2.5 2.5 0 0 0 0-5H18",
    "M4 22h16",
    "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22",
    "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22",
    "M18 2H6v7a6 6 0 0 0 12 0V2Z",
  ];
  return (
    <svg width="320" height="320" viewBox="0 0 24 24" fill="none" aria-hidden className="overflow-visible">
      <defs>
        <linearGradient id="cup-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.95" />
          <stop offset="0.45" stopColor={`rgb(${main})`} stopOpacity="0.9" />
          <stop offset="1" stopColor={`rgb(${accent})`} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {/* the bowl fills once the outline is drawn */}
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" fill="url(#cup-fill)" className="champ-cup-fill" />
      <g stroke={`rgb(${main})`} strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round" style={{ filter: `drop-shadow(0 0 1.2px rgb(${main}))` }}>
        {paths.map((d, i) => (
          <path key={i} d={d} pathLength={1} className="champ-draw" style={{ "--i": i } as CSSProperties} />
        ))}
      </g>
      {/* a glint crossing the bowl */}
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" fill="url(#cup-glint)" className="champ-glint" />
      <defs>
        <linearGradient id="cup-glint" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.85" />
          <stop offset="0.65" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}
