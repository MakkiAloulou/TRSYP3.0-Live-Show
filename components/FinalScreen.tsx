"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { type TeamId, type TeamState } from "@/lib/game";
import { CountUp, DrawPath, Frame, Line, Reveal, ScreenTitle, timing } from "./Draw";

/* Game Stats: both teams' total score (from Phase Stats). 6 s after the
   screen comes in, the dominant team is revealed: the line expands, the
   caption decodes, the name slams in with a shockwave and a screen shake. */

const X0 = 150;
const X1 = 1770;
const Y0 = 60;
const Y1 = 1020;
const MID = 960;
const TITLE_Y = 212;
const SPLIT_Y = 640;
const PAD = 70;

// scores start counting at ~950ms for 1500ms; reveal 2s after they land
const REVEAL_AFTER_MS = 950 + 1500 + 2000;
// reveal timeline (ms after it starts)
const T_LINE = 0;
const T_CAPTION = 250;
const T_SLAM = 1250;

const halfX = (t: TeamId) => (t === 0 ? [X0 + PAD, MID - PAD] : [MID + PAD, X1 - PAD]);
const v = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

interface Props {
  on: boolean;
  teams: [TeamState, TeamState];
  /** Cumulative scores (carried from earlier games + this one) */
  totals: [number, number];
  /** the game being played, for the score label */
  title: string;
}

export default function FinalScreen({ on, teams, totals, title }: Props) {
  const [reveal, setReveal] = useState(false);

  // Reveal 6 s after the screen draws in; hide at once when leaving
  useEffect(() => {
    const t = setTimeout(() => {
      setReveal(on);
    }, on ? REVEAL_AFTER_MS : 0);
    return () => clearTimeout(t);
  }, [on]);

  const leader: TeamId | null = totals[0] === totals[1] ? null : totals[0] > totals[1] ? 0 : 1;
  const showReveal = on && reveal;

  return (
    <div className={`absolute inset-0 ${showReveal ? "shake" : ""}`} style={v(T_SLAM + 60)} aria-hidden={!on}>
      {/* ── Lines ── */}
      <svg className="pointer-events-none absolute inset-0" width={1920} height={1080}>
        <g fill="none" strokeLinecap="round">
          <Frame on={on} x0={X0} y0={Y0} x1={X1} y1={Y1} />
          <Line on={on} d={260} dur={700} x1={X0} y1={TITLE_Y} x2={X1} y2={TITLE_Y} strong />
          <Line on={on} d={460} dur={600} x1={MID} y1={TITLE_Y} x2={MID} y2={SPLIT_Y} strong />
          <Line on={on} d={700} dur={700} x1={X0} y1={SPLIT_Y} x2={X1} y2={SPLIT_Y} strong />
          {([0, 1] as TeamId[]).map((t) => {
            const [a, b] = halfX(t);
            const c = (a + b) / 2;
            return <DrawPath key={t} on={on} d={1000 + t * 60} dur={420} path={`M ${c - 120} ${SPLIT_Y - 44} H ${c + 120}`} stroke={t ? "var(--pink)" : "var(--green)"} width={2} />;
          })}
        </g>
      </svg>

      {/* ── Title ── */}
      <ScreenTitle on={on} x0={X0} x1={X1} y0={Y0} y1={TITLE_Y} title="Game Stats" />

      {/* ── Team totals ── */}
      {([0, 1] as TeamId[]).map((t) => {
        const [a, b] = halfX(t);
        const o = t * 60;
        const isLeader = showReveal && leader === t;
        const isBehind = showReveal && leader !== null && leader !== t;
        return (
          <div
            key={t}
            className="absolute flex flex-col items-center transition-opacity duration-700"
            style={{ left: a, width: b - a, top: TITLE_Y + 44, opacity: isBehind ? 0.4 : 1 }}
          >
            <h2
              className={`glitch reveal ${on ? "on" : ""} name flex items-center gap-5 leading-none text-white`}
              style={{ ...timing(on, 640 + o, 420), fontSize: teams[t].name.length > 11 ? 42 : 52 }}
            >
              <span className={`diamond h-3 w-3 ${t ? "diamond--pink" : ""}`} />
              {teams[t].name}
              <span className={`diamond h-3 w-3 ${t ? "diamond--pink" : ""}`} />
            </h2>
            <Reveal on={on} d={820 + o} className="label mt-12 text-[17px]">
              {title} score
            </Reveal>
            <Reveal on={on} d={880 + o}>
              <span
                className={`digits mt-3 block text-[180px] font-bold leading-none ${t ? "pink-text" : "neon-text"} ${isLeader ? (t ? "pulse-glow pulse-glow--pink" : "pulse-glow") : ""}`}
                style={v(T_SLAM + 200)}
              >
                <CountUp value={totals[t]} on={on} delay={950 + o} ms={1500} />
              </span>
            </Reveal>
          </div>
        );
      })}

      {/* ── Dominant team reveal ── */}
      {showReveal && <DominantReveal name={leader === null ? null : teams[leader].name} corner={leader} />}
    </div>
  );
}

/** RGB of each corner: team 1 green, team 2 pink. */
const RGB = ["0,232,122", "255,29,120"] as const;

function DominantReveal({ name, corner }: { name: string | null; corner: TeamId | null }) {
  const cy = 860;
  // the winner's colour leads, the other corner's is the accent; a draw is white with both
  const main = corner === null ? "255,255,255" : RGB[corner];
  const accent = corner === null ? RGB[1] : RGB[corner ? 0 : 1];
  const c = (rgb: string, a = 1) => `rgba(${rgb},${a})`;
  const caption = name ? "The dominant team is" : "No dominant team";
  const headline = name ?? "It's a draw";
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* line sweeping across the lower band */}
      <span
        className="expand-x absolute h-[3px]"
        style={{ left: X0 + 60, right: 1920 - X1 + 60, top: 742, background: c(main), boxShadow: `0 0 14px ${c(main)}`, ...v(T_LINE) }}
      />

      <div
        className="absolute left-0 right-0 text-center text-[28px] font-semibold uppercase tracking-[0.3em] text-white"
        style={{ top: 686 }}
      >
        <Decode text={caption} startAfter={T_CAPTION} ms={950} />
      </div>

      {/* shockwave rings + particle burst, centred on the name */}
      <span
        className="shockwave absolute h-40 w-40 rounded-full border-[3px]"
        style={{ left: MID, top: cy, borderColor: c(main), boxShadow: `0 0 30px ${c(main)}`, ...v(T_SLAM + 120) }}
      />
      <span
        className="shockwave absolute h-40 w-40 rounded-full border-2"
        style={{ left: MID, top: cy, borderColor: c(accent), ...v(T_SLAM + 300) }}
      />
      {BURST.map((p, i) => (
        <span
          key={i}
          className="burst absolute rounded-full"
          style={
            {
              left: MID,
              top: cy,
              width: p.size,
              height: p.size,
              background: c(p.pink ? accent : main),
              boxShadow: `0 0 10px ${c(p.pink ? accent : main)}`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              ...v(T_SLAM + 100 + p.lag),
            } as CSSProperties
          }
        />
      ))}

      <div className="absolute left-0 right-0 text-center" style={{ top: cy - 85 }}>
        <span
          className="slam title inline-block whitespace-nowrap leading-none"
          style={{
            ...v(T_SLAM),
            fontSize: headline.length > 10 ? 104 : 132,
            color: c(main),
            textShadow: `0 0 18px ${c(main, 0.9)}, 0 0 60px ${c(main, 0.5)}, 6px 0 0 ${c(accent, 0.55)}`,
          }}
        >
          {headline}
        </span>
      </div>
    </div>
  );
}

// fixed particle burst (deterministic so it renders the same every time)
const BURST = Array.from({ length: 44 }, (_, i) => {
  const ang = (i / 44) * Math.PI * 2 + (i % 3) * 0.13;
  const dist = 260 + ((i * 97) % 360);
  return {
    dx: Math.round(Math.cos(ang) * dist * 1.7),
    dy: Math.round(Math.sin(ang) * dist * 0.55),
    size: 4 + (i % 4) * 2,
    pink: i % 3 === 0,
    lag: (i % 5) * 25,
  };
});

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&@$!?<>/";

/** Scrambled characters that lock into `text` left to right. */
function Decode({ text, startAfter, ms }: { text: string; startAfter: number; ms: number }) {
  const [out, setOut] = useState("");

  useEffect(() => {
    let iv = 0;
    const t = setTimeout(() => {
      const t0 = performance.now();
      iv = window.setInterval(() => {
        const p = Math.min(1, (performance.now() - t0) / ms);
        const locked = Math.floor(p * text.length);
        setOut(
          text
            .split("")
            .map((ch, i) => (i < locked || ch === " " ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
            .join(""),
        );
        if (p >= 1) clearInterval(iv);
      }, 35);
    }, startAfter);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [text, startAfter, ms]);

  return <span className="font-[family-name:var(--font-display)] font-semibold">{out}</span>;
}
