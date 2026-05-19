import { useEffect, useRef, useState } from "react";

/**
 * Animates a number from its previous value up to `target` with an
 * ease-out curve. Honors `prefers-reduced-motion` by snapping straight
 * to the target. Returns a (possibly fractional) value — callers should
 * round when formatting for display.
 */
export function useCountUp(target: number, durationMs = 650): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const from = fromRef.current;

    if (reduced || from === target) {
      fromRef.current = target;
      rafRef.current = requestAnimationFrame(() => setValue(target));
      return () => cancelAnimationFrame(rafRef.current);
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, durationMs]);

  return value;
}
