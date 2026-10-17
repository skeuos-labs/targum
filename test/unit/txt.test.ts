import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Library } from '../../src/canonical/index.js';
import { AMAZING_GRACE } from '../../src/fixtures/amazing-grace.js';
import { parseTxt, writeTxt } from '../../src/formats/txt/index.js';

const ASSETS_DIR = resolve(
  import.meta.dirname,
  '../../../assets-for-testing-purpose'
);

function readAsset(fileName: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(ASSETS_DIR, fileName)));
}

describe('TXT Lyric Marker Codec', () => {
  describe('Exports', () => {
    it('exports parseTxt and writeTxt functions', () => {
      expect(typeof parseTxt).toBe('function');
      expect(typeof writeTxt).toBe('function');
    });
  });

  describe('parseTxt: Real fixture IZY.txt', () => {
    it('parses ../assets-for-testing-purpose/IZY.txt (lyrics, sections, slide splits)', () => {
      const bytes = readAsset('IZY.txt');
      const res = parseTxt(bytes, 'IZY.txt');

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const { presentations } = res.value;
      expect(presentations).toHaveLength(1);

      const song = presentations[0]!;
      expect(song.sourceFormat).toBe('txt');
      expect(song.metadata.originalFileName).toBe('IZY.txt');

      // Markerless lyric file placed in single "Verse" section
      expect(song.sections).toHaveLength(1);
      expect(song.sections[0]!.name).toBe('Verse');

      // Slide splits by blank lines
      expect(song.slides.length).toBeGreaterThan(40);
      const allText = song.slides
        .map((s) => s.items.map((i) => i.plainText).join('\n'))
        .join('\n');
      expect(allText).toContain('Jehovah Jireh');
      expect(allText).toContain('Jehovah Rapha');
      expect(allText).toContain('Jehovah Shalom');

      // Each slide has valid text item
      for (const slide of song.slides) {
        expect(slide.items.length).toBeGreaterThan(0);
        expect(slide.items[0]!.type).toBe('text');
        expect(slide.items[0]!.plainText.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe('parseTxt: Marker syntax with standard names', () => {
    it('parses standard section markers [Verse 1], [Chorus], and [Bridge]', () => {
      const text = [
        'Song of Hope',
        '',
        '[Verse 1]',
        'First verse line 1',
        'First verse line 2',
        '',
        'First verse slide 2',
        '',
        '[Chorus]',
        'Chorus slide line',
        '',
        '[Bridge]',
        'Bridge slide line',
      ].join('\n');

      const res = parseTxt(new TextEncoder().encode(text), 'Song.txt');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const song = res.value.presentations[0]!;
      expect(song.title).toBe('Song of Hope');
      expect(song.sections.map((s) => s.name)).toEqual([
        'Verse 1',
        'Chorus',
        'Bridge',
      ]);

      expect(song.sections[0]!.slideIds).toHaveLength(2);
      expect(song.sections[1]!.slideIds).toHaveLength(1);
      expect(song.sections[2]!.slideIds).toHaveLength(1);
      expect(song.slides).toHaveLength(4);

      expect(song.slides[0]!.items[0]!.plainText).toBe(
        'First verse line 1\nFirst verse line 2'
      );
      expect(song.slides[1]!.items[0]!.plainText).toBe('First verse slide 2');
      expect(song.slides[2]!.items[0]!.plainText).toBe('Chorus slide line');
      expect(song.slides[3]!.items[0]!.plainText).toBe('Bridge slide line');
    });

    it('falls back to fileName without extension if no title line is present', () => {
      const text = [
        '[Verse 1]',
        'Line in verse 1',
      ].join('\n');

      const res = parseTxt(new TextEncoder().encode(text), 'MyTrack.txt');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const song = res.value.presentations[0]!;
      expect(song.title).toBe('MyTrack');
      expect(song.sections.map((s) => s.name)).toEqual(['Verse 1']);
    });

    it('rejects whitespace-only marker [   ] as section header', () => {
      const text = [
        'Title',
        '',
        '[   ]',
        'Slide 1',
      ].join('\n');

      const res = parseTxt(new TextEncoder().encode(text), 'test.txt');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const song = res.value.presentations[0]!;
      expect(song.sections[0]!.name).toBe('Verse');
    });
  });

  describe('parseTxt: Blank line slide splitting', () => {
    it('splits multiple slides by single and multiple blank lines', () => {
      const text = [
        'Title',
        '',
        '[Verse]',
        'Slide 1',
        '',
        '',
        'Slide 2 line 1',
        'Slide 2 line 2',
        '',
        'Slide 3',
      ].join('\n');

      const res = parseTxt(new TextEncoder().encode(text), 'test.txt');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const song = res.value.presentations[0]!;
      expect(song.slides).toHaveLength(3);
      expect(song.slides[0]!.items[0]!.plainText).toBe('Slide 1');
      expect(song.slides[1]!.items[0]!.plainText).toBe(
        'Slide 2 line 1\nSlide 2 line 2'
      );
      expect(song.slides[2]!.items[0]!.plainText).toBe('Slide 3');
    });

    it('handles CRLF line endings cleanly', () => {
      const text = 'Title\r\n\r\n[Verse 1]\r\nSlide A\r\n\r\nSlide B\r\n';
      const res = parseTxt(new TextEncoder().encode(text), 'crlf.txt');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const song = res.value.presentations[0]!;
      expect(song.title).toBe('Title');
      expect(song.slides).toHaveLength(2);
      expect(song.slides[0]!.items[0]!.plainText).toBe('Slide A');
      expect(song.slides[1]!.items[0]!.plainText).toBe('Slide B');
    });

    it('does not eat line 1 as title in multiline markerless files', () => {
      const text = [
        'Verse 1 line 1',
        'Verse 1 line 2',
        '',
        'Verse 1 slide 2',
      ].join('\n');

      const res = parseTxt(new TextEncoder().encode(text), 'Song.txt');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const song = res.value.presentations[0]!;
      expect(song.title).toBe('Song');
      expect(song.sections).toHaveLength(1);
      expect(song.sections[0]!.name).toBe('Verse');
      expect(song.slides).toHaveLength(2);
      expect(song.slides[0]!.items[0]!.plainText).toBe(
        'Verse 1 line 1\nVerse 1 line 2'
      );
      expect(song.slides[1]!.items[0]!.plainText).toBe('Verse 1 slide 2');
    });
  });

  describe('parseTxt: Preserving marker-started empty sections', () => {
    it('preserves consecutive empty sections intact', () => {
      const text = [
        'Title',
        '',
        '[Intro]',
        '[Verse 1]',
        'Verse 1 lyrics',
        '',
        '[Chorus]',
        '[Bridge]',
        'Bridge lyrics',
        '',
        '[Outro]',
      ].join('\n');

      const res = parseTxt(new TextEncoder().encode(text), 'empty-secs.txt');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const song = res.value.presentations[0]!;
      expect(song.sections.map((s) => s.name)).toEqual([
        'Intro',
        'Verse 1',
        'Chorus',
        'Bridge',
        'Outro',
      ]);

      const intro = song.sections.find((s) => s.name === 'Intro')!;
      const chorus = song.sections.find((s) => s.name === 'Chorus')!;
      const outro = song.sections.find((s) => s.name === 'Outro')!;

      expect(intro.slideIds).toEqual([]);
      expect(chorus.slideIds).toEqual([]);
      expect(outro.slideIds).toEqual([]);

      const v1 = song.sections.find((s) => s.name === 'Verse 1')!;
      expect(v1.slideIds).toHaveLength(1);

      const bridge = song.sections.find((s) => s.name === 'Bridge')!;
      expect(bridge.slideIds).toHaveLength(1);
    });

    it('preserves empty [Verse] section when explicitly started by marker', () => {
      const text = [
        '[Verse]',
        '[Chorus]',
        'Some lyrics',
      ].join('\n');

      const res = parseTxt(new TextEncoder().encode(text), 'test.txt');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const song = res.value.presentations[0]!;
      expect(song.sections.map((s) => s.name)).toEqual(['Verse', 'Chorus']);
      expect(song.sections[0]!.slideIds).toEqual([]);
      expect(song.sections[1]!.slideIds).toHaveLength(1);
      expect(song.slides).toHaveLength(1);
      expect(song.slides[0]!.items[0]!.plainText).toBe('Some lyrics');
    });
  });

  describe('writeTxt & AMAZING_GRACE Round-Trip', () => {
    it('serializes AMAZING_GRACE and re-imports with matching title, slide texts, and section markers', () => {
      const library: Library = {
        presentations: [AMAZING_GRACE],
      };

      const writeRes = writeTxt(library);
      expect(writeRes.ok).toBe(true);
      if (!writeRes.ok) return;

      expect(writeRes.bytes).toBeInstanceOf(Uint8Array);
      expect(writeRes.bytes.byteLength).toBeGreaterThan(0);

      const text = new TextDecoder().decode(writeRes.bytes);
      expect(text).toContain('Amazing Grace');
      expect(text).toContain('[Verse 1]');
      expect(text).toContain('[Verse 2]');
      expect(text).toContain('[Chorus]');
      expect(text).toContain('[Verse 3]');
      expect(text).toContain('[Verse 4]');

      const parseRes = parseTxt(writeRes.bytes, 'Amazing Grace.txt');
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const p = parseRes.value.presentations[0]!;
      expect(p.title).toBe(AMAZING_GRACE.title);

      // Metadata match
      expect(p.metadata.author).toBe(AMAZING_GRACE.metadata.author);
      expect(p.metadata.ccli).toBe(AMAZING_GRACE.metadata.ccli);
      expect(p.metadata.copyright).toBe(AMAZING_GRACE.metadata.copyright);

      // Section markers match
      expect(p.sections.map((s) => s.name)).toEqual(
        AMAZING_GRACE.sections.map((s) => s.name)
      );

      // Slide texts match exactly
      expect(p.slides).toHaveLength(AMAZING_GRACE.slides.length);
      for (let i = 0; i < AMAZING_GRACE.slides.length; i++) {
        const expected = AMAZING_GRACE.slides[i]!.items[0]?.plainText;
        const actual = p.slides[i]!.items[0]?.plainText;
        expect(actual).toBe(expected);
      }
    });
  });

  describe('Fails closed on invalid inputs', () => {
    it('fails closed on empty bytes', () => {
      const res = parseTxt(new Uint8Array(0), 'empty.txt');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeInstanceOf(Error);
      }
    });

    it('fails closed on whitespace-only input', () => {
      const res = parseTxt(
        new TextEncoder().encode('   \n  \t  \r\n  \n'),
        'whitespace.txt'
      );
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeInstanceOf(Error);
      }
    });

    it('fails closed on write with empty presentations library', () => {
      const res = writeTxt({ presentations: [] });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeInstanceOf(Error);
      }
    });

    it('fails closed on write with multi-presentation library', () => {
      const res = writeTxt({
        presentations: [AMAZING_GRACE, AMAZING_GRACE],
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeInstanceOf(Error);
      }
    });
  });
});
