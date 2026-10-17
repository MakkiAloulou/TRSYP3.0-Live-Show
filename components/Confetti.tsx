"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#00e87a", "#ff1d78", "#ffffff", "#b25fc4", "#7fffc4", "#ff7fb2"];

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  tilt: number;
  vt: number;
  color: string;
}

/* Confetti on the 1920×1080 stage: two cannons fire from the bottom corners at
   `fireAt` ms, then a light fall from the top keeps going. */
export default function Confetti({ fireAt = 0, active }: { fireAt?: number; active: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const W = (canvas.width = 1920);
    const H = (canvas.height = 1080);
    const bits: Bit[] = [];
    const make = (x: number, y: number, vx: number, vy: number): Bit => ({
      x,
      y,
      vx,
      vy,
      w: 8 + Math.random() * 10,
      h: 5 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      tilt: Math.random() * Math.PI,
      vt: 0.08 + Math.random() * 0.12,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    const cannon = (fromLeft: boolean) => {
      for (let i = 0; i < 170; i++) {
        const angle = (fromLeft ? -62 : -118) + (Math.random() - 0.5) * 34;
        const speed = 22 + Math.random() * 20;
        const a = (angle * Math.PI) / 180;
        bits.push(make(fromLeft ? 40 : W - 40, H + 10, Math.cos(a) * speed, Math.sin(a) * speed));
      }
    };
    const t0 = performance.now();
    let fired = false;
    let raf = 0;
    const frame = (now: number) => {
      const t = now - t0;
      if (!fired && t >= fireAt) {
        fired = true;
        cannon(true);
        cannon(false);
      }
      // a gentle fall from the top once the cannons have gone off
      if (fired && bits.length < 420 && Math.random() < 0.55) bits.push(make(Math.random() * W, -20, (Math.random() - 0.5) * 2, 2 + Math.random() * 2));
      ctx.clearRect(0, 0, W, H);
      for (let i = bits.length - 1; i >= 0; i--) {
        const b = bits[i];
        b.vy += 0.42; // gravity
        b.vx *= 0.985; // air
        b.vy *= 0.985;
        b.vy = Math.min(b.vy, 6.5);
        b.x += b.vx + Math.sin(b.tilt) * 0.9;
        b.y += b.vy;
        b.rot += b.vr;
        b.tilt += b.vt;
        if (b.y > H + 40) {
          bits.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.rot);
        ctx.scale(1, Math.cos(b.tilt)); // the flutter
        ctx.fillStyle = b.color;
        ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [active, fireAt]);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden />;
}
