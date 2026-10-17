import type { CSSProperties } from "react";
import { teamBranch } from "@/lib/game";

/** A team's student branch logo, as on the draw (the logo already names the
    branch). The logos are ink-only mattes (public/branches), painted one colour
    (--ras-violet) through a CSS mask. `height` in px; the frame is 2:1. */
export default function Branch({ id, height, className = "" }: { id?: string; height: number; className?: string }) {
  const b = teamBranch(id);
  if (!b) return null;
  const mask = `url(${b.logo}) center / contain no-repeat`;
  return (
    <span
      role="img"
      aria-label={b.branch}
      className={`block flex-none bg-[var(--ras-violet)] ${className}`}
      style={{ height, aspectRatio: "2", mask, WebkitMask: mask } as CSSProperties}
    />
  );
}
