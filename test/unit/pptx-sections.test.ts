import { describe, expect, it } from 'vitest';
import {
  TextWriter,
  Uint8ArrayReader,
  ZipReader,
} from '@zip.js/zip.js';
import type { Library, Presentation } from '../../src/canonical/index.js';
import { parsePptx, writePptx } from '../../src/formats/pptx/index.js';

function createMockSong(
  title: string,
  metadata: { author?: string; ccli?: string; copyright?: string },
  slideTexts: string[]
): Presentation {
  const slideIds = slideTexts.map((_, i) => `slide-${title.toLowerCase().replace(/\s+/g, '-')}-${i + 1}`);
  return {
    id: `pres-${title.toLowerCase().replace(/\s+/g, '-')}`,
    title,
    sourceFormat: 'pptx',
    metadata,
    sections: [
      {
        id: `sec-${title.toLowerCase().replace(/\s+/g, '-')}`,
        name: 'Default',
        slideIds,
      },
    ],
    arrangements: [
      {
        id: `arr-${title.toLowerCase().replace(/\s+/g, '-')}`,
        name: 'Default',
        slideIds,
      },
    ],
    slides: slideTexts.map((text, i) => ({
      id: slideIds[i]!,
      label: `Slide ${i + 1}`,
      items: [
        {
          type: 'text',
          plainText: text,
        },
      ],
    })),
    warnings: [],
  };
}

describe('PowerPoint Multi-Song Sections and Title Slides', () => {
  const song1 = createMockSong(
    'Amazing Grace',
    { author: 'John Newton', ccli: '27136', copyright: 'Public Domain' },
    [
      'Amazing grace! How sweet the sound\nThat saved a wretch like me!',
      "'Twas grace that taught my heart to fear,\nAnd grace my fears relieved;",
      'Through many dangers, toils and snares,\nI have already come;',
    ]
  );

  const song2 = createMockSong(
    'How Great Thou Art',
    { author: 'Stuart K. Hine', ccli: '14181', copyright: '1949 Stuart K. Hine' },
    [
      'O Lord, my God, when I in awesome wonder\nConsider all the worlds Thy Hands have made',
      'Then sings my soul, my Saviour God, to Thee,\nHow great Thou art, how great Thou art!',
    ]
  );

  it('writes multi-presentation library producing valid OpenXML sections in presentation.xml', async () => {
    const multiLibrary: Library = {
      presentations: [song1, song2],
    };

    const writeRes = await writePptx(multiLibrary);
    expect(writeRes.ok).toBe(true);
    if (!writeRes.ok) return;

    expect(writeRes.bytes).toBeInstanceOf(Uint8Array);
    expect(writeRes.bytes.byteLength).toBeGreaterThan(0);

    // Inspect zip contents
    const zipReader = new ZipReader(new Uint8ArrayReader(writeRes.bytes));
    const entries = await zipReader.getEntries();

    const presentationEntry = entries.find((e) => e.filename === 'ppt/presentation.xml');
    expect(presentationEntry).toBeDefined();

    const presXml = (await presentationEntry!.getData(new TextWriter())) as string;
    await zipReader.close();

    // Verify p14:sectionLst structure
    expect(presXml).toContain('p14:sectionLst');
    expect(presXml).toContain('xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main"');
    expect(presXml).toContain('name="Amazing Grace"');
    expect(presXml).toContain('name="How Great Thou Art"');
    expect(presXml).toMatch(/<p14:section\s+name="Amazing Grace"\s+id="\{[A-F0-9-]+\}"/i);
    expect(presXml).toMatch(/<p14:section\s+name="How Great Thou Art"\s+id="\{[A-F0-9-]+\}"/i);

    // Total slides: 1 title + 3 lyrics (song 1) + 1 title + 2 lyrics (song 2) = 7 slides
    const slideEntries = entries.filter((e) => /^ppt\/slides\/slide\d+\.xml$/i.test(e.filename));
    expect(slideEntries).toHaveLength(7);
  });

  it('formats title slides with 44pt bold title and 20pt subtitle with metadata', async () => {
    const multiLibrary: Library = {
      presentations: [song1, song2],
    };

    const writeRes = await writePptx(multiLibrary);
    expect(writeRes.ok).toBe(true);
    if (!writeRes.ok) return;

    const zipReader = new ZipReader(new Uint8ArrayReader(writeRes.bytes));
    const entries = await zipReader.getEntries();

    // Slide 1 is Song 1 title slide
    const slide1Entry = entries.find((e) => e.filename === 'ppt/slides/slide1.xml');
    expect(slide1Entry).toBeDefined();
    const slide1Xml = (await slide1Entry!.getData(new TextWriter())) as string;

    expect(slide1Xml).toContain('sz="4400"');
    expect(slide1Xml).toContain('b="1"');
    expect(slide1Xml).toContain('Amazing Grace');
    expect(slide1Xml).toContain('sz="2000"');
    expect(slide1Xml).toContain('Author: John Newton');
    expect(slide1Xml).toContain('CCLI: 27136');
    expect(slide1Xml).toContain('Copyright: Public Domain');

    // Slide 2 is Song 1 lyric slide (32pt regular)
    const slide2Entry = entries.find((e) => e.filename === 'ppt/slides/slide2.xml');
    expect(slide2Entry).toBeDefined();
    const slide2Xml = (await slide2Entry!.getData(new TextWriter())) as string;

    expect(slide2Xml).toContain('sz="3200"');
    expect(slide2Xml).toContain('Amazing grace! How sweet the sound');

    // Slide 5 is Song 2 title slide (1 + 3 + 1 = 5)
    const slide5Entry = entries.find((e) => e.filename === 'ppt/slides/slide5.xml');
    expect(slide5Entry).toBeDefined();
    const slide5Xml = (await slide5Entry!.getData(new TextWriter())) as string;

    expect(slide5Xml).toContain('sz="4400"');
    expect(slide5Xml).toContain('b="1"');
    expect(slide5Xml).toContain('How Great Thou Art');
    expect(slide5Xml).toContain('sz="2000"');
    expect(slide5Xml).toContain('Author: Stuart K. Hine');
    expect(slide5Xml).toContain('CCLI: 14181');

    await zipReader.close();
  });

  it('roundtrips multi-song presentation via writePptx -> parsePptx with full fidelity', async () => {
    const multiLibrary: Library = {
      presentations: [song1, song2],
    };

    const writeRes = await writePptx(multiLibrary);
    expect(writeRes.ok).toBe(true);
    if (!writeRes.ok) return;

    const parseRes = await parsePptx(writeRes.bytes, 'CombinedService.pptx');
    expect(parseRes.ok).toBe(true);
    if (!parseRes.ok) return;

    const { presentations } = parseRes.value;
    expect(presentations).toHaveLength(2);

    // Presentation 1 verification
    const parsedSong1 = presentations[0]!;
    expect(parsedSong1.title).toBe('Amazing Grace');
    expect(parsedSong1.sourceFormat).toBe('pptx');
    expect(parsedSong1.metadata.author).toBe('John Newton');
    expect(parsedSong1.metadata.ccli).toBe('27136');
    expect(parsedSong1.metadata.copyright).toBe('Public Domain');
    expect(parsedSong1.slides).toHaveLength(3);
    for (let i = 0; i < song1.slides.length; i++) {
      expect(parsedSong1.slides[i]!.items[0]?.plainText).toBe(song1.slides[i]!.items[0]?.plainText);
    }

    // Presentation 2 verification
    const parsedSong2 = presentations[1]!;
    expect(parsedSong2.title).toBe('How Great Thou Art');
    expect(parsedSong2.sourceFormat).toBe('pptx');
    expect(parsedSong2.metadata.author).toBe('Stuart K. Hine');
    expect(parsedSong2.metadata.ccli).toBe('14181');
    expect(parsedSong2.metadata.copyright).toBe('1949 Stuart K. Hine');
    expect(parsedSong2.slides).toHaveLength(2);
    for (let i = 0; i < song2.slides.length; i++) {
      expect(parsedSong2.slides[i]!.items[0]?.plainText).toBe(song2.slides[i]!.items[0]?.plainText);
    }
  });

  it('keeps single-slide section as lyric slide without dropping content', async () => {
    const singleSlideSong = createMockSong(
      'Doxology',
      { author: 'Thomas Ken' },
      ['Praise God from whom all blessings flow;\nPraise Him, all creatures here below;']
    );

    const multiLibrary: Library = {
      presentations: [song1, singleSlideSong],
    };

    const writeRes = await writePptx(multiLibrary);
    expect(writeRes.ok).toBe(true);
    if (!writeRes.ok) return;

    const parseRes = await parsePptx(writeRes.bytes);
    expect(parseRes.ok).toBe(true);
    if (!parseRes.ok) return;

    const { presentations } = parseRes.value;
    expect(presentations).toHaveLength(2);

    const parsedDoxology = presentations[1]!;
    expect(parsedDoxology.title).toBe('Doxology');
    // In writePptx, multi-song generates 1 title slide + 1 lyric slide = 2 slides for Doxology
    // Title slide is detected and stripped, leaving 1 lyric slide
    expect(parsedDoxology.slides).toHaveLength(1);
    expect(parsedDoxology.slides[0]!.items[0]?.plainText).toContain('Praise God from whom all blessings flow');
  });

  it('handles songs without metadata in multi-song deck cleanly', async () => {
    const noMetaSong = createMockSong('Simple Song', {}, ['Line 1\nLine 2']);
    const multiLibrary: Library = {
      presentations: [song1, noMetaSong],
    };

    const writeRes = await writePptx(multiLibrary);
    expect(writeRes.ok).toBe(true);
    if (!writeRes.ok) return;

    const parseRes = await parsePptx(writeRes.bytes);
    expect(parseRes.ok).toBe(true);
    if (!parseRes.ok) return;

    const { presentations } = parseRes.value;
    expect(presentations).toHaveLength(2);
    expect(presentations[1]!.title).toBe('Simple Song');
    expect(presentations[1]!.slides).toHaveLength(1);
    expect(presentations[1]!.slides[0]!.items[0]?.plainText).toBe('Line 1\nLine 2');
  });
});
