import { forwardRef } from "react";

export const SCAN_W = 300;

/* The wipe bar: a hot pink/white core at its leading (right) edge with a green
   trail of fading slats behind it. Positioned every frame by the stage. */
const ScanBar = forwardRef<HTMLDivElement>(function ScanBar(_, ref) {
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute top-0 z-40 h-full"
      style={{ width: SCAN_W, left: 0, transform: `translateX(${-SCAN_W * 2}px)` }}
    >
      {/* trail */}
      {[0.04, 0.07, 0.1, 0.15, 0.22, 0.32].map((o, i) => (
        <span
          key={i}
          className="absolute top-0 h-full bg-[var(--neon)]"
          style={{ left: (SCAN_W - 30) * (i / 6), width: (SCAN_W - 30) / 6 + 1, opacity: o }}
        />
      ))}
      {/* scanlines over the trail */}
      <span
        className="absolute inset-y-0 left-0"
        style={{
          right: 24,
          backgroundImage: "repeating-linear-gradient(0deg, rgba(2,7,5,0.55) 0 2px, transparent 2px 6px)",
        }}
      />
      {/* green edge + pink core */}
      <span className="absolute top-0 h-full w-[10px] bg-[var(--neon)]" style={{ right: 14, boxShadow: "0 0 24px 6px rgba(41,224,143,0.8)" }} />
      <span className="absolute top-0 h-full w-[6px] bg-white" style={{ right: 6, boxShadow: "0 0 18px 6px var(--pink), 0 0 60px 18px rgba(255,79,216,0.55)" }} />
      {/* little HUD ticks riding the bar */}
      {[120, 310, 540, 760, 930].map((y) => (
        <span key={y} className="absolute h-[3px] w-16 bg-[var(--pink)]" style={{ right: 20, top: y, boxShadow: "0 0 8px var(--pink)" }} />
      ))}
    </div>
  );
});

export default ScanBar;
