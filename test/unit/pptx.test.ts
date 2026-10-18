import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  TextReader,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from '@zip.js/zip.js';
import type { Library, Presentation } from '../../src/canonical/index.js';
import { AMAZING_GRACE } from '../../src/fixtures/amazing-grace.js';
import { parsePptx, writePptx } from '../../src/formats/pptx/index.js';

const ASSETS_DIR = resolve(
  import.meta.dirname,
  '../../../assets-for-testing-purpose'
);

function readAssetIfExists(fileName: string): Uint8Array | null {
  const p = resolve(ASSETS_DIR, fileName);
  if (!existsSync(p)) return null;
  return new Uint8Array(readFileSync(p));
}

async function createMockPptxZip(files: Record<string, string>): Promise<Uint8Array> {
  const writer = new ZipWriter(new Uint8ArrayWriter());
  for (const [name, content] of Object.entries(files)) {
    await writer.add(name, new TextReader(content));
  }
  return writer.close();
}

describe('PowerPoint (.pptx) Text-Only OpenXML Codec', () => {
  describe('Exports', () => {
    it('exports parsePptx and writePptx functions', () => {
      expect(typeof parsePptx).toBe('function');
      expect(typeof writePptx).toBe('function');
    });
  });

  describe('writePptx & AMAZING_GRACE Round-Trip', () => {
    it('serializes AMAZING_GRACE to OpenXML PPTX and parses back with full fidelity', async () => {
      const library: Library = {
        presentations: [AMAZING_GRACE],
      };

      const writeRes = await writePptx(library);
      expect(writeRes.ok).toBe(true);
      if (!writeRes.ok) return;

      expect(writeRes.bytes).toBeInstanceOf(Uint8Array);
      expect(writeRes.bytes.byteLength).toBeGreaterThan(0);

      // Verify ZIP contents contain standard OpenXML files
      const zipReader = new ZipReader(new Uint8ArrayReader(writeRes.bytes));
      const entries = await zipReader.getEntries();
      await zipReader.close();

      const fileNames = entries.map((e) => e.filename);
      expect(fileNames).toContain('[Content_Types].xml');
      expect(fileNames).toContain('_rels/.rels');
      expect(fileNames).toContain('ppt/presentation.xml');
      expect(fileNames).toContain('ppt/_rels/presentation.xml.rels');
      expect(fileNames).toContain('docProps/core.xml');
      expect(fileNames).toContain('ppt/slides/slide1.xml');
      expect(fileNames).toContain('ppt/slides/slide9.xml');

      const parseRes = await parsePptx(writeRes.bytes, 'Amazing Grace.pptx');
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const { presentations } = parseRes.value;
      expect(presentations).toHaveLength(1);

      const p = presentations[0]!;
      expect(p.title).toBe(AMAZING_GRACE.title);
      expect(p.sourceFormat).toBe('pptx');
      expect(p.metadata.originalFileName).toBe('Amazing Grace.pptx');
      expect(p.metadata.author).toBe(AMAZING_GRACE.metadata.author);

      // Assert slide count (9)
      expect(p.slides).toHaveLength(9);

      // Assert lyric text fidelity for all 9 slides
      for (let i = 0; i < AMAZING_GRACE.slides.length; i++) {
        const expected = AMAZING_GRACE.slides[i]!.items[0]?.plainText;
        const actual = p.slides[i]!.items[0]?.plainText;
        expect(actual).toBe(expected);
      }
    });
  });

  describe('Numeric slide ordering (slide1, slide2 ... slide9, slide10)', () => {
    it('preserves numeric ordering when slide count >= 10', async () => {
      // Create a 12-slide presentation
      const multiSlidePres: Presentation = {
        id: 'multi-slide-test',
        title: 'Ordered Hymn',
        sourceFormat: 'unknown',
        metadata: {},
        sections: [
          {
            id: 'sec-1',
            name: 'All Slides',
            slideIds: Array.from({ length: 12 }, (_, i) => `slide-${i + 1}`),
          },
        ],
        arrangements: [],
        slides: Array.from({ length: 12 }, (_, i) => ({
          id: `slide-${i + 1}`,
          label: `Slide ${i + 1}`,
          items: [
            {
              type: 'text' as const,
              plainText: `Slide Number ${i + 1} Content`,
            },
          ],
        })),
        warnings: [],
      };

      const writeRes = await writePptx({ presentations: [multiSlidePres] });
      expect(writeRes.ok).toBe(true);
      if (!writeRes.ok) return;

      const parseRes = await parsePptx(writeRes.bytes, 'Ordered.pptx');
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const p = parseRes.value.presentations[0]!;
      expect(p.slides).toHaveLength(12);

      // Verify each slide index matches its 1-based number
      for (let i = 0; i < 12; i++) {
        expect(p.slides[i]!.items[0]?.plainText).toBe(`Slide Number ${i + 1} Content`);
      }
    });

    it('correctly sorts arbitrary unsorted entry orders by numeric slide index', async () => {
      // Craft archive where slide10 comes before slide2 in the zip table
      const zipBytes = await createMockPptxZip({
        'ppt/slides/slide10.xml': `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Content of Slide 10</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`,
        'ppt/slides/slide2.xml': `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Content of Slide 2</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`,
        'ppt/slides/slide1.xml': `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Content of Slide 1</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`,
        'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>Unsorted Test</dc:title>
</cp:coreProperties>`,
      });

      const parseRes = await parsePptx(zipBytes);
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const p = parseRes.value.presentations[0]!;
      expect(p.slides).toHaveLength(3);
      expect(p.slides[0]!.items[0]?.plainText).toBe('Content of Slide 1');
      expect(p.slides[1]!.items[0]?.plainText).toBe('Content of Slide 2');
      expect(p.slides[2]!.items[0]?.plainText).toBe('Content of Slide 10');
    });
  });

  describe('Title detection & fallback', () => {
    it('detects title from docProps/core.xml <dc:title>', async () => {
      const zipBytes = await createMockPptxZip({
        'ppt/slides/slide1.xml': `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Verse</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`,
        'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>Special Service Hymn</dc:title>
  <dc:creator>Charles Wesley</dc:creator>
</cp:coreProperties>`,
      });

      const parseRes = await parsePptx(zipBytes, 'IgnoredFileName.pptx');
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const p = parseRes.value.presentations[0]!;
      expect(p.title).toBe('Special Service Hymn');
      expect(p.metadata.author).toBe('Charles Wesley');
    });

    it('falls back to fileName without .pptx extension if docProps/core.xml lacks dc:title', async () => {
      const zipBytes = await createMockPptxZip({
        'ppt/slides/slide1.xml': `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Verse</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`,
        'docProps/core.xml': `<?xml version="1.0" encoding="UTF-8"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title></dc:title>
</cp:coreProperties>`,
      });

      const parseRes = await parsePptx(zipBytes, 'GreatIsThyFaithfulness.pptx');
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const p = parseRes.value.presentations[0]!;
      expect(p.title).toBe('GreatIsThyFaithfulness');
    });

    it('falls back to "Untitled Presentation" when neither core.xml title nor fileName is given', async () => {
      const zipBytes = await createMockPptxZip({
        'ppt/slides/slide1.xml': `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Verse</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`,
      });

      const parseRes = await parsePptx(zipBytes);
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const p = parseRes.value.presentations[0]!;
      expect(p.title).toBe('Untitled Presentation');
    });
  });

  describe('Warnings: Style and Empty Slides', () => {
    it('emits PPTX_STYLES_NOT_EXTRACTED warning when formatted text runs are present', async () => {
      const zipBytes = await createMockPptxZip({
        'ppt/slides/slide1.xml': `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody>
    <a:p>
      <a:r>
        <a:rPr b="1" i="1"/>
        <a:t>Bold and Italic lyric</a:t>
      </a:r>
    </a:p>
  </p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`,
      });

      const parseRes = await parsePptx(zipBytes, 'Styled.pptx');
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const styleWarning = parseRes.warnings.find(
        (w) => w.code === 'PPTX_STYLES_NOT_EXTRACTED'
      );
      expect(styleWarning).toBeDefined();
      expect(styleWarning?.severity).toBe('info');
    });

    it('emits PPTX_EMPTY_SLIDE warning when a slide contains no text', async () => {
      const zipBytes = await createMockPptxZip({
        'ppt/slides/slide1.xml': `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody>
    <a:p><a:r><a:t>Has text</a:t></a:r></a:p>
  </p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`,
        'ppt/slides/slide2.xml': `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody>
    <a:p><a:endParaRPr/></a:p>
  </p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`,
      });

      const parseRes = await parsePptx(zipBytes, 'WithEmptySlide.pptx');
      expect(parseRes.ok).toBe(true);
      if (!parseRes.ok) return;

      const emptyWarning = parseRes.warnings.find(
        (w) => w.code === 'PPTX_EMPTY_SLIDE'
      );
      expect(emptyWarning).toBeDefined();
      expect(emptyWarning?.severity).toBe('warn');
    });
  });

  describe('Fails closed on corrupt or invalid inputs', () => {
    it('fails closed on empty byte array', async () => {
      const res = await parsePptx(new Uint8Array(0));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeInstanceOf(Error);
      }
    });

    it('fails closed on non-zip corrupt bytes', async () => {
      const res = await parsePptx(new Uint8Array([1, 2, 3, 4, 5]));
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeInstanceOf(Error);
      }
    });

    it('fails closed on valid ZIP containing 0 slides', async () => {
      const emptyZip = await createMockPptxZip({
        'docProps/core.xml': '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"><dc:title>Empty</dc:title></cp:coreProperties>',
      });
      const res = await parsePptx(emptyZip);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.message).toMatch(/no slides/i);
      }
    });

    it('fails closed when writing a library with 0 presentations', async () => {
      const res = await writePptx({ presentations: [] });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBeInstanceOf(Error);
      }
    });

    it('successfully writes a library with multiple presentations', async () => {
      const res = await writePptx({
        presentations: [AMAZING_GRACE, AMAZING_GRACE],
      });
      expect(res.ok).toBe(true);
    });
  });

  describe('Real-World Fixture: Hymn.pptx', () => {
    it('parses Hymn.pptx from test assets when available', async () => {
      const bytes = readAssetIfExists('Hymn.pptx');
      if (!bytes) {
        // Skip if assets directory not present
        return;
      }

      const res = await parsePptx(bytes, 'Hymn.pptx');
      expect(res.ok).toBe(true);
      if (!res.ok) return;

      const { presentations } = res.value;
      expect(presentations).toHaveLength(2);

      const song1 = presentations[0]!;
      expect(song1.sourceFormat).toBe('pptx');
      expect(song1.title).toBe('How Great Thou Art');
      expect(song1.slides).toHaveLength(7);

      // Slide 1 has known text
      const slide1Text = song1.slides[0]!.items[0]?.plainText;
      expect(slide1Text).toContain('OH LORD, MY GOD');

      const song2 = presentations[1]!;
      expect(song2.sourceFormat).toBe('pptx');
      expect(song2.title).toBe('Blessed Asurance');
      expect(song2.slides).toHaveLength(8);
      const song2Slide1Text = song2.slides[0]!.items[0]?.plainText;
      expect(song2Slide1Text).toContain('Blessed assurance');
    });
  });
});
