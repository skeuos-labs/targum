import { describe, expect, it } from 'vitest';
import {
  ArrangementSchema,
  formatWarnings,
  LibrarySchema,
  MetadataSchema,
  parsePresentation,
  PresentationSchema,
  randomUUID,
  RichTextRunSchema,
  richTextToPlain,
  SectionSchema,
  SlideSchema,
  SourceFormatSchema,
  TextItemSchema,
  validateReferences,
  warning,
  WarningSchema,
  withDerivedPlainText,
  type Presentation,
  type Warning,
} from '../../src/canonical/index.js';

describe('Canonical ID generator', () => {
  it('generates valid UUID v4 string', () => {
    const id = randomUUID();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('generates unique IDs across calls', () => {
    const id1 = randomUUID();
    const id2 = randomUUID();
    expect(id1).not.toBe(id2);
  });
});

describe('Canonical Warnings', () => {
  it('validates a valid warning with WarningSchema', () => {
    const valid = {
      code: 'TEST_WARNING',
      severity: 'warn' as const,
      message: 'Something went wrong',
      context: { key: 'value', count: 1 },
    };
    const parsed = WarningSchema.parse(valid);
    expect(parsed).toEqual(valid);
  });

  it('rejects warning with empty code or invalid severity', () => {
    expect(() =>
      WarningSchema.parse({
        code: '',
        severity: 'warn',
        message: 'Empty code',
      }),
    ).toThrow();

    expect(() =>
      WarningSchema.parse({
        code: 'VALID_CODE',
        severity: 'critical',
        message: 'Invalid severity',
      }),
    ).toThrow();
  });

  it('creates warning object using warning() factory', () => {
    const w = warning('CODE_1', 'info', 'Info message', { foo: 'bar' });
    expect(w).toEqual({
      code: 'CODE_1',
      severity: 'info',
      message: 'Info message',
      context: { foo: 'bar' },
    });
  });

  it('formats warnings into human-readable string', () => {
    const w1: Warning = {
      code: 'WARN_A',
      severity: 'warn',
      message: 'First issue',
      context: { id: 'slide-1' },
    };
    const w2: Warning = {
      code: 'INFO_B',
      severity: 'info',
      message: 'Second note',
    };
    const formatted = formatWarnings([w1, w2]);
    expect(formatted).toContain('[WARN] WARN_A: First issue');
    expect(formatted).toContain('[INFO] INFO_B: Second note');
    expect(formatted).toContain('slide-1');
  });

  it('formatWarnings returns empty string for empty array', () => {
    expect(formatWarnings([])).toBe('');
  });
});

describe('Canonical Schemas', () => {
  it('validates SourceFormat values', () => {
    const validFormats = [
      'pro',
      'pro6',
      'vpc',
      'json',
      'freeshow',
      'txt',
      'pptx',
      'unknown',
    ];
    for (const f of validFormats) {
      expect(SourceFormatSchema.parse(f)).toBe(f);
    }
    expect(() => SourceFormatSchema.parse('invalid_format')).toThrow();
  });

  it('validates Metadata schema with optional fields', () => {
    const meta = {
      author: 'John Newton',
      copyright: 'Public Domain',
      ccli: '22025',
      notes: 'Hymn',
      language: 'en',
      originalFileName: 'song.pro',
      songId: '1234',
      themeName: 'Default',
    };
    expect(MetadataSchema.parse(meta)).toEqual(meta);
    expect(MetadataSchema.parse({})).toEqual({});
  });

  it('validates RichTextRun and TextItem schemas', () => {
    const run = { text: 'Hello', style: { fontWeight: 'bold' } };
    expect(RichTextRunSchema.parse(run)).toEqual(run);

    const item = {
      type: 'text' as const,
      plainText: 'Hello world',
      richText: [run, { text: ' world' }],
      style: { color: '#ffffff' },
    };
    expect(TextItemSchema.parse(item)).toEqual(item);
  });

  it('validates Slide, Section, and Arrangement schemas', () => {
    const slide = {
      id: 'slide-1',
      label: 'Verse 1.1',
      items: [
        {
          type: 'text' as const,
          plainText: 'Amazing grace, how sweet the sound',
        },
      ],
    };
    expect(SlideSchema.parse(slide)).toEqual(slide);

    const section = {
      id: 'sec-1',
      name: 'Verse 1',
      color: '#00ff00',
      slideIds: ['slide-1'],
    };
    expect(SectionSchema.parse(section)).toEqual(section);

    const arrangement = {
      id: 'arr-1',
      name: 'Standard',
      slideIds: ['slide-1'],
    };
    expect(ArrangementSchema.parse(arrangement)).toEqual(arrangement);
  });

  it('validates Presentation schema with defaults', () => {
    const minimal = {
      id: 'p-1',
      title: 'Amazing Grace',
      sourceFormat: 'pro' as const,
    };
    const parsed = PresentationSchema.parse(minimal);
    expect(parsed.id).toBe('p-1');
    expect(parsed.title).toBe('Amazing Grace');
    expect(parsed.sourceFormat).toBe('pro');
    expect(parsed.metadata).toEqual({});
    expect(parsed.sections).toEqual([]);
    expect(parsed.arrangements).toEqual([]);
    expect(parsed.slides).toEqual([]);
    expect(parsed.warnings).toEqual([]);
  });

  it('validates Library schema', () => {
    const library = {
      presentations: [
        {
          id: 'p-1',
          title: 'Song 1',
          sourceFormat: 'txt' as const,
          metadata: {},
          sections: [],
          arrangements: [],
          slides: [],
          warnings: [],
        },
      ],
    };
    expect(LibrarySchema.parse(library)).toEqual(library);
  });
});

describe('Canonical Normalization & Reference Validation', () => {
  it('richTextToPlain concatenates run texts correctly', () => {
    expect(richTextToPlain()).toBe('');
    expect(richTextToPlain([])).toBe('');
    expect(
      richTextToPlain([
        { text: 'Line 1\n' },
        { text: 'Line 2' },
      ]),
    ).toBe('Line 1\nLine 2');
  });

  it('withDerivedPlainText updates plainText from richText runs', () => {
    const p: Presentation = {
      id: 'p-1',
      title: 'Test',
      sourceFormat: 'unknown',
      metadata: {},
      sections: [],
      arrangements: [],
      slides: [
        {
          id: 's-1',
          items: [
            {
              type: 'text',
              plainText: 'outdated plain',
              richText: [{ text: 'Derived ' }, { text: 'Value' }],
            },
            {
              type: 'text',
              plainText: 'standalone plain',
            },
          ],
        },
      ],
      warnings: [],
    };

    const normalized = withDerivedPlainText(p);
    expect(normalized.slides[0]?.items[0]?.plainText).toBe('Derived Value');
    expect(normalized.slides[0]?.items[1]?.plainText).toBe('standalone plain');
  });

  it('validateReferences catches dangling slide IDs in sections and arrangements', () => {
    const p: Presentation = {
      id: 'p-1',
      title: 'Test',
      sourceFormat: 'pro',
      metadata: {},
      sections: [
        {
          id: 'sec-1',
          name: 'Verse 1',
          slideIds: ['s-1', 's-dangling-sec'],
        },
      ],
      arrangements: [
        {
          id: 'arr-1',
          name: 'Standard',
          slideIds: ['s-1', 's-dangling-arr'],
        },
      ],
      slides: [{ id: 's-1', items: [] }],
      warnings: [],
    };

    const warnings = validateReferences(p);
    expect(warnings).toHaveLength(2);

    const secWarn = warnings.find((w) => w.code === 'SECTION_DANGLING_SLIDE');
    expect(secWarn).toBeDefined();
    expect(secWarn?.severity).toBe('warn');
    expect(secWarn?.context).toMatchObject({
      sectionId: 'sec-1',
      slideId: 's-dangling-sec',
    });

    const arrWarn = warnings.find((w) => w.code === 'ARRANGEMENT_DANGLING_SLIDE');
    expect(arrWarn).toBeDefined();
    expect(arrWarn?.severity).toBe('warn');
    expect(arrWarn?.context).toMatchObject({
      arrangementId: 'arr-1',
      slideId: 's-dangling-arr',
    });
  });

  it('parsePresentation returns ok: true, normalized presentation and warnings for valid data', () => {
    const raw = {
      id: 'p-1',
      title: 'Valid Song',
      sourceFormat: 'vpc',
      slides: [
        {
          id: 's-1',
          items: [
            {
              type: 'text',
              plainText: '',
              richText: [{ text: 'Lyrics line' }],
            },
          ],
        },
      ],
      sections: [
        {
          id: 'sec-1',
          name: 'Chorus',
          slideIds: ['s-1', 's-missing'],
        },
      ],
    };

    const result = parsePresentation(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.slides[0]?.items[0]?.plainText).toBe('Lyrics line');
    expect(result.warnings.some((w) => w.code === 'SECTION_DANGLING_SLIDE')).toBe(
      true,
    );
    expect(result.value.warnings.some((w) => w.code === 'SECTION_DANGLING_SLIDE')).toBe(
      true,
    );
  });

  it('parsePresentation returns ok: false and ZodError on schema mismatch', () => {
    const invalid = {
      id: 'p-1',
      // missing title and sourceFormat
    };

    const result = parsePresentation(invalid);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.error).toBeDefined();
    expect(result.error.issues.length).toBeGreaterThan(0);
  });
});
