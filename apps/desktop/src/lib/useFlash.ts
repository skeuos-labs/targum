import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Timed "flash" flag (saved indicator, "Copied!", etc.).
 * Clears the timeout on unmount and when re-triggered.
 */
export function useFlash(durationMs = 1500): [boolean, () => void] {
  const [active, setActive] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const flash = useCallback(() => {
    setActive(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setActive(false);
      timerRef.current = null;
    }, durationMs);
  }, [durationMs]);

  return [active, flash];
}
