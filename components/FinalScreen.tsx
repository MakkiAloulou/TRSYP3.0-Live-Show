"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { teamTotal, type TeamId, type TeamState } from "@/lib/game";
import { CountUp, DrawPath, framePath, Line, Reveal, timing } from "./Draw";

/* Game Stats: both teams' total score (from Phase Stats). 6 s after the
   screen comes in, the dominant team is revealed: the line expands, the
   caption decodes, the name slams in with a shockwave and a screen shake. */

const X0 = 150;
const X1 = 1770;
const Y0 = 60;
const Y1 = 1020;
const MID = 960;
const CUT = 28;
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
}

export default function FinalScreen({ on, teams }: Props) {
  const [reveal, setReveal] = useState(false);

  // Reveal 6 s after the screen draws in; hide at once when leaving
  useEffect(() => {
    const t = setTimeout(() => setReveal(on), on ? REVEAL_AFTER_MS : 0);
    return () => clearTimeout(t);
  }, [on]);

  const totals = [teamTotal(teams[0].stats), teamTotal(teams[1].stats)];
  const leader: TeamId | null = totals[0] === totals[1] ? null : totals[0] > totals[1] ? 0 : 1;
  const showReveal = on && reveal;

  return (
    <div className={`absolute inset-0 ${showReveal ? "shake" : ""}`} style={v(T_SLAM + 60)} aria-hidden={!on}>
      {/* ── Lines ── */}
      <svg className="pointer-events-none absolute inset-0" width={1920} height={1080}>
        <g fill="none" strokeLinecap="square">
          <DrawPath on={on} d={0} dur={1100} path={framePath(X0, Y0, X1, Y1, CUT)} glow="drop-shadow(0 0 5px rgba(41,224,143,0.85))" />
          <Line on={on} d={260} dur={700} x1={X0} y1={TITLE_Y} x2={X1} y2={TITLE_Y} strong />
          <Line on={on} d={460} dur={600} x1={MID} y1={TITLE_Y} x2={MID} y2={SPLIT_Y} strong />
          <Line on={on} d={700} dur={700} x1={X0} y1={SPLIT_Y} x2={X1} y2={SPLIT_Y} strong />
          {([0, 1] as TeamId[]).map((t) => {
            const [a, b] = halfX(t);
            const c = (a + b) / 2;
            return <Line key={t} on={on} d={1000 + t * 60} dur={420} x1={c - 120} y1={SPLIT_Y - 44} x2={c + 120} y2={SPLIT_Y - 44} pink />;
          })}
        </g>
      </svg>

      {/* ── Title ── */}
      <Reveal on={on} d={320} className="absolute left-0 right-0 text-center" style={{ top: Y0 + 26 }}>
        <div className="text-[15px] font-semibold uppercase tracking-[0.55em] text-[var(--text-dim)]">
          TRSYP 3.0 · Polygame
        </div>
        <h1 className="neon-text mt-1 font-[family-name:var(--font-display)] text-[68px] uppercase leading-none tracking-[0.22em]">
          Game Stats
        </h1>
      </Reveal>

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
              className={`glitch neon-text reveal ${on ? "on" : ""} font-[family-name:var(--font-display)] text-[54px] uppercase leading-none tracking-[0.14em]`}
              style={timing(on, 640 + o, 420)}
            >
              <span className="mr-4 inline-block h-3 w-3 -translate-y-2.5 rotate-45 bg-[var(--pink)] shadow-[0_0_8px_var(--pink)]" />
              {teams[t].name}
              <span className="ml-4 inline-block h-3 w-3 -translate-y-2.5 rotate-45 bg-[var(--pink)] shadow-[0_0_8px_var(--pink)]" />
            </h2>
            <Reveal on={on} d={820 + o} className="mt-12 text-[17px] font-semibold uppercase tracking-[0.5em] text-[var(--text-dim)]">
              Total score
            </Reveal>
            <Reveal on={on} d={880 + o}>
              <span
                className={`digits mt-2 block text-[190px] leading-none ${isLeader ? "neon-text pulse-glow" : "pink-text"}`}
                style={v(T_SLAM + 200)}
              >
                <CountUp value={totals[t]} on={on} delay={950 + o} ms={1500} />
              </span>
            </Reveal>
          </div>
        );
      })}

      {/* ── Dominant team reveal ── */}
      {showReveal && <DominantReveal name={leader === null ? null : teams[leader].name} />}
    </div>
  );
}

function DominantReveal({ name }: { name: string | null }) {
  const cy = 860;
  const caption = name ? "The dominant team is" : "No dominant team";
  const headline = name ?? "It's a draw";
  return (
    <div className="pointer-events-none absolute inset-0">
      {/* line sweeping across the lower band */}
      <span
        className="expand-x absolute h-[3px] bg-[var(--pink)] shadow-[0_0_14px_var(--pink)]"
        style={{ left: X0 + 60, right: 1920 - X1 + 60, top: 742, ...v(T_LINE) }}
      />

      <div
        className="absolute left-0 right-0 text-center text-[30px] font-semibold uppercase tracking-[0.55em] text-[var(--text)]"
        style={{ top: 686 }}
      >
        <Decode text={caption} startAfter={T_CAPTION} ms={950} />
      </div>

      {/* shockwave rings + particle burst, centred on the name */}
      <span
        className="shockwave absolute h-40 w-40 rounded-full border-[3px] border-[var(--pink)] shadow-[0_0_30px_var(--pink)]"
        style={{ left: MID, top: cy, ...v(T_SLAM + 120) }}
      />
      <span
        className="shockwave absolute h-40 w-40 rounded-full border-2 border-[var(--neon)]"
        style={{ left: MID, top: cy, ...v(T_SLAM + 300) }}
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
              background: p.pink ? "var(--pink)" : "var(--neon)",
              boxShadow: `0 0 10px ${p.pink ? "var(--pink)" : "var(--neon)"}`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              ...v(T_SLAM + 100 + p.lag),
            } as CSSProperties
          }
        />
      ))}

      <div className="absolute left-0 right-0 text-center" style={{ top: cy - 85 }}>
        <span
          className="slam neon-text inline-block font-[family-name:var(--font-display)] text-[150px] uppercase leading-none tracking-[0.12em]"
          style={{ ...v(T_SLAM), textShadow: "0 0 18px rgba(41,224,143,0.9), 0 0 60px rgba(41,224,143,0.5), 6px 0 0 rgba(255,79,216,0.55)" }}
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

  return <span className="digits">{out}</span>;
}
