import { TextReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import { describe, expect, it } from 'vitest';
import type { Library, Presentation } from '../../src/canonical/index.js';
import { AMAZING_GRACE } from '../../src/fixtures/amazing-grace.js';
import { parseFreeShow, writeFreeShow } from '../../src/formats/freeshow/index.js';

async function buildShowZip(doc: unknown, entryName = 'show.json'): Promise<Uint8Array> {
  const writer = new ZipWriter(new Uint8ArrayWriter());
  const content = typeof doc === 'string' ? doc : JSON.stringify(doc);
  await writer.add(entryName, new TextReader(content));
  return writer.close();
}

function line(value: string, style = ''): Record<string, unknown> {
  return { align: '', text: [{ value, style }] };
}

describe('FreeShow .show Codec', () => {
  describe('Exports', () => {
    it('exports parseFreeShow and writeFreeShow functions', () => {
      expect(typeof parseFreeShow).toBe('function');
      expect(typeof writeFreeShow).toBe('function');
    });
  });

  describe('AMAZING_GRACE Round-Trip', () => {
    it('serializes AMAZING_GRACE to FreeShow archive bytes and re-imports accurately', async () => {
      const library: Library = {
        presentations: [AMAZING_GRACE],
      };

      const writeRes = await writeFreeShow(library);
      expect(writeRes.ok).toBe(true);
      if (!writeRes.ok) return;

      expect(writeRes.value.bytes).toBeInstanceOf(Uint8Array);
      expect(writeRes.value.bytes.byteLength).toBeGreaterThan(0);

      const parseRes = await parseFreeShow(writeRes.value.bytes, 'Amazing Grace.show');
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const { presentations } = parseRes.value;
      expect(presentations).toHaveLength(1);

      const p = presentations[0]!;
      expect(p.title).toBe('Amazing Grace');
      expect(p.sourceFormat).toBe('freeshow');
      expect(p.metadata.author).toBe('John Newton');
      expect(p.metadata.ccli).toBe('22025');
      expect(p.metadata.copyright).toBe('Public Domain');

      // 9 slides and 5 sections
      expect(p.slides).toHaveLength(9);
      expect(p.sections).toHaveLength(5);
      expect(p.sections.map((s) => s.name)).toEqual([
        'Verse 1',
        'Verse 2',
        'Chorus',
        'Verse 3',
        'Verse 4',
      ]);

      // Assert lyric texts match exactly across all 9 slides
      for (let i = 0; i < 9; i++) {
        const expectedText = AMAZING_GRACE.slides[i]!.items[0]!.plainText;
        const actualText = p.slides[i]!.items[0]!.plainText;
        expect(actualText).toBe(expectedText);
      }
    });
  });

  describe('Multi-presentation library export and re-import', () => {
    it('serializes and parses multiple presentations within a single FreeShow file', async () => {
      const secondPres: Presentation = {
        id: 'pres-second-song',
        title: 'Second Hymn',
        sourceFormat: 'freeshow',
        metadata: {
          author: 'Charles Wesley',
          ccli: '12345',
          copyright: 'Public Domain',
        },
        sections: [
          {
            id: 'sec-v1',
            name: 'Verse 1',
            slideIds: ['s1-1', 's1-2'],
          },
        ],
        arrangements: [
          {
            id: 'arr-1',
            name: 'Default',
            slideIds: ['s1-1', 's1-2'],
          },
        ],
        slides: [
          {
            id: 's1-1',
            label: 'Slide 1',
            items: [{ type: 'text', plainText: 'Hark! The herald angels sing' }],
          },
          {
            id: 's1-2',
            label: 'Slide 2',
            items: [{ type: 'text', plainText: 'Glory to the newborn King' }],
          },
        ],
        warnings: [],
      };

      const library: Library = {
        presentations: [AMAZING_GRACE, secondPres],
      };

      const writeRes = await writeFreeShow(library);
      expect(writeRes.ok).toBe(true);
      if (!writeRes.ok) return;

      const parseRes = await parseFreeShow(writeRes.value.bytes, 'multi.show');
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      expect(parseRes.value.presentations).toHaveLength(2);

      const p1 = parseRes.value.presentations[0]!;
      const p2 = parseRes.value.presentations[1]!;

      expect(p1.title).toBe('Amazing Grace');
      expect(p1.slides).toHaveLength(9);

      expect(p2.title).toBe('Second Hymn');
      expect(p2.metadata.author).toBe('Charles Wesley');
      expect(p2.metadata.ccli).toBe('12345');
      expect(p2.slides).toHaveLength(2);
      expect(p2.slides[0]!.items[0]!.plainText).toBe('Hark! The herald angels sing');
      expect(p2.slides[1]!.items[0]!.plainText).toBe('Glory to the newborn King');
    });
  });

  describe('Raw JSON representation fallback', () => {
    it('parses raw uncompressed JSON bytes starting with {', async () => {
      const doc = {
        presentations: {
          p1: {
            name: 'Raw JSON Song',
            meta: { title: 'Raw JSON Song', author: 'Test Author', CCLI: '99999' },
            slides: {
              s1: {
                group: 'Verse 1',
                items: [{ lines: [line('Line one of raw JSON song')] }],
              },
            },
            layouts: {
              default: { name: 'Default', slides: [{ id: 's1' }] },
            },
          },
        },
      };

      const jsonStr = JSON.stringify(doc);
      const rawBytes = new TextEncoder().encode(jsonStr);

      const res = await parseFreeShow(rawBytes, 'raw.show');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const p = res.value.presentations[0]!;
      expect(p.title).toBe('Raw JSON Song');
      expect(p.metadata.author).toBe('Test Author');
      expect(p.metadata.ccli).toBe('99999');
      expect(p.slides[0]!.items[0]!.plainText).toBe('Line one of raw JSON song');
    });

    it('parses raw JSON bytes with leading whitespace', async () => {
      const doc = {
        presentations: {
          p1: {
            name: 'Whitespace Song',
            slides: {
              s1: {
                group: 'Chorus',
                items: [{ lines: [line('Chorus line with whitespace')] }],
              },
            },
          },
        },
      };

      const jsonStr = `  \n\t  ${JSON.stringify(doc)}`;
      const rawBytes = new TextEncoder().encode(jsonStr);

      const res = await parseFreeShow(rawBytes);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.presentations[0]!.title).toBe('Whitespace Song');
      expect(res.value.presentations[0]!.slides[0]!.items[0]!.plainText).toBe(
        'Chorus line with whitespace'
      );
    });

    it('fails closed on invalid raw JSON starting with [', async () => {
      const rawBytes = new TextEncoder().encode('[1, 2, 3]');
      const res = await parseFreeShow(rawBytes);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toBeInstanceOf(Error);
    });

    it('fails closed on malformed raw JSON string', async () => {
      const rawBytes = new TextEncoder().encode('{ invalid json here');
      const res = await parseFreeShow(rawBytes);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toBeInstanceOf(Error);
    });
  });

  describe('Fail-closed error handling', () => {
    it('fails closed on empty bytes', async () => {
      const res = await parseFreeShow(new Uint8Array(0));
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toBeInstanceOf(Error);
    });

    it('fails closed on corrupt non-zip non-json bytes', async () => {
      const corrupt = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0xff]);
      const res = await parseFreeShow(corrupt);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toBeInstanceOf(Error);
    });

    it('fails closed on ZIP without .json show document', async () => {
      const writer = new ZipWriter(new Uint8ArrayWriter());
      await writer.add('notes.txt', new TextReader('not a json document'));
      const zipBytes = await writer.close();

      const res = await parseFreeShow(zipBytes);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toBeInstanceOf(Error);
    });

    it('fails closed on ZIP with malformed inner JSON', async () => {
      const zipBytes = await buildShowZip('{ broken json');
      const res = await parseFreeShow(zipBytes);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toBeInstanceOf(Error);
    });

    it('fails closed on document with 0 presentations', async () => {
      const zipBytes = await buildShowZip({ presentations: {} });
      const res = await parseFreeShow(zipBytes);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toBeInstanceOf(Error);
      expect(res.error.message).toContain('no presentations');
    });

    it('fails closed on valid JSON non-object payloads', async () => {
      for (const bad of ['null', '42', '"string"', 'true']) {
        const zipBytes = await buildShowZip(bad);
        const res = await parseFreeShow(zipBytes);
        expect(res.ok, `Expected fail-closed for: ${bad}`).toBe(false);
      }
    });

    it('writeFreeShow fails closed if library has 0 presentations', async () => {
      const res = await writeFreeShow({ presentations: [] });
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toBeInstanceOf(Error);
      expect(res.error.message).toContain('no presentations');
    });
  });

  describe('Fidelity Warnings and Layout Ordering', () => {
    it('emits FREESHOW_STYLES_NOT_EXTRACTED when runs contain style formatting', async () => {
      const styledDoc = {
        presentations: {
          p1: {
            name: 'Styled',
            slides: {
              s1: {
                group: 'Verse',
                items: [
                  {
                    lines: [
                      {
                        align: '',
                        text: [{ value: 'Bold text', style: 'font-weight:bold' }],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      };

      const zipBytes = await buildShowZip(styledDoc);
      const res = await parseFreeShow(zipBytes);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const p = res.value.presentations[0]!;
      const styleWarn = p.warnings.find((w) => w.code === 'FREESHOW_STYLES_NOT_EXTRACTED');
      expect(styleWarn).toBeDefined();
      expect(styleWarn!.severity).toBe('info');
    });

    it('does not emit style warning when styles are empty strings', async () => {
      const unstyledDoc = {
        presentations: {
          p1: {
            name: 'Unstyled',
            slides: {
              s1: {
                group: 'Verse',
                items: [
                  {
                    lines: [
                      {
                        align: '',
                        text: [{ value: 'Plain text', style: '' }],
                      },
                    ],
                  },
                ],
              },
            },
          },
        },
      };

      const zipBytes = await buildShowZip(unstyledDoc);
      const res = await parseFreeShow(zipBytes);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const p = res.value.presentations[0]!;
      expect(p.warnings.some((w) => w.code === 'FREESHOW_STYLES_NOT_EXTRACTED')).toBe(false);
    });

    it('emits FREESHOW_ITEMS_IGNORED when slides contain non-text items', async () => {
      const mediaDoc = {
        presentations: {
          p1: {
            name: 'Media Song',
            slides: {
              s1: {
                group: 'Verse',
                items: [
                  { type: 'media', path: 'background.mp4' },
                  { type: 'text', lines: [line('Song lyrics')] },
                ],
              },
            },
          },
        },
      };

      const zipBytes = await buildShowZip(mediaDoc);
      const res = await parseFreeShow(zipBytes);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const p = res.value.presentations[0]!;
      const itemWarn = p.warnings.find((w) => w.code === 'FREESHOW_ITEMS_IGNORED');
      expect(itemWarn).toBeDefined();
      expect(itemWarn!.severity).toBe('info');
      expect(itemWarn!.context?.itemCount).toBe(1);
    });

    it('emits FREESHOW_NOTES_DROPPED when slides contain presenter notes', async () => {
      const notesDoc = {
        presentations: {
          p1: {
            name: 'Notes Song',
            slides: {
              s1: {
                group: 'Intro',
                notes: 'Leader starts guitar solo',
                items: [{ lines: [line('Intro words')] }],
              },
            },
          },
        },
      };

      const zipBytes = await buildShowZip(notesDoc);
      const res = await parseFreeShow(zipBytes);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const p = res.value.presentations[0]!;
      const notesWarn = p.warnings.find((w) => w.code === 'FREESHOW_NOTES_DROPPED');
      expect(notesWarn).toBeDefined();
      expect(notesWarn!.severity).toBe('info');
      expect(notesWarn!.context?.noteCount).toBe(1);
    });

    it('emits FREESHOW_EMPTY_PRESENTATION when a presentation has no slides', async () => {
      const emptyPresDoc = {
        presentations: {
          p1: {
            name: 'Empty Song',
            slides: {},
          },
          p2: {
            name: 'Valid Song',
            slides: {
              s1: { group: 'Verse', items: [{ lines: [line('Valid')] }] },
            },
          },
        },
      };

      const zipBytes = await buildShowZip(emptyPresDoc);
      const res = await parseFreeShow(zipBytes);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      expect(res.value.presentations).toHaveLength(2);
      const emptyPres = res.value.presentations.find((p) => p.title === 'Empty Song')!;
      expect(emptyPres.warnings.some((w) => w.code === 'FREESHOW_EMPTY_PRESENTATION')).toBe(true);
    });

    it('orders slides according to layouts when layout is defined', async () => {
      const orderedDoc = {
        presentations: {
          p1: {
            name: 'Reordered Song',
            slides: {
              s1: { group: 'V', items: [{ lines: [line('Slide One')] }] },
              s2: { group: 'V', items: [{ lines: [line('Slide Two')] }] },
              s3: { group: 'V', items: [{ lines: [line('Slide Three')] }] },
            },
            layouts: {
              custom: {
                name: 'Custom Order',
                slides: [{ id: 's3' }, { id: 's1' }, { id: 's2' }],
              },
            },
          },
        },
      };

      const zipBytes = await buildShowZip(orderedDoc);
      const res = await parseFreeShow(zipBytes);
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const p = res.value.presentations[0]!;
      expect(p.slides.map((s) => s.items[0]!.plainText)).toEqual([
        'Slide Three',
        'Slide One',
        'Slide Two',
      ]);
    });
  });
});
