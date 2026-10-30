import type { Presentation, Slide } from '@skeuos-labs/mizmor';

export type SlideToSectionMap = Map<string, { name: string; color?: string }>;

export function getSlidePlainText(slide: Slide): string {
  return slide.items
    .filter((it) => it.type === 'text')
    .map((it) => it.plainText)
    .join('\n')
    .trim();
}

export function buildSlideToSectionMap(song: Presentation): SlideToSectionMap {
  const map: SlideToSectionMap = new Map();
  for (const sec of song.sections) {
    for (const sId of sec.slideIds) {
      if (!map.has(sId)) {
        map.set(sId, { name: sec.name, color: sec.color });
      }
    }
  }
  return map;
}

/** Collapse consecutive arrangement slide sections into a name sequence. */
export function buildArrangementSequence(
  slideIds: string[],
  slideToSection: SlideToSectionMap,
  fallbackSections: Presentation['sections']
): string[] {
  const seq: string[] = [];
  for (const sid of slideIds) {
    const sec = slideToSection.get(sid);
    const name = sec?.name || 'Verse';
    if (seq.length === 0 || seq[seq.length - 1] !== name) {
      seq.push(name);
    }
  }
  return seq.length > 0 ? seq : fallbackSections.map((s) => s.name);
}

