import type { Presentation } from '../../src/index.js';

/**
 * Extract all plain text from presentation slides.
 */
export function extractLyrics(presentation: Presentation): string {
  return presentation.slides
    .map((slide) =>
      slide.items
        .filter((item) => item.type === 'text')
        .map((item) => item.plainText)
        .join(' ')
    )
    .join(' ');
}

/**
 * Tokenize text into a set of normalized unique lowercase tokens.
 * Strips punctuation and non-alphanumeric unicode characters.
 */
export function tokenizeLyrics(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  return new Set(words);
}

/**
 * Compute the token coverage ratio between source and target presentations/strings.
 * Returns ratio in [0, 1] representing the fraction of source tokens retained in target.
 */
export function computeTokenCoverage(
  source: string | Presentation,
  target: string | Presentation
): number {
  const sourceText = typeof source === 'string' ? source : extractLyrics(source);
  const targetText = typeof target === 'string' ? target : extractLyrics(target);

  const sourceTokens = tokenizeLyrics(sourceText);
  const targetTokens = tokenizeLyrics(targetText);

  if (sourceTokens.size === 0) return 1;

  let matched = 0;
  for (const token of sourceTokens) {
    if (targetTokens.has(token)) {
      matched++;
    }
  }

  return matched / sourceTokens.size;
}
