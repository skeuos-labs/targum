import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  decodeRtf,
  decodeRtfBytes,
  encodeRtf,
  getProtoRoot,
  parsePro,
} from '../../src/formats/propresenter/index.js';

const ASSETS_DIR = resolve(
  import.meta.dirname,
  '../../../../../assets-for-testing-purpose'
);

function readAsset(fileName: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(ASSETS_DIR, fileName)));
}

function rtfBytes(text: string): Uint8Array {
  const rtf = `{\\rtf1\\ansi ${text.replace(/\n/g, '\\par ')}}`;
  return new TextEncoder().encode(rtf);
}

function cue(uuid: string, name: string, text: string) {
  return {
    uuid: { string: uuid },
    name,
    actions: [
      {
        uuid: { string: `${uuid}-action` },
        slide: {
          presentation: {
            baseSlide: {
              uuid: { string: `${uuid}-base` },
              elements: [
                {
                  element: {
                    uuid: { string: `${uuid}-el` },
                    name: 'Text Element',
                    text: { rtfData: rtfBytes(text) },
                  },
                },
              ],
            },
          },
        },
      },
    ],
  };
}

function group(uuid: string, name: string, cueIds: string[]) {
  return {
    group: { uuid: { string: uuid }, name },
    cueIdentifiers: cueIds.map((id) => ({ string: id })),
  };
}

describe('ProPresenter 7 Protobuf Reader', () => {
  describe('Exports', () => {
    it('exports all expected functions from index', () => {
      expect(typeof parsePro).toBe('function');
      expect(typeof getProtoRoot).toBe('function');
      expect(typeof encodeRtf).toBe('function');
      expect(typeof decodeRtf).toBe('function');
      expect(typeof decodeRtfBytes).toBe('function');
    });

    it('returns a valid protobuf Root from getProtoRoot', () => {
      const root = getProtoRoot();
      expect(root).toBeDefined();
      const Presentation = root.lookupType('Presentation');
      expect(Presentation).toBeDefined();
    });
  });

  describe('Real .pro fixtures', () => {
    it('parses IZY-original.pro faithfully', () => {
      const bytes = readAsset('IZY-original.pro');
      const result = parsePro(bytes, 'IZY-original.pro');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const presentation = result.value;
      expect(presentation.sourceFormat).toBe('pro');
      expect(presentation.title).toBe('IZY');
      expect(presentation.slides.length).toBeGreaterThan(0);
      expect(presentation.sections.length).toBeGreaterThan(0);
      expect(presentation.arrangements.length).toBeGreaterThan(0);

      const allSlideText = presentation.slides
        .map((s) => s.items[0]?.plainText)
        .join(' ');
      expect(allSlideText.length).toBeGreaterThan(0);
    });

    it('parses Androany aloha.pro faithfully', () => {
      const bytes = readAsset('Androany aloha.pro');
      const result = parsePro(bytes, 'Androany aloha.pro');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const presentation = result.value;
      expect(presentation.sourceFormat).toBe('pro');
      expect(presentation.title).toBe('Androany aloha');
      expect(presentation.slides.length).toBeGreaterThan(0);
      expect(presentation.sections.length).toBeGreaterThan(0);

      // Verify each slide has a text item with non-empty content
      for (const slide of presentation.slides) {
        expect(slide.items.length).toBeGreaterThan(0);
        expect(slide.items[0]?.type).toBe('text');
      }
    });

    it('parses Thank You Jesus for The Blood.pro faithfully', () => {
      const bytes = readAsset('Thank You Jesus for The Blood.pro');
      const result = parsePro(bytes, 'Thank You Jesus for The Blood.pro');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const presentation = result.value;
      expect(presentation.sourceFormat).toBe('pro');
      expect(presentation.title).toBe('Thank You Jesus for The Blood');
      expect(presentation.slides.length).toBeGreaterThan(0);
      expect(presentation.sections.length).toBeGreaterThan(0);
      expect(presentation.arrangements.length).toBeGreaterThan(0);

      // Verify CCLI or author metadata if present
      expect(presentation.metadata.originalFileName).toBe(
        'Thank You Jesus for The Blood.pro'
      );
    });
  });

  describe('Error handling', () => {
    it('fails closed on empty byte array', () => {
      const result = parsePro(new Uint8Array(0));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    it('fails closed on corrupt / invalid bytes', () => {
      const corrupt = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe, 0xfd]);
      const result = parsePro(corrupt);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
      }
    });

    it('fails closed on wire-valid presentation with no cues and no groups', () => {
      const Presentation = getProtoRoot().lookupType('Presentation');
      const emptyMsg = Presentation.create({ name: 'Empty' });
      const bytes = Presentation.encode(emptyMsg).finish();

      const result = parsePro(bytes, 'Empty.pro');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toMatch(/no cues/i);
      }
    });
  });

  describe('Structural mapping', () => {
    function encodePresentation(obj: unknown): Uint8Array {
      const Presentation = getProtoRoot().lookupType('Presentation');
      return Presentation.encode(Presentation.fromObject(obj)).finish();
    }

    it('maps cueGroups to sections and cues to slides', () => {
      const bytes = encodePresentation({
        name: 'Test Song',
        cues: [
          cue('c1', 'Slide 1', 'Line one'),
          cue('c2', 'Slide 2', 'Line two'),
        ],
        cueGroups: [group('g1', 'Verse 1', ['c1', 'c2'])],
      });

      const result = parsePro(bytes, 'test.pro');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.title).toBe('Test Song');
      expect(result.value.sections).toHaveLength(1);
      expect(result.value.sections[0]?.name).toBe('Verse 1');
      expect(result.value.sections[0]?.slideIds).toHaveLength(2);
      expect(result.value.slides).toHaveLength(2);
      expect(result.value.slides.map((s) => s.items[0]?.plainText)).toEqual([
        'Line one',
        'Line two',
      ]);
    });

    it('imports orphan cues with PRO_ORPHAN_CUE warning', () => {
      const bytes = encodePresentation({
        name: 'Orphan Song',
        cues: [
          cue('c1', 'Slide 1', 'Grouped'),
          cue('c2', 'Slide 2', 'Orphaned'),
        ],
        cueGroups: [group('g1', 'Chorus', ['c1'])],
      });

      const result = parsePro(bytes);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.slides).toHaveLength(2);
      expect(
        result.value.warnings.some((w) => w.code === 'PRO_ORPHAN_CUE')
      ).toBe(true);
    });

    it('flattens selected arrangement group order into slide order', () => {
      const bytes = encodePresentation({
        name: 'Arranged',
        cues: [
          cue('c1', 'S1', 'one'),
          cue('c2', 'S2', 'two'),
          cue('c3', 'S3', 'three'),
        ],
        cueGroups: [
          group('gA', 'A', ['c1']),
          group('gB', 'B', ['c2', 'c3']),
        ],
        arrangements: [
          {
            uuid: { string: 'arr2' },
            name: 'Reversed',
            groupIdentifiers: [{ string: 'gB' }, { string: 'gA' }],
          },
          {
            uuid: { string: 'arr1' },
            name: 'Forward',
            groupIdentifiers: [{ string: 'gA' }, { string: 'gB' }],
          },
        ],
        selectedArrangement: { string: 'arr2' },
      });

      const result = parsePro(bytes);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.arrangements).toHaveLength(1);
      const arrangement = result.value.arrangements[0]!;
      expect(arrangement.name).toBe('Reversed');
      const texts = arrangement.slideIds.map(
        (id) => result.value.slides.find((s) => s.id === id)?.items[0]?.plainText
      );
      expect(texts).toEqual(['two', 'three', 'one']);
    });

    it('warns with PRO_ARRANGEMENT_OMITS_SLIDE when arrangement omits slides', () => {
      const bytes = encodePresentation({
        name: 'Partial',
        cues: [cue('c1', 'S1', 'one'), cue('c2', 'S2', 'two')],
        cueGroups: [group('gA', 'A', ['c1']), group('gB', 'B', ['c2'])],
        arrangements: [
          {
            uuid: { string: 'arr1' },
            name: 'A only',
            groupIdentifiers: [{ string: 'gA' }],
          },
        ],
        selectedArrangement: { string: 'arr1' },
      });

      const result = parsePro(bytes);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(
        result.value.warnings.some(
          (w) => w.code === 'PRO_ARRANGEMENT_OMITS_SLIDE'
        )
      ).toBe(true);
    });

    it('falls back to section order when arrangement has no groupIdentifiers', () => {
      const bytes = encodePresentation({
        name: 'Fallback',
        cues: [cue('c1', 'S1', 'one'), cue('c2', 'S2', 'two')],
        cueGroups: [group('gA', 'A', ['c1']), group('gB', 'B', ['c2'])],
        arrangements: [
          {
            uuid: { string: 'arr1' },
            name: 'EmptyArr',
            groupIdentifiers: [],
          },
        ],
        selectedArrangement: { string: 'arr1' },
      });

      const result = parsePro(bytes);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.arrangements[0]?.slideIds).toHaveLength(2);
    });

    it('extracts metadata: notes, CCLI, copyright, author, section color', () => {
      const bytes = encodePresentation({
        name: 'Full Meta',
        notes: 'Tech team notes',
        ccli: {
          author: 'Chris Tomlin',
          songNumber: 123456,
          copyrightYear: 2020,
        },
        cues: [cue('c1', 'S1', 'Verse')],
        cueGroups: [
          {
            group: {
              uuid: { string: 'g1' },
              name: 'Verse',
              color: { red: 0.2, green: 0.4, blue: 0.8, alpha: 1 },
            },
            cueIdentifiers: [{ string: 'c1' }],
          },
        ],
      });

      const result = parsePro(bytes, 'song.pro');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.metadata.notes).toBe('Tech team notes');
      expect(result.value.metadata.author).toBe('Chris Tomlin');
      expect(result.value.metadata.ccli).toBe('123456');
      expect(result.value.metadata.copyright).toBe('2020');
      expect(result.value.metadata.originalFileName).toBe('song.pro');
      expect(result.value.sections[0]?.color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});
