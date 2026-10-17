import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePro6 } from '../../src/formats/propresenter/index.js';

const ASSETS_DIR = resolve(
  import.meta.dirname,
  '../../../assets-for-testing-purpose'
);

function readAsset(fileName: string): Uint8Array {
  return new Uint8Array(readFileSync(resolve(ASSETS_DIR, fileName)));
}

function encodeUtf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function toBase64Rtf(rtf: string): string {
  return Buffer.from(rtf, 'utf-8').toString('base64');
}

describe('ProPresenter 6 XML Reader (parsePro6)', () => {
  describe('Exports', () => {
    it('exports parsePro6 function from module index', () => {
      expect(typeof parsePro6).toBe('function');
    });
  });

  describe('Real .pro6 asset fixture', () => {
    it('parses Marble Flow ProPresenter Template.pro6 faithfully', () => {
      const bytes = readAsset('Marble Flow ProPresenter Template.pro6');
      const result = parsePro6(bytes, 'Marble Flow ProPresenter Template.pro6');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const pres = result.value;

      // Source format & title
      expect(pres.sourceFormat).toBe('pro6');
      expect(pres.title).toBe('Marble Flow ProPresenter Template');

      // Sections: 1 grouping
      expect(pres.sections).toHaveLength(1);
      expect(pres.sections[0]!.slideIds).toHaveLength(24);

      // Slides: 24 slides total
      expect(pres.slides).toHaveLength(24);

      // Arrangements: 1 default arrangement with all 24 slides
      expect(pres.arrangements).toHaveLength(1);
      expect(pres.arrangements[0]!.slideIds).toHaveLength(24);

      // Slide labels preserved
      expect(pres.slides[0]!.label).toBe('Title 1');
      expect(pres.slides[1]!.label).toBe('Title 2');
      expect(pres.slides[2]!.label).toBe('Title 3');
      expect(pres.slides[3]!.label).toBe('Lyrics: Top, Left, Scripture');

      // Lyrics parsed accurately
      expect(pres.slides[0]!.items[0]?.plainText).toBe('Jesus is alive');
      expect(pres.slides[1]!.items[0]?.plainText).toBe('Jesus is alive');
      expect(pres.slides[2]!.items[0]?.plainText).toBe('Jesus is alive');

      // Multi-element slide 3 includes lyrics and scripture
      const slide3Text = pres.slides[3]!.items[0]?.plainText ?? '';
      expect(slide3Text).toContain('It’s your love O Lord');
      expect(slide3Text).toContain('That makes me sing');
      expect(slide3Text).toContain('Ephesians 2:4-5');
      expect(slide3Text).toContain('But God, being rich in mercy');

      // Formatting warnings emitted
      const styleWarning = result.warnings.find(
        (w) => w.code === 'PRO_STYLES_NOT_EXTRACTED'
      );
      expect(styleWarning).toBeDefined();
      expect(styleWarning?.severity).toBe('info');
    });
  });

  describe('Synthetic XML snippets', () => {
    it('extracts metadata attributes (CCLISongTitle, author, copyright, notes, ccliLicense, category)', () => {
      const rtf = toBase64Rtf('{\\rtf1\\ansi Line 1}');
      const xml = `
        <RVPresentationDocument
          CCLISongTitle="Amazing Grace"
          author="John Newton"
          copyright="1779"
          ccliLicense="22025"
          notes="Traditional hymn"
          category="Hymn"
        >
          <array rvXMLIvarName="groups">
            <RVSlideGrouping name="Verse 1" color="0 0 0 0">
              <array rvXMLIvarName="slides">
                <RVDisplaySlide label="V1">
                  <array rvXMLIvarName="displayElements">
                    <RVTextElement>
                      <NSString rvXMLIvarName="RTFData">${rtf}</NSString>
                    </RVTextElement>
                  </array>
                </RVDisplaySlide>
              </array>
            </RVSlideGrouping>
          </array>
        </RVPresentationDocument>
      `;

      const result = parsePro6(encodeUtf8(xml), 'Amazing.pro6');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const pres = result.value;
      expect(pres.title).toBe('Amazing Grace');
      expect(pres.metadata.author).toBe('John Newton');
      expect(pres.metadata.copyright).toBe('1779');
      expect(pres.metadata.ccli).toBe('22025');
      expect(pres.metadata.notes).toBe('Traditional hymn');
      expect(pres.metadata.originalFileName).toBe('Amazing.pro6');
      expect(pres.retained?.category).toBe('Hymn');
      expect(pres.slides).toHaveLength(1);
      expect(pres.slides[0]!.items[0]?.plainText).toBe('Line 1');
    });

    it('extracts multiple groups with float RGBA colors and maps to sections', () => {
      const rtf1 = toBase64Rtf('{\\rtf1\\ansi Amazing grace how sweet the sound}');
      const rtf2 = toBase64Rtf('{\\rtf1\\ansi That saved a wretch like me}');
      const rtf3 = toBase64Rtf('{\\rtf1\\ansi Praise God, praise God}');

      const xml = `
        <RVPresentationDocument CCLISongTitle="Song With Groups">
          <array rvXMLIvarName="groups">
            <RVSlideGrouping name="Verse 1" color="0.5 0.5 0.5 1">
              <array rvXMLIvarName="slides">
                <RVDisplaySlide label="Slide 1">
                  <array rvXMLIvarName="displayElements">
                    <RVTextElement>
                      <NSString rvXMLIvarName="RTFData">${rtf1}</NSString>
                    </RVTextElement>
                  </array>
                </RVDisplaySlide>
                <RVDisplaySlide label="Slide 2">
                  <array rvXMLIvarName="displayElements">
                    <RVTextElement>
                      <NSString rvXMLIvarName="RTFData">${rtf2}</NSString>
                    </RVTextElement>
                  </array>
                </RVDisplaySlide>
              </array>
            </RVSlideGrouping>
            <RVSlideGrouping name="Chorus" color="1 0 0 1">
              <array rvXMLIvarName="slides">
                <RVDisplaySlide label="Slide 3">
                  <array rvXMLIvarName="displayElements">
                    <RVTextElement>
                      <NSString rvXMLIvarName="RTFData">${rtf3}</NSString>
                    </RVTextElement>
                  </array>
                </RVDisplaySlide>
              </array>
            </RVSlideGrouping>
          </array>
        </RVPresentationDocument>
      `;

      const result = parsePro6(encodeUtf8(xml));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const pres = result.value;
      expect(pres.sections).toHaveLength(2);
      expect(pres.sections[0]!.name).toBe('Verse 1');
      expect(pres.sections[0]!.color).toBe('#808080');
      expect(pres.sections[0]!.slideIds).toHaveLength(2);

      expect(pres.sections[1]!.name).toBe('Chorus');
      expect(pres.sections[1]!.color).toBe('#ff0000');
      expect(pres.sections[1]!.slideIds).toHaveLength(1);

      expect(pres.slides).toHaveLength(3);
      expect(pres.slides[0]!.items[0]?.plainText).toBe('Amazing grace how sweet the sound');
      expect(pres.slides[1]!.items[0]?.plainText).toBe('That saved a wretch like me');
      expect(pres.slides[2]!.items[0]?.plainText).toBe('Praise God, praise God');

      expect(pres.arrangements[0]!.slideIds).toEqual([
        pres.slides[0]!.id,
        pres.slides[1]!.id,
        pres.slides[2]!.id,
      ]);
    });

    it('omits section color when alpha is 0 (e.g. 0 0 0 0)', () => {
      const rtf = toBase64Rtf('{\\rtf1\\ansi Sample Text}');
      const xml = `
        <RVPresentationDocument>
          <array rvXMLIvarName="groups">
            <RVSlideGrouping name="Transparent" color="0 0 0 0">
              <array rvXMLIvarName="slides">
                <RVDisplaySlide>
                  <array rvXMLIvarName="displayElements">
                    <RVTextElement>
                      <NSString rvXMLIvarName="RTFData">${rtf}</NSString>
                    </RVTextElement>
                  </array>
                </RVDisplaySlide>
              </array>
            </RVSlideGrouping>
          </array>
        </RVPresentationDocument>
      `;

      const result = parsePro6(encodeUtf8(xml));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.sections[0]!.color).toBeUndefined();
    });

    it('does not emit PRO_STYLES_NOT_EXTRACTED when RTF has no style words', () => {
      // Plain RTF with no font size, bold, italic, colors, etc.
      const rtf = toBase64Rtf('{\\rtf1\\ansi Just plain text without styles}');
      const xml = `
        <RVPresentationDocument CCLISongTitle="Plain">
          <array rvXMLIvarName="groups">
            <RVSlideGrouping name="Group 1">
              <array rvXMLIvarName="slides">
                <RVDisplaySlide>
                  <array rvXMLIvarName="displayElements">
                    <RVTextElement>
                      <NSString rvXMLIvarName="RTFData">${rtf}</NSString>
                    </RVTextElement>
                  </array>
                </RVDisplaySlide>
              </array>
            </RVSlideGrouping>
          </array>
        </RVPresentationDocument>
      `;

      const result = parsePro6(encodeUtf8(xml));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const styleWarning = result.warnings.find(
        (w) => w.code === 'PRO_STYLES_NOT_EXTRACTED'
      );
      expect(styleWarning).toBeUndefined();
    });

    it('supports direct groups and slides tags without array plist wrapper', () => {
      const rtf = toBase64Rtf('{\\rtf1\\ansi Simple format}');
      const xml = `
        <RVPresentationDocument CCLISongTitle="Direct">
          <groups>
            <RVSlideGrouping name="Direct Group">
              <slides>
                <RVDisplaySlide label="Direct Slide">
                  <displayElements>
                    <RVTextElement>
                      <NSString rvXMLIvarName="RTFData">${rtf}</NSString>
                    </RVTextElement>
                  </displayElements>
                </RVDisplaySlide>
              </slides>
            </RVSlideGrouping>
          </groups>
        </RVPresentationDocument>
      `;

      const result = parsePro6(encodeUtf8(xml));
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.sections).toHaveLength(1);
      expect(result.value.sections[0]!.name).toBe('Direct Group');
      expect(result.value.slides).toHaveLength(1);
      expect(result.value.slides[0]!.label).toBe('Direct Slide');
      expect(result.value.slides[0]!.items[0]?.plainText).toBe('Simple format');
    });
  });

  describe('Error handling and corrupted input', () => {
    it('returns error on empty byte array', () => {
      const result = parsePro6(new Uint8Array(0));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toMatch(/empty/i);
    });

    it('returns error on corrupted / malformed XML syntax', () => {
      const badXml = '<RVPresentationDocument><unclosedTag>';
      const result = parsePro6(encodeUtf8(badXml));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toBeDefined();
    });

    it('returns error when XML root is not RVPresentationDocument', () => {
      const wrongRoot = '<SomeOtherDocument><title>Hello</title></SomeOtherDocument>';
      const result = parsePro6(encodeUtf8(wrongRoot));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toMatch(/RVPresentationDocument/i);
    });

    it('returns error when document has no slides', () => {
      const emptyDoc = '<RVPresentationDocument CCLISongTitle="No Slides"></RVPresentationDocument>';
      const result = parsePro6(encodeUtf8(emptyDoc));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toMatch(/no slides/i);
    });
  });
});
