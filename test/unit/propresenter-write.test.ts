import { describe, expect, it } from 'vitest';
import { AMAZING_GRACE } from '../../src/fixtures/amazing-grace.js';
import {
  getProtoRoot,
  parsePro,
  writePro,
} from '../../src/formats/propresenter/index.js';
import type { Presentation } from '../../src/canonical/index.js';

describe('ProPresenter 7 Protobuf Writer', () => {
  describe('Serialization of baseline AMAZING_GRACE fixture', () => {
    it('produces valid Uint8Array output', () => {
      const result = writePro(AMAZING_GRACE);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.bytes).toBeInstanceOf(Uint8Array);
      expect(result.bytes.length).toBeGreaterThan(0);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('encodes protobuf matching 1080p geometry, font, and presentation contract', () => {
      const result = writePro(AMAZING_GRACE);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const PresentationType = getProtoRoot().lookupType('Presentation');
      const decoded = PresentationType.decode(result.bytes) as any;
      const decodedObj = PresentationType.toObject(decoded, {
        enums: String,
        defaults: true,
      }) as any;

      expect(decoded.cues.length).toBe(AMAZING_GRACE.slides.length);

      const firstCue = decoded.cues[0];
      expect(firstCue.isEnabled).toBe(true);

      const firstAction = firstCue.actions[0];
      expect(firstAction.isEnabled).toBe(true);
      expect(decodedObj.cues[0].actions[0].type).toBe(
        'ACTION_TYPE_PRESENTATION_SLIDE'
      );

      const baseSlide = firstAction.slide.presentation.baseSlide;
      // 1920x1080 canvas size
      expect(baseSlide.size.width).toBe(1920);
      expect(baseSlide.size.height).toBe(1080);
      // Background color alpha 1
      expect(baseSlide.backgroundColor.alpha).toBe(1);

      const element = baseSlide.elements[0].element;
      // Bounds: { origin: { x: 192, y: 270 }, size: { width: 1536, height: 540 } }
      expect(element.bounds.origin.x).toBe(192);
      expect(element.bounds.origin.y).toBe(270);
      expect(element.bounds.size.width).toBe(1536);
      expect(element.bounds.size.height).toBe(540);

      // 4-point rect path [(0,0), (1,0), (1,1), (0,1)]
      expect(element.path.closed).toBe(true);
      expect(element.path.points).toHaveLength(4);
      expect(element.path.points[0].point.x || 0).toBe(0);
      expect(element.path.points[0].point.y || 0).toBe(0);
      expect(element.path.points[1].point.x).toBe(1);
      expect(element.path.points[1].point.y || 0).toBe(0);
      expect(element.path.points[2].point.x).toBe(1);
      expect(element.path.points[2].point.y).toBe(1);
      expect(element.path.points[3].point.x || 0).toBe(0);
      expect(element.path.points[3].point.y).toBe(1);
      expect(decodedObj.cues[0].actions[0].slide.presentation.baseSlide.elements[0].element.path.shape.type).toBe(
        'TYPE_RECTANGLE'
      );

      // Fill & stroke
      expect(element.fill.color.alpha).toBe(1);
      expect(element.stroke.color.red).toBe(1);
      expect(element.stroke.color.green).toBe(1);
      expect(element.stroke.color.blue).toBe(1);
      expect(element.stroke.color.alpha).toBe(1);

      // Helvetica 48pt font, centered alignment, scaleBehavior 2
      expect(element.text.attributes.font.name).toBe('Helvetica');
      expect(element.text.attributes.font.size).toBe(48);
      expect(decodedObj.cues[0].actions[0].slide.presentation.baseSlide.elements[0].element.text.attributes.paragraphStyle.alignment).toBe(
        'ALIGNMENT_CENTER'
      );
      expect(element.text.attributes.paragraphStyle.lineHeightMultiple).toBe(1);
      expect(decodedObj.cues[0].actions[0].slide.presentation.baseSlide.elements[0].element.text.scaleBehavior).toBe(
        'SCALE_BEHAVIOR_SCALE_FONT_DOWN'
      );
    });
  });

  describe('Round-trip fidelity through parsePro', () => {
    it('preserves all slide lyrics, section names, title, and metadata', () => {
      const writeResult = writePro(AMAZING_GRACE);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const parseResult = parsePro(writeResult.bytes);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;

      const restored = parseResult.value;

      // Title & metadata
      expect(restored.title).toBe(AMAZING_GRACE.title);
      expect(restored.metadata.author).toBe(AMAZING_GRACE.metadata.author);
      expect(restored.metadata.ccli).toBe(AMAZING_GRACE.metadata.ccli);
      expect(restored.metadata.notes).toBe(AMAZING_GRACE.metadata.notes);

      // Section names in order
      expect(restored.sections.map((s) => s.name)).toEqual(
        AMAZING_GRACE.sections.map((s) => s.name)
      );

      // Slide count and all slide lyrics
      expect(restored.slides).toHaveLength(AMAZING_GRACE.slides.length);
      const originalLyrics = AMAZING_GRACE.slides.map(
        (s) => s.items[0]?.plainText
      );
      const restoredLyrics = restored.slides.map(
        (s) => s.items[0]?.plainText
      );
      expect(restoredLyrics).toEqual(originalLyrics);
    });

    it('preserves section color and numeric copyright year', () => {
      const coloredPresentation: Presentation = {
        ...AMAZING_GRACE,
        metadata: {
          ...AMAZING_GRACE.metadata,
          copyright: '2024',
        },
        sections: AMAZING_GRACE.sections.map((sec, i) => ({
          ...sec,
          color: i === 0 ? '#336699' : undefined,
        })),
      };

      const writeResult = writePro(coloredPresentation);
      expect(writeResult.ok).toBe(true);
      if (!writeResult.ok) return;

      const parseResult = parsePro(writeResult.bytes);
      expect(parseResult.ok).toBe(true);
      if (!parseResult.ok) return;

      expect(parseResult.value.metadata.copyright).toBe('2024');
      expect(parseResult.value.sections[0]?.color).toBe('#336699');
    });
  });

  describe('Validation and error handling', () => {
    it('fails closed on presentation with 0 slides', () => {
      const emptyPresentation: Presentation = {
        ...AMAZING_GRACE,
        slides: [],
        sections: [],
        arrangements: [],
      };

      const result = writePro(emptyPresentation);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBeInstanceOf(Error);
        expect(result.error.message).toMatch(/no slides/i);
      }
    });

    it('warns on dangling slide IDs in sections and skips them', () => {
      const danglingPresentation: Presentation = {
        ...AMAZING_GRACE,
        sections: [
          {
            id: 'sec-dangle',
            name: 'Dangler',
            slideIds: ['ag-slide-v1-1', 'non-existent-slide'],
          },
        ],
      };

      const result = writePro(danglingPresentation);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(
        result.warnings.some((w) => w.code === 'PRO_DANGLING_SLIDE_ID')
      ).toBe(true);
    });
  });
});
