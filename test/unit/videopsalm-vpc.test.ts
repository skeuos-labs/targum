import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { TextReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import { describe, expect, it } from 'vitest';
import { AMAZING_GRACE } from '../../src/fixtures/amazing-grace.js';
import {
  parseVpc,
  writeVpc,
  VPC_KEY,
} from '../../src/formats/videopsalm/index.js';
import type { Presentation } from '../../src/canonical/index.js';

const ASSETS_DIR = resolve(
  import.meta.dirname,
  '../../../assets-for-testing-purpose'
);

function readAsset(fileName: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(ASSETS_DIR, fileName)));
}

describe('VideoPsalm VPC Archive Reader & Writer', () => {
  describe('Exports and Key', () => {
    it('exports parseVpc, writeVpc and VPC_KEY', () => {
      expect(typeof parseVpc).toBe('function');
      expect(typeof writeVpc).toBe('function');
      expect(typeof VPC_KEY).toBe('string');
      expect(VPC_KEY.length).toBeGreaterThan(50);
      expect(VPC_KEY).toBe(
        String.raw`5$l(va\7N_0!',/:5?M0.(d_<8+5!Um2#~M@{5#2(C3]$'f|#:Y/}wG+-)Nt:x^8!Y.5Eq$)'7stk$y)\.~Tg=&<l`
      );
    });
  });

  describe('parseVpc: Real fixture archives', () => {
    it('parses Cevam.vpc (1 song, 47 slides)', async () => {
      const bytes = readAsset('Cevam.vpc');
      const res = await parseVpc(bytes, 'Cevam.vpc');

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const { presentations } = res.value;
      expect(presentations).toHaveLength(1);

      const song = presentations[0]!;
      expect(song.title).toBe('IZY');
      expect(song.sourceFormat).toBe('vpc');
      expect(song.metadata.originalFileName).toBe('Cevam.vpc');
      expect(song.slides).toHaveLength(47);

      const firstSlideText = song.slides[0]!.items[0]!.plainText;
      expect(firstSlideText).toContain("Izy mamatsy ahy isan'andro");
    });

    it('parses façade.vpc (19 songs, 273 slides)', async () => {
      const bytes = readAsset('façade.vpc');
      const res = await parseVpc(bytes, 'façade.vpc');

      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const { presentations } = res.value;
      expect(presentations).toHaveLength(19);

      for (const song of presentations) {
        expect(song.sourceFormat).toBe('vpc');
        expect(song.slides.length).toBeGreaterThan(0);
      }

      const totalSlides = presentations.reduce(
        (sum, p) => sum + p.slides.length,
        0
      );
      expect(totalSlides).toBe(273);

      const titles = presentations.map((p) => p.title);
      expect(titles).toContain('Mendrika Ianao');
      expect(titles).toContain('Majesté');
      expect(titles).toContain('You raise me up');
    });
  });

  describe('writeVpc & Roundtrip: AMAZING_GRACE', () => {
    it('writes AMAZING_GRACE and roundtrips via parseVpc', async () => {
      const writeRes = await writeVpc([AMAZING_GRACE]);
      expect(writeRes.ok).toBe(true);
      if (!writeRes.ok) return;

      const { bytes, warnings } = writeRes.value;
      expect(bytes).toBeInstanceOf(Uint8Array);
      expect(bytes.length).toBeGreaterThan(0);

      // Should have info warnings for unmapped verse sections (Verse 1, 2, 3, 4)
      const unmappedWarnings = warnings.filter(
        (w) => w.code === 'VPC_TAG_UNMAPPED'
      );
      expect(unmappedWarnings.length).toBeGreaterThanOrEqual(1);

      // Re-parse with parseVpc
      const parseRes = await parseVpc(bytes, 'Amazing Grace.vpc');
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const { presentations } = parseRes.value;
      expect(presentations).toHaveLength(1);

      const song = presentations[0]!;
      expect(song.title).toBe(AMAZING_GRACE.title);
      expect(song.slides).toHaveLength(AMAZING_GRACE.slides.length);

      // Compare slide lyrics in order
      for (let i = 0; i < song.slides.length; i++) {
        expect(song.slides[i]!.items[0]!.plainText).toBe(
          AMAZING_GRACE.slides[i]!.items[0]!.plainText
        );
      }

      // Assert sections preserved
      const sectionNames = song.sections.map((s) => s.name);
      expect(sectionNames).toEqual([
        'Verse 1',
        'Verse 2',
        'Chorus',
        'Verse 3',
        'Verse 4',
      ]);

      // Assert slide counts per section
      expect(song.sections[0]!.slideIds).toHaveLength(2); // Verse 1
      expect(song.sections[1]!.slideIds).toHaveLength(2); // Verse 2
      expect(song.sections[2]!.slideIds).toHaveLength(1); // Chorus
      expect(song.sections[3]!.slideIds).toHaveLength(2); // Verse 3
      expect(song.sections[4]!.slideIds).toHaveLength(2); // Verse 4
    });

    it('writes and roundtrips multi-presentation library', async () => {
      const secondPresentation: Presentation = {
        ...AMAZING_GRACE,
        id: 'pres-second-hymn',
        title: 'Second Test Hymn',
        metadata: {
          ...AMAZING_GRACE.metadata,
          author: 'Another Author',
        },
        sections: [
          {
            id: 'sec-intro',
            name: 'Intro',
            slideIds: ['sec-intro-1'],
          },
          {
            id: 'sec-chorus',
            name: 'Chorus',
            slideIds: ['sec-chorus-1'],
          },
        ],
        slides: [
          {
            id: 'sec-intro-1',
            label: 'Intro',
            items: [{ type: 'text', plainText: 'Instrumental intro lyrics' }],
          },
          {
            id: 'sec-chorus-1',
            label: 'Chorus',
            items: [{ type: 'text', plainText: 'Great is Thy faithfulness' }],
          },
        ],
      };

      const writeRes = await writeVpc([AMAZING_GRACE, secondPresentation]);
      expect(writeRes.ok).toBe(true);
      if (!writeRes.ok) return;

      const parseRes = await parseVpc(writeRes.value.bytes, 'multi-songbook.vpc');
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const { presentations } = parseRes.value;
      expect(presentations).toHaveLength(2);
      expect(presentations[0]!.title).toBe('Amazing Grace');
      expect(presentations[1]!.title).toBe('Second Test Hymn');
      expect(presentations[1]!.slides).toHaveLength(2);
      expect(presentations[1]!.slides[0]!.items[0]!.plainText).toBe(
        'Instrumental intro lyrics'
      );
      expect(presentations[1]!.slides[1]!.items[0]!.plainText).toBe(
        'Great is Thy faithfulness'
      );
    });
  });

  describe('Error handling / Fail closed', () => {
    it('fails closed when writing empty presentation array', async () => {
      const res = await writeVpc([]);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeInstanceOf(Error);
        expect(res.error.message).toBe(
          'Cannot write a VPC library with no presentations.'
        );
      }
    });

    it('fails closed when parsing empty Uint8Array', async () => {
      const res = await parseVpc(new Uint8Array(0));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeInstanceOf(Error);
      }
    });

    it('fails closed when parsing non-ZIP corrupt bytes', async () => {
      const garbage = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const res = await parseVpc(garbage);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeInstanceOf(Error);
      }
    });

    it('fails closed when parsing truncated ZIP archive', async () => {
      const bytes = readAsset('Cevam.vpc');
      const truncated = bytes.subarray(0, 100);
      const res = await parseVpc(truncated);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeInstanceOf(Error);
      }
    });

    it('skips __MACOSX and ._ AppleDouble metadata entries in VPC ZIP', async () => {
      const validSongbook = JSON.stringify({
        Songs: [
          {
            Guid: 'test-song',
            Text: 'Test Song',
            Verses: [{ Tag: 1, Text: 'Lyric verse' }],
          },
        ],
      });

      const zipWriter = new ZipWriter(new Uint8ArrayWriter(), {
        password: VPC_KEY,
        encryptionStrength: 1,
      });
      await zipWriter.add('__MACOSX/._song.json', new TextReader('corrupt metadata'));
      await zipWriter.add('song.json', new TextReader(validSongbook));
      const bytes = await zipWriter.close();

      const res = await parseVpc(bytes);
      expect(res.ok).toBe(true);
      if (!res.ok) return;
      expect(res.value.presentations[0]!.title).toBe('Test Song');
    });

    it('fails closed when VPC ZIP contains only AppleDouble metadata JSON files', async () => {
      const zipWriter = new ZipWriter(new Uint8ArrayWriter(), {
        password: VPC_KEY,
        encryptionStrength: 1,
      });
      await zipWriter.add('__MACOSX/._song.json', new TextReader('corrupt metadata'));
      await zipWriter.add('._metadata.json', new TextReader('corrupt metadata'));
      const bytes = await zipWriter.close();

      const res = await parseVpc(bytes);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error.message).toContain('No JSON entry found in VideoPsalm VPC archive');
    });

    it('writeVpc catches malformed presentation preprocessing exceptions and returns ok: false', async () => {
      const malformedPres = {
        ...AMAZING_GRACE,
        slides: null as unknown as Presentation['slides'],
      };
      const res = await writeVpc([malformedPres as unknown as Presentation]);
      expect(res.ok).toBe(false);
      if (res.ok) return;
      expect(res.error).toBeInstanceOf(Error);
    });
  });
});
