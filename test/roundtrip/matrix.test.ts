import { describe, expect, it } from 'vitest';
import {
  AMAZING_GRACE,
  convertFile,
  exportPresentation,
  importFile,
  type FormatId,
  type Presentation,
} from '../../src/index.js';
import {
  computeTokenCoverage,
  extractLyrics,
  tokenizeLyrics,
} from '../helpers/token-coverage.js';

const FORMAT_EXTENSIONS: Record<FormatId, string> = {
  pro: 'pro',
  pro6: 'pro6',
  vpc: 'vpc',
  json: 'json',
  freeshow: 'show',
  txt: 'txt',
  pptx: 'pptx',
};

describe('Cross-Format Round-Trip Matrix', () => {
  describe('Token coverage helper verification', () => {
    it('returns 1.0 for identical texts', () => {
      const text = 'Amazing grace how sweet the sound';
      expect(computeTokenCoverage(text, text)).toBe(1.0);
    });

    it('handles punctuation, case, and whitespace differences', () => {
      const t1 = 'Amazing grace! How sweet the sound, that saved a wretch like me.';
      const t2 = 'amazing GRACE how sweet the sound that saved a wretch like me';
      expect(computeTokenCoverage(t1, t2)).toBe(1.0);
    });

    it('accurately computes partial coverage', () => {
      const src = 'one two three four';
      const tgt = 'one two other';
      expect(computeTokenCoverage(src, tgt)).toBe(0.5);
    });

    it('returns 1.0 for empty source', () => {
      expect(computeTokenCoverage('', 'some target')).toBe(1.0);
    });
  });

  async function performRoundTrip(
    formatA: FormatId,
    formatB: FormatId
  ): Promise<Presentation> {
    const extA = FORMAT_EXTENSIONS[formatA];
    const extB = FORMAT_EXTENSIONS[formatB];

    // 1. Initial export of AMAZING_GRACE to formatA
    const initialExport = await exportPresentation(AMAZING_GRACE, formatA);
    expect(initialExport.ok).toBe(true);
    if (!initialExport.ok) {
      throw new Error(`Failed initial export to ${formatA}: ${initialExport.error.message}`);
    }

    // 2. Convert formatA -> formatB
    const step1 = await convertFile(
      initialExport.value.bytes,
      `Amazing Grace.${extA}`,
      formatB
    );
    expect(step1.ok).toBe(true);
    if (!step1.ok) {
      throw new Error(`Failed step1 ${formatA} -> ${formatB}: ${step1.error.message}`);
    }

    // 3. Convert formatB -> formatA
    const step2 = await convertFile(
      step1.value.bytes,
      `Amazing Grace.${extB}`,
      formatA
    );
    expect(step2.ok).toBe(true);
    if (!step2.ok) {
      throw new Error(`Failed step2 ${formatB} -> ${formatA}: ${step2.error.message}`);
    }

    // 4. Import formatA back to canonical Library
    const imported = await importFile(
      step2.value.bytes,
      `Amazing Grace.${extA}`
    );
    expect(imported.ok).toBe(true);
    if (!imported.ok) {
      throw new Error(`Failed re-import of ${formatA}: ${imported.error.message}`);
    }

    expect(imported.value.presentations.length).toBe(1);
    return imported.value.presentations[0]!;
  }

  const PRIMARY_ROUNDTRIPS: Array<{ from: FormatId; via: FormatId; label: string }> = [
    { from: 'pro', via: 'vpc', label: 'pro -> vpc -> pro' },
    { from: 'vpc', via: 'freeshow', label: 'vpc -> freeshow -> vpc' },
    { from: 'txt', via: 'pro', label: 'txt -> pro -> txt' },
    { from: 'pptx', via: 'txt', label: 'pptx -> txt -> pptx' },
    { from: 'freeshow', via: 'pptx', label: 'freeshow -> pptx -> freeshow' },
    { from: 'pro', via: 'txt', label: 'pro -> txt -> pro' },
  ];

  for (const { from, via, label } of PRIMARY_ROUNDTRIPS) {
    it(`preserves fidelity for ${label}`, async () => {
      const result = await performRoundTrip(from, via);

      // Assert title preserved
      expect(result.title.toLowerCase()).toContain('amazing grace');

      // Assert non-zero slides throughout
      expect(result.slides.length).toBeGreaterThan(0);

      // Assert non-zero sections throughout
      expect(result.sections.length).toBeGreaterThan(0);

      // Assert token coverage >= 95% on lyric texts
      const coverage = computeTokenCoverage(AMAZING_GRACE, result);
      expect(coverage).toBeGreaterThanOrEqual(0.95);
    });
  }

  describe('Comprehensive round-trip matrix across all exportable format pairs', () => {
    const EXPORT_FORMATS: FormatId[] = ['pro', 'vpc', 'freeshow', 'txt', 'pptx'];

    for (const fmtA of EXPORT_FORMATS) {
      for (const fmtB of EXPORT_FORMATS) {
        if (fmtA === fmtB) continue;
        const pairLabel = `${fmtA} -> ${fmtB} -> ${fmtA}`;

        it(`roundtrips ${pairLabel} with >= 95% token coverage`, async () => {
          const result = await performRoundTrip(fmtA, fmtB);

          expect(result.title.toLowerCase()).toContain('amazing grace');
          expect(result.slides.length).toBeGreaterThan(0);
          expect(result.sections.length).toBeGreaterThan(0);

          const coverage = computeTokenCoverage(AMAZING_GRACE, result);
          expect(coverage).toBeGreaterThanOrEqual(0.95);
        });
      }
    }
  });
});
