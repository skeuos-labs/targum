import { describe, it, expect } from 'vitest';
import { AMAZING_GRACE } from '@skeuos-labs/mizmor';
import {
  getSlidePlainText,
  buildSlideToSectionMap,
  buildArrangementSequence,
} from '../src/lib/slideText';

describe('slideText helpers', () => {
  it('extracts plain text from a text item slide', () => {
    const slide = {
      id: 's1',
      items: [
        { type: 'text' as const, plainText: 'Amazing Grace' },
        { type: 'text' as const, plainText: 'how sweet the sound' },
      ],
    };
    expect(getSlidePlainText(slide as never)).toBe('Amazing Grace\nhow sweet the sound');
  });

  it('builds slide→section map keeping first section per slide', () => {
    const map = buildSlideToSectionMap(AMAZING_GRACE);
    expect(map.size).toBeGreaterThan(0);
    const first = map.values().next().value;
    expect(first).toHaveProperty('name');
  });

  it('collapses consecutive duplicate section names in arrangement sequence', () => {
    const map = new Map([
      ['a', { name: 'Verse' }],
      ['b', { name: 'Verse' }],
      ['c', { name: 'Chorus' }],
    ]);
    expect(buildArrangementSequence(['a', 'b', 'c'], map, [])).toEqual([
      'Verse',
      'Chorus',
    ]);
  });

  it('falls back to section names when sequence is empty', () => {
    expect(
      buildArrangementSequence([], new Map(), [{ name: 'Intro' } as never])
    ).toEqual(['Intro']);
  });
});

