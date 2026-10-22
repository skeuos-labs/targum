import { useCallback } from 'react';
import { useFlash } from './useFlash';

/**
 * Copy text to the clipboard with a timed "Copied!" flash flag.
 * No-ops silently when the clipboard API is unavailable.
 */
export function useCopyText(durationMs = 1500): {
  copied: boolean;
  copy(text: string): Promise<void>;
} {
  const [copied, flashCopied] = useFlash(durationMs);

  const copy = useCallback(
    async (text: string) => {
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
          flashCopied();
        }
      } catch {
        // clipboard unavailable
      }
    },
    [flashCopied]
  );

  return { copied, copy };
}
