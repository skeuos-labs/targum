import { describe, it, expect } from 'vitest';
import { getSectionStyle } from '../src/lib/sectionStyle';

describe('getSectionStyle', () => {
  it('prefers valid custom hex over name matching', () => {
    const s = getSectionStyle('Chorus', '#ff0000');
    expect(s.hex).toBe('#ff0000');
    expect(s.dotBg).toBe('');
  });

  it('ignores invalid custom color and matches by name', () => {
    const s = getSectionStyle('Chorus', 'not-a-color');
    expect(s.hex).toBe('#EF4444');
    expect(s.dotBg).toBe('bg-red-500');
  });

  it('matches verse, bridge, and falls back to slate', () => {
    expect(getSectionStyle('Verse 1').hex).toBe('#3B82F6');
    expect(getSectionStyle('Bridge').hex).toBe('#10B981');
    expect(getSectionStyle('Mystery').hex).toBe('#94A3B8');
  });
});
