import { describe, expect, it, vi } from 'vitest';
import {
  AMAZING_GRACE,
  convertFile,
  createAmazingGracePresentation,
  detectFormat,
  exportLibrary,
  exportPresentation,
  FORMAT_REGISTRY,
  getFormat,
  importFile,
  listExportFormats,
  listFormats,
  parseFreeShow,
  parsePptx,
  parsePro,
  parsePro6,
  parseTxt,
  parseVpc,
  type FormatDef,
  type FormatId,
  type Library,
  type Presentation,
  writeFreeShow,
  writePptx,
  writePro,
  writeTxt,
  writeVpc,
} from '../../src/index.js';

describe('Format Detector (detectFormat)', () => {
  describe('Extension matching (case-insensitive)', () => {
    const dummyBytes = new Uint8Array([0x00, 0x01, 0x02]);

    it('detects .pro extension', () => {
      expect(detectFormat('song.pro', dummyBytes)).toBe('pro');
      expect(detectFormat('SONG.PRO', dummyBytes)).toBe('pro');
      expect(detectFormat('/path/to/my_song.Pro', dummyBytes)).toBe('pro');
    });

    it('detects .pro6 extension', () => {
      expect(detectFormat('template.pro6', dummyBytes)).toBe('pro6');
      expect(detectFormat('TEMPLATE.PRO6', dummyBytes)).toBe('pro6');
    });

    it('detects .vpc extension', () => {
      expect(detectFormat('songbook.vpc', dummyBytes)).toBe('vpc');
      expect(detectFormat('SONGBOOK.VPC', dummyBytes)).toBe('vpc');
    });

    it('detects .json extension', () => {
      expect(detectFormat('library.json', dummyBytes)).toBe('json');
      expect(detectFormat('LIBRARY.JSON', dummyBytes)).toBe('json');
    });

    it('detects .show extension', () => {
      expect(detectFormat('presentation.show', dummyBytes)).toBe('freeshow');
      expect(detectFormat('PROJECT.SHOW', dummyBytes)).toBe('freeshow');
    });

    it('detects .txt extension', () => {
      expect(detectFormat('lyrics.txt', dummyBytes)).toBe('txt');
      expect(detectFormat('LYRICS.TXT', dummyBytes)).toBe('txt');
    });

    it('detects .pptx extension', () => {
      expect(detectFormat('slides.pptx', dummyBytes)).toBe('pptx');
      expect(detectFormat('SLIDES.PPTX', dummyBytes)).toBe('pptx');
    });
  });

  describe('Magic byte sniffing', () => {
    it('detects Protobuf tag 1 (0x0a) as .pro when extension is unknown', () => {
      const bytes = new Uint8Array([0x0a, 0x20, 0x01, 0x02]);
      expect(detectFormat('unknown_file', bytes)).toBe('pro');
      expect(detectFormat('data.bin', bytes)).toBe('pro');
      expect(detectFormat('', bytes)).toBe('pro');
    });

    it('detects JSON starting with { or [ when extension is unknown', () => {
      const fsJson = new TextEncoder().encode('  \n  {"presentations":{"p1":{}}}');
      expect(detectFormat('unknown_file', fsJson)).toBe('freeshow');

      const vpJson = new TextEncoder().encode('  {"Songs":[{"Text":"Song 1"}]}');
      expect(detectFormat('unknown_file', vpJson)).toBe('json');

      const arrayJson = new TextEncoder().encode('  [{"Text":"Song 1"}]');
      expect(detectFormat('data.dat', arrayJson)).toBe('json');
    });

    it('detects ZIP packages (0x50, 0x4b) by inspecting archive contents', async () => {
      const pptxRes = await writePptx({ presentations: [AMAZING_GRACE] });
      expect(pptxRes.ok).toBe(true);
      if (pptxRes.ok) {
        expect(detectFormat('unknown_pptx_file', pptxRes.value.bytes)).toBe('pptx');
      }

      const showRes = await writeFreeShow({ presentations: [AMAZING_GRACE] });
      expect(showRes.ok).toBe(true);
      if (showRes.ok) {
        expect(detectFormat('unknown_show_file', showRes.value.bytes)).toBe('freeshow');
      }

      const vpcRes = await writeVpc([AMAZING_GRACE]);
      expect(vpcRes.ok).toBe(true);
      if (vpcRes.ok) {
        expect(detectFormat('unknown_vpc_file', vpcRes.value.bytes)).toBe('vpc');
      }
    });

    it('detects ProPresenter 6 XML by sniffing RVPresentationDocument root', () => {
      const xml = new TextEncoder().encode(
        '<?xml version="1.0" encoding="utf-8"?>\n<RVPresentationDocument height="1080" width="1920" />'
      );
      expect(detectFormat('unknown_file', xml)).toBe('pro6');
    });

    it('returns undefined for unrecognized format and empty/random bytes', () => {
      expect(detectFormat('unknown.xyz', new Uint8Array([0x01, 0x02, 0x03]))).toBeUndefined();
      expect(detectFormat('', new Uint8Array())).toBeUndefined();
    });
  });
});

describe('Format Registry (FORMAT_REGISTRY)', () => {
  it('registers all 7 formats', () => {
    const ids = FORMAT_REGISTRY.map((f) => f.id);
    expect(ids).toEqual(['pro', 'pro6', 'vpc', 'json', 'freeshow', 'txt', 'pptx']);
    expect(FORMAT_REGISTRY).toHaveLength(7);
  });

  it('provides getFormat helper for querying formats', () => {
    const pro = getFormat('pro');
    expect(pro).toBeDefined();
    expect(pro?.id).toBe('pro');
    expect(pro?.canImport).toBe(true);
    expect(pro?.canExport).toBe(true);

    const unknown = getFormat('nonexistent' as FormatId);
    expect(unknown).toBeUndefined();
  });

  it('provides listFormats helper returning all formats', () => {
    const formats = listFormats();
    expect(formats).toHaveLength(7);
    expect(formats.map((f) => f.id)).toEqual([
      'pro',
      'pro6',
      'vpc',
      'json',
      'freeshow',
      'txt',
      'pptx',
    ]);
  });

  it('provides listExportFormats helper returning only exportable formats', () => {
    const exportFormats = listExportFormats();
    const ids = exportFormats.map((f) => f.id);
    expect(ids).toEqual(['pro', 'vpc', 'freeshow', 'txt', 'pptx']);
    expect(ids).not.toContain('pro6');
    expect(ids).not.toContain('json');
    for (const f of exportFormats) {
      expect(f.canExport).toBe(true);
      expect(typeof f.exportBytes).toBe('function');
    }
  });

  it('marks pro6 and json as read-only (canExport: false, no exportBytes)', () => {
    const pro6 = getFormat('pro6');
    expect(pro6?.canImport).toBe(true);
    expect(pro6?.canExport).toBe(false);
    expect(pro6?.exportBytes).toBeUndefined();

    const json = getFormat('json');
    expect(json?.canImport).toBe(true);
    expect(json?.canExport).toBe(false);
    expect(json?.exportBytes).toBeUndefined();
  });

  describe('Single vs Multi-presentation export enforcement', () => {
    const p1 = createAmazingGracePresentation();
    const p2: Presentation = {
      ...p1,
      id: 'second-pres-id',
      title: 'Second Presentation',
    };

    it('ProPresenter export fails closed if presentations.length !== 1 with exact error', async () => {
      const pro = getFormat('pro');
      expect(pro?.exportBytes).toBeDefined();

      const zeroPres: Library = { presentations: [] };
      const multiPres: Library = { presentations: [p1, p2] };

      const zeroRes = await pro!.exportBytes!(zeroPres);
      expect(zeroRes.ok).toBe(false);
      if (!zeroRes.ok) {
        expect(zeroRes.error.message).toBe(
          'ProPresenter export supports exactly one presentation per file.'
        );
      }

      const multiRes = await pro!.exportBytes!(multiPres);
      expect(multiRes.ok).toBe(false);
      if (!multiRes.ok) {
        expect(multiRes.error.message).toBe(
          'ProPresenter export supports exactly one presentation per file.'
        );
      }

      const singleRes = await pro!.exportBytes!({ presentations: [p1] });
      expect(singleRes.ok).toBe(true);
    });

    it('Plain Text export enforces exactly one presentation', async () => {
      const txt = getFormat('txt');
      expect(txt?.exportBytes).toBeDefined();

      const multiRes = await txt!.exportBytes!({ presentations: [p1, p2] });
      expect(multiRes.ok).toBe(false);

      const singleRes = await txt!.exportBytes!({ presentations: [p1] });
      expect(singleRes.ok).toBe(true);
    });

    it('PowerPoint export enforces exactly one presentation', async () => {
      const pptx = getFormat('pptx');
      expect(pptx?.exportBytes).toBeDefined();

      const multiRes = await pptx!.exportBytes!({ presentations: [p1, p2] });
      expect(multiRes.ok).toBe(false);

      const singleRes = await pptx!.exportBytes!({ presentations: [p1] });
      expect(singleRes.ok).toBe(true);
    });

    it('Multi-presentation exporters (vpc, freeshow) support multiple presentations', async () => {
      const vpc = getFormat('vpc');
      const fs = getFormat('freeshow');

      const vpcRes = await vpc!.exportBytes!({ presentations: [p1, p2] });
      expect(vpcRes.ok).toBe(true);

      const fsRes = await fs!.exportBytes!({ presentations: [p1, p2] });
      expect(fsRes.ok).toBe(true);
    });
  });
});

describe('Pipeline Importer (importFile)', () => {
  it('imports .pro files into a canonical Library', async () => {
    const proBytes = writePro(AMAZING_GRACE);
    expect(proBytes.ok).toBe(true);
    if (!proBytes.ok) return;

    const res = await importFile(proBytes.bytes, 'Amazing Grace.pro');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.presentations).toHaveLength(1);
    expect(res.value.presentations[0]!.title).toBe('Amazing Grace');
    expect(res.value.presentations[0]!.slides.length).toBeGreaterThan(0);
  });

  it('imports .vpc files into a canonical Library', async () => {
    const vpcBytes = await writeVpc([AMAZING_GRACE]);
    expect(vpcBytes.ok).toBe(true);
    if (!vpcBytes.ok) return;

    const res = await importFile(vpcBytes.value.bytes, 'Songbook.vpc');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.presentations).toHaveLength(1);
    expect(res.value.presentations[0]!.title).toBe('Amazing Grace');
  });

  it('imports .show (FreeShow) files into a canonical Library', async () => {
    const showBytes = await writeFreeShow({ presentations: [AMAZING_GRACE] });
    expect(showBytes.ok).toBe(true);
    if (!showBytes.ok) return;

    const res = await importFile(showBytes.value.bytes, 'Project.show');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.presentations).toHaveLength(1);
    expect(res.value.presentations[0]!.title).toBe('Amazing Grace');
  });

  it('imports .txt files into a canonical Library', async () => {
    const txtBytes = writeTxt({ presentations: [AMAZING_GRACE] });
    expect(txtBytes.ok).toBe(true);
    if (!txtBytes.ok) return;

    const res = await importFile(txtBytes.value.bytes, 'Amazing Grace.txt');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.presentations).toHaveLength(1);
    expect(res.value.presentations[0]!.title).toBe('Amazing Grace');
  });

  it('imports .pptx files into a canonical Library', async () => {
    const pptxBytes = await writePptx({ presentations: [AMAZING_GRACE] });
    expect(pptxBytes.ok).toBe(true);
    if (!pptxBytes.ok) return;

    const res = await importFile(pptxBytes.value.bytes, 'Amazing Grace.pptx');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.presentations).toHaveLength(1);
    expect(res.value.presentations[0]!.title).toBe('Amazing Grace');
  });

  it('imports .pro6 files into a canonical Library', async () => {
    const pro6Xml = `<?xml version="1.0" encoding="utf-8"?>
<RVPresentationDocument height="1080" width="1920" versionNumber="600" docType="0" CCLIAuthor="John Newton" CCLISongTitle="Amazing Grace">
  <RVSlideGrouping name="Verse 1" color="0 0 1 1">
    <slides>
      <RVDisplaySlide>
        <displayElements>
          <RVTextElement>
            <RTFData>e1xydGYxXGFuc2kKQW1hemluZyBncmFjZSF9</RTFData>
          </RVTextElement>
        </displayElements>
      </RVDisplaySlide>
    </slides>
  </RVSlideGrouping>
</RVPresentationDocument>`;
    const bytes = new TextEncoder().encode(pro6Xml);
    const res = await importFile(bytes, 'Amazing Grace.pro6');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.presentations).toHaveLength(1);
    expect(res.value.presentations[0]!.title).toBe('Amazing Grace');
  });

  it('imports .json (VideoPsalm) files into a canonical Library', async () => {
    const jsonStr = JSON.stringify({
      Songs: [
        {
          Text: 'Hymn 1',
          Verses: [{ Text: 'Line 1\nLine 2', Tag: 1 }],
        },
      ],
    });
    const bytes = new TextEncoder().encode(jsonStr);
    const res = await importFile(bytes, 'Hymnal.json');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.presentations).toHaveLength(1);
    expect(res.value.presentations[0]!.title).toBe('Hymn 1');
  });

  it('fails closed with unrecognized format error when format cannot be identified', async () => {
    const bytes = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const res = await importFile(bytes, 'unknown.foo');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toMatch(/Unrecognized file format/i);
    }
  });

  it('fails closed on corrupt payload for a recognized format', async () => {
    const badBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const res = await importFile(badBytes, 'broken.pro');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toBeInstanceOf(Error);
    }
  });

  it('catches synchronous and asynchronous exceptions in format.importBytes', async () => {
    const format = getFormat('pro');
    const spy = vi
      .spyOn(format!, 'importBytes')
      .mockRejectedValueOnce(new Error('Simulated codec crash'));

    const res = await importFile(new Uint8Array([0x0a, 0x01]), 'test.pro');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe('Simulated codec crash');
    }
    spy.mockRestore();
  });
});

describe('Pipeline Exporter (exportLibrary & exportPresentation)', () => {
  const library: Library = { presentations: [AMAZING_GRACE] };

  it('exports library to .pro format', async () => {
    const res = await exportLibrary(library, 'pro');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.bytes.byteLength).toBeGreaterThan(0);
    expect(Array.isArray(res.value.warnings)).toBe(true);
  });

  it('exports library to .vpc format', async () => {
    const res = await exportLibrary(library, 'vpc');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.bytes.byteLength).toBeGreaterThan(0);
  });

  it('exports library to .freeshow format', async () => {
    const res = await exportLibrary(library, 'freeshow');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.bytes.byteLength).toBeGreaterThan(0);
  });

  it('exports library to .txt format', async () => {
    const res = await exportLibrary(library, 'txt');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.bytes.byteLength).toBeGreaterThan(0);
  });

  it('exports library to .pptx format', async () => {
    const res = await exportLibrary(library, 'pptx');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.bytes.byteLength).toBeGreaterThan(0);
  });

  it('fails closed on read-only formats (pro6, json)', async () => {
    const pro6Res = await exportLibrary(library, 'pro6');
    expect(pro6Res.ok).toBe(false);
    if (!pro6Res.ok) {
      expect(pro6Res.error.message).toMatch(/export/i);
    }

    const jsonRes = await exportLibrary(library, 'json');
    expect(jsonRes.ok).toBe(false);
    if (!jsonRes.ok) {
      expect(jsonRes.error.message).toMatch(/export/i);
    }
  });

  it('fails closed on unknown formatId', async () => {
    const res = await exportLibrary(library, 'unknown' as FormatId);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toMatch(/export|unrecognized|unregistered/i);
    }
  });

  it('provides exportPresentation convenience helper', async () => {
    const res = await exportPresentation(AMAZING_GRACE, 'txt');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.bytes.byteLength).toBeGreaterThan(0);
    const text = new TextDecoder().decode(res.value.bytes);
    expect(text).toContain('Amazing Grace');
  });

  it('catches synchronous exceptions in format.exportBytes', async () => {
    const format = getFormat('pro');
    const spy = vi.spyOn(format!, 'exportBytes').mockImplementationOnce(() => {
      throw new Error('Sync export crash');
    });

    const res = await exportLibrary(library, 'pro');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe('Sync export crash');
    }
    spy.mockRestore();
  });
});

describe('Pipeline Conversion (convertFile)', () => {
  it('converts .txt -> .pro', async () => {
    const txtRes = writeTxt({ presentations: [AMAZING_GRACE] });
    expect(txtRes.ok).toBe(true);
    if (!txtRes.ok) return;

    const res = await convertFile(txtRes.value.bytes, 'Amazing Grace.txt', 'pro');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.bytes.byteLength).toBeGreaterThan(0);

    // Verify converted output can be re-imported
    const reimported = await importFile(res.value.bytes, 'output.pro');
    expect(reimported.ok).toBe(true);
    if (!reimported.ok) return;
    expect(reimported.value.presentations[0]!.title).toBe('Amazing Grace');
  });

  it('converts .pro -> .vpc', async () => {
    const proRes = writePro(AMAZING_GRACE);
    expect(proRes.ok).toBe(true);
    if (!proRes.ok) return;

    const res = await convertFile(proRes.bytes, 'Amazing Grace.pro', 'vpc');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.bytes.byteLength).toBeGreaterThan(0);

    const reimported = await importFile(res.value.bytes, 'output.vpc');
    expect(reimported.ok).toBe(true);
    if (!reimported.ok) return;
    expect(reimported.value.presentations[0]!.title).toBe('Amazing Grace');
  });

  it('converts .vpc -> .freeshow', async () => {
    const vpcRes = await writeVpc([AMAZING_GRACE]);
    expect(vpcRes.ok).toBe(true);
    if (!vpcRes.ok) return;

    const res = await convertFile(vpcRes.value.bytes, 'Songbook.vpc', 'freeshow');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.bytes.byteLength).toBeGreaterThan(0);

    const reimported = await importFile(res.value.bytes, 'output.show');
    expect(reimported.ok).toBe(true);
    if (!reimported.ok) return;
    expect(reimported.value.presentations[0]!.title).toBe('Amazing Grace');
  });

  it('converts .freeshow -> .pptx', async () => {
    const fsRes = await writeFreeShow({ presentations: [AMAZING_GRACE] });
    expect(fsRes.ok).toBe(true);
    if (!fsRes.ok) return;

    const res = await convertFile(fsRes.value.bytes, 'Amazing Grace.show', 'pptx');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.bytes.byteLength).toBeGreaterThan(0);

    const reimported = await importFile(res.value.bytes, 'output.pptx');
    expect(reimported.ok).toBe(true);
    if (!reimported.ok) return;
    expect(reimported.value.presentations[0]!.slides.length).toBeGreaterThan(0);
  });

  it('converts .pptx -> .txt', async () => {
    const pptxRes = await writePptx({ presentations: [AMAZING_GRACE] });
    expect(pptxRes.ok).toBe(true);
    if (!pptxRes.ok) return;

    const res = await convertFile(pptxRes.value.bytes, 'Amazing Grace.pptx', 'txt');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.bytes.byteLength).toBeGreaterThan(0);

    const text = new TextDecoder().decode(res.value.bytes);
    expect(text).toContain('Amazing Grace');
  });

  it('merges import warnings and export warnings into the final result', async () => {
    // AMAZING_GRACE in PPTX round-trip: PPTX importer generates warnings if styles/empty slides occur.
    // Let's create a presentation with styled text to trigger import warning
    const presWithStyle: Presentation = {
      ...createAmazingGracePresentation(),
      slides: [
        {
          id: 'slide-styled',
          items: [
            {
              type: 'text',
              plainText: 'Styled Line',
              richText: [{ text: 'Styled Line', style: { bold: 'true' } }],
            },
          ],
        },
      ],
      sections: [{ id: 'sec-1', name: 'Verse 1', slideIds: ['slide-styled'] }],
    };

    const pptxRes = await writePptx({ presentations: [presWithStyle] });
    expect(pptxRes.ok).toBe(true);
    if (!pptxRes.ok) return;

    const convRes = await convertFile(pptxRes.value.bytes, 'styled.pptx', 'pro');
    expect(convRes.ok).toBe(true);
    if (!convRes.ok) return;

    // Converted result contains warnings array
    expect(Array.isArray(convRes.warnings)).toBe(true);
    expect(Array.isArray(convRes.value.warnings)).toBe(true);
    expect(convRes.warnings).toEqual(convRes.value.warnings);
  });

  it('fails closed when source file format is unrecognized', async () => {
    const junkBytes = new Uint8Array([0x01, 0x02, 0x03]);
    const res = await convertFile(junkBytes, 'song.unknown', 'pro');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toMatch(/Unrecognized file format/i);
    }
  });

  it('fails closed when target format is read-only', async () => {
    const txtRes = writeTxt({ presentations: [AMAZING_GRACE] });
    expect(txtRes.ok).toBe(true);
    if (!txtRes.ok) return;

    const res = await convertFile(txtRes.value.bytes, 'song.txt', 'pro6');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toMatch(/export/i);
    }
  });

  it('catches unexpected exceptions during convertFile', async () => {
    const format = getFormat('txt');
    const spy = vi
      .spyOn(format!, 'importBytes')
      .mockRejectedValueOnce(new Error('Converter pipeline crash'));

    const res = await convertFile(new Uint8Array([1, 2, 3]), 'song.txt', 'pro');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe('Converter pipeline crash');
    }
    spy.mockRestore();
  });
});

describe('Root Public API Exports (src/index.ts)', () => {
  it('exports canonical schemas, types, and normalizers', () => {
    expect(typeof createAmazingGracePresentation).toBe('function');
    expect(AMAZING_GRACE).toBeDefined();
    expect(AMAZING_GRACE.title).toBe('Amazing Grace');
  });

  it('exports specific format codecs', () => {
    expect(typeof parsePro).toBe('function');
    expect(typeof writePro).toBe('function');
    expect(typeof parsePro6).toBe('function');
    expect(typeof parseVpc).toBe('function');
    expect(typeof writeVpc).toBe('function');
    expect(typeof parseFreeShow).toBe('function');
    expect(typeof writeFreeShow).toBe('function');
    expect(typeof parseTxt).toBe('function');
    expect(typeof writeTxt).toBe('function');
    expect(typeof parsePptx).toBe('function');
    expect(typeof writePptx).toBe('function');
  });

  it('exports pipeline functions and registry', () => {
    expect(typeof detectFormat).toBe('function');
    expect(typeof importFile).toBe('function');
    expect(typeof exportLibrary).toBe('function');
    expect(typeof exportPresentation).toBe('function');
    expect(typeof convertFile).toBe('function');
    expect(Array.isArray(FORMAT_REGISTRY)).toBe(true);
    expect(typeof getFormat).toBe('function');
    expect(typeof listFormats).toBe('function');
    expect(typeof listExportFormats).toBe('function');
  });
});
