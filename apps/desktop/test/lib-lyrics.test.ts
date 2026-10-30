import { describe, it, expect } from 'vitest';
import { AMAZING_GRACE } from '@skeuos-labs/mizmor';
import { formatLyricsForCopy } from '../src/lib/lyrics';
import { buildSlideToSectionMap } from '../src/lib/slideText';

describe('formatLyricsForCopy', () => {
  it('returns non-empty lyrics for a real presentation', () => {
    const map = buildSlideToSectionMap(AMAZING_GRACE);
    const out = formatLyricsForCopy(AMAZING_GRACE, map);
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toMatch(/\n{3,}/);
  });
});

