"use client";

import { useLayoutEffect, useRef, useState } from "react";

/** One line of text at `size` px, shrunk just enough to fit its container's
    width when it is too long (never wraps, never truncates). */
export default function FitText({ text, size, className = "" }: { text: string; size: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState(size);

  useLayoutEffect(() => {
    const el = ref.current;
    const box = el?.parentElement;
    if (!el || !box) return;
    const measure = () => {
      // width scales with font size, so the full-size width follows from the current one
      const current = parseFloat(getComputedStyle(el).fontSize) || size;
      const natural = (el.offsetWidth * size) / current;
      const room = box.clientWidth;
      if (!natural || !room) return;
      setFit(natural > room ? Math.floor((size * room) / natural) : size);
    };
    measure();
    // re-fit when the box resizes or the web font lands
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(el);
    document.fonts?.addEventListener("loadingdone", measure);
    return () => {
      ro.disconnect();
      document.fonts?.removeEventListener("loadingdone", measure);
    };
  }, [text, size]);

  return (
    <span ref={ref} className={`inline-block whitespace-nowrap ${className}`} style={{ fontSize: fit }}>
      {text}
    </span>
  );
}
