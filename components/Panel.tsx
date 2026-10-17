import type { CSSProperties, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Corner radius, px */
  radius?: number;
  /** Team corner: tints the top hairline green (0) or pink (1) */
  corner?: 0 | 1;
  /** No top hairline */
  quiet?: boolean;
  /** Show the travelling pink light */
  tracer?: boolean;
  traceDuration?: number;
}

// The brand card: navy glass, 1px hairline, soft shadow, rounded corners.
// The optional tracer is a short pink comet riding the rounded border.
export default function Panel({
  children,
  className = "",
  style,
  radius = 18,
  corner,
  quiet,
  tracer = false,
  traceDuration = 7,
}: Props) {
  return (
    <div
      className={`panel ${className}`}
      data-corner={corner}
      data-quiet={quiet ? "" : undefined}
      style={{ "--r": `${radius}px`, ...style } as CSSProperties}
    >
      {tracer && (
        <svg className="pointer-events-none absolute -inset-px z-10 h-[calc(100%+2px)] w-[calc(100%+2px)] overflow-visible" aria-hidden>
          <rect
            x="0.5"
            y="0.5"
            rx={radius}
            pathLength={1}
            fill="none"
            stroke="var(--pink)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="0.05 1"
            strokeDashoffset={1.05}
            className="tracer"
            style={
              {
                width: "calc(100% - 1px)",
                height: "calc(100% - 1px)",
                "--trace-dur": `${traceDuration}s`,
                filter: "drop-shadow(0 0 5px rgba(255,29,120,0.8))",
              } as CSSProperties
            }
          />
        </svg>
      )}
      <div className="relative h-full w-full">{children}</div>
    </div>
  );
}
