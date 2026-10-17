import { describe, expect, it } from 'vitest';
import {
  parsePresentation,
  validateReferences,
} from '../../src/canonical/index.js';
import {
  AMAZING_GRACE,
  createAmazingGracePresentation,
} from '../../src/fixtures/amazing-grace.js';

describe('Amazing Grace Deterministic Baseline Fixture', () => {
  it('exports AMAZING_GRACE and createAmazingGracePresentation', () => {
    expect(AMAZING_GRACE).toBeDefined();
    expect(typeof createAmazingGracePresentation).toBe('function');
  });

  it('has valid metadata conforming to baseline hymn requirements', () => {
    expect(AMAZING_GRACE.title).toBe('Amazing Grace');
    expect(AMAZING_GRACE.metadata.author).toBe('John Newton');
    expect(AMAZING_GRACE.metadata.ccli).toBe('22025');
  });

  it('contains exactly 9 slides with non-empty text items and public domain lyrics', () => {
    expect(AMAZING_GRACE.slides).toHaveLength(9);

    for (const slide of AMAZING_GRACE.slides) {
      expect(slide.id).toBeTruthy();
      expect(slide.items.length).toBeGreaterThan(0);
      for (const item of slide.items) {
        expect(item.type).toBe('text');
        expect(item.plainText.trim().length).toBeGreaterThan(0);
        // Ensure no copyrighted Tomlin 2006 lyrics
        expect(item.plainText).not.toContain('chains are gone');
      }
    }

    const chorusSlide = AMAZING_GRACE.slides.find((s) => s.id === 'ag-slide-c-1');
    expect(chorusSlide?.items[0]?.plainText).toContain('Praise God, praise God');
  });

  it('has unique slide IDs across all slides', () => {
    const ids = AMAZING_GRACE.slides.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(9);
  });

  it('contains exactly 5 sections with proper slide partitioning', () => {
    expect(AMAZING_GRACE.sections).toHaveLength(5);

    const sectionNames = AMAZING_GRACE.sections.map((s) => s.name);
    expect(sectionNames).toEqual([
      'Verse 1',
      'Verse 2',
      'Chorus',
      'Verse 3',
      'Verse 4',
    ]);

    const v1 = AMAZING_GRACE.sections.find((s) => s.name === 'Verse 1');
    const v2 = AMAZING_GRACE.sections.find((s) => s.name === 'Verse 2');
    const chorus = AMAZING_GRACE.sections.find((s) => s.name === 'Chorus');
    const v3 = AMAZING_GRACE.sections.find((s) => s.name === 'Verse 3');
    const v4 = AMAZING_GRACE.sections.find((s) => s.name === 'Verse 4');

    expect(v1?.slideIds).toHaveLength(2);
    expect(v2?.slideIds).toHaveLength(2);
    expect(chorus?.slideIds).toHaveLength(1);
    expect(v3?.slideIds).toHaveLength(2);
    expect(v4?.slideIds).toHaveLength(2);

    // All section slide references together account for all 9 slides
    const allSectionSlideIds = AMAZING_GRACE.sections.flatMap((s) => s.slideIds);
    expect(allSectionSlideIds).toHaveLength(9);
    expect(new Set(allSectionSlideIds).size).toBe(9);
  });

  it('defines Standard, Full, and Short arrangements with clean slide references', () => {
    expect(AMAZING_GRACE.arrangements).toHaveLength(3);

    const standard = AMAZING_GRACE.arrangements.find(
      (a) => a.name === 'Standard',
    );
    const full = AMAZING_GRACE.arrangements.find((a) => a.name === 'Full');
    const short = AMAZING_GRACE.arrangements.find((a) => a.name === 'Short');

    expect(standard).toBeDefined();
    expect(full).toBeDefined();
    expect(short).toBeDefined();

    const v1 = AMAZING_GRACE.sections.find((s) => s.name === 'Verse 1')!;
    const v2 = AMAZING_GRACE.sections.find((s) => s.name === 'Verse 2')!;
    const chorus = AMAZING_GRACE.sections.find((s) => s.name === 'Chorus')!;
    const v3 = AMAZING_GRACE.sections.find((s) => s.name === 'Verse 3')!;
    const v4 = AMAZING_GRACE.sections.find((s) => s.name === 'Verse 4')!;

    // Short: V1 -> V4 (4 entries: 2 slides of V1, 2 slides of V4)
    expect(short?.slideIds).toEqual([...v1.slideIds, ...v4.slideIds]);
    expect(short?.slideIds).toHaveLength(4);

    // Standard & Full: V1 -> Chorus -> V2 -> Chorus -> V3 -> Chorus -> V4 -> Chorus (8 sections, 12 slides)
    const expectedFullSequence = [
      ...v1.slideIds,
      ...chorus.slideIds,
      ...v2.slideIds,
      ...chorus.slideIds,
      ...v3.slideIds,
      ...chorus.slideIds,
      ...v4.slideIds,
      ...chorus.slideIds,
    ];
    expect(standard?.slideIds).toEqual(expectedFullSequence);
    expect(standard?.slideIds).toHaveLength(12);
    expect(full?.slideIds).toEqual(expectedFullSequence);
    expect(full?.slideIds).toHaveLength(12);
  });

  it('validates without reference warnings or schema errors', () => {
    const refWarnings = validateReferences(AMAZING_GRACE);
    expect(refWarnings).toHaveLength(0);

    const parseResult = parsePresentation(AMAZING_GRACE);
    expect(parseResult.ok).toBe(true);
    if (!parseResult.ok) return;

    expect(parseResult.warnings).toHaveLength(0);
    expect(parseResult.value.warnings).toHaveLength(0);
  });

  it('protects exported AMAZING_GRACE singleton via deep freeze', () => {
    expect(Object.isFrozen(AMAZING_GRACE)).toBe(true);
    expect(Object.isFrozen(AMAZING_GRACE.metadata)).toBe(true);
    expect(Object.isFrozen(AMAZING_GRACE.sections)).toBe(true);
    expect(Object.isFrozen(AMAZING_GRACE.arrangements)).toBe(true);
    expect(Object.isFrozen(AMAZING_GRACE.slides)).toBe(true);
    expect(Object.isFrozen(AMAZING_GRACE.slides[0])).toBe(true);

    expect(() => {
      // @ts-expect-error mutating frozen object
      AMAZING_GRACE.title = 'Mutated Title';
    }).toThrow();

    expect(() => {
      // @ts-expect-error mutating frozen nested object
      AMAZING_GRACE.slides[0].id = 'mutated-slide';
    }).toThrow();
  });

  it('createAmazingGracePresentation returns a fresh deep clone that is mutable', () => {
    const copy1 = createAmazingGracePresentation();
    const copy2 = createAmazingGracePresentation();

    expect(copy1).toEqual(AMAZING_GRACE);
    expect(copy1).not.toBe(AMAZING_GRACE);
    expect(copy1).not.toBe(copy2);
    expect(copy1.slides).not.toBe(copy2.slides);
    expect(copy1.slides[0]).not.toBe(copy2.slides[0]);

    // Mutating a copy must succeed and not affect AMAZING_GRACE or copy2
    copy1.title = 'Mutated Title';
    copy1.slides[0]!.id = 'mutated-id';
    expect(copy1.title).toBe('Mutated Title');
    expect(AMAZING_GRACE.title).toBe('Amazing Grace');
    expect(copy2.title).toBe('Amazing Grace');
    expect(AMAZING_GRACE.slides[0]!.id).not.toBe('mutated-id');
  });
});
