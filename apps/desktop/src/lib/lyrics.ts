import type { Presentation } from '@show-converter/engine';
import { getSlidePlainText, type SlideToSectionMap } from './slideText';

/**
 * Ordered lyrics: arrangement order (or slide order), grouped by section,
 * double newline between sections.
 */
export function formatLyricsForCopy(
  song: Presentation,
  slideToSection: SlideToSectionMap
): string {
  const arrangement = song.arrangements[0];
  const orderedSlideIds = arrangement?.slideIds?.length
    ? arrangement.slideIds
    : song.slides.map((s) => s.id);

  const slideMap = new Map(song.slides.map((s) => [s.id, s]));
  const sectionTexts: string[] = [];
  let currentSectionName: string | undefined;
  let currentSlideTexts: string[] = [];

  const flushSection = () => {
    if (currentSlideTexts.length > 0) {
      sectionTexts.push(currentSlideTexts.join('\n'));
      currentSlideTexts = [];
    }
  };

  for (const sId of orderedSlideIds) {
    const slide = slideMap.get(sId);
    if (!slide) continue;
    const sec = slideToSection.get(sId);
    const secName = sec?.name || 'Verse';
    if (currentSectionName !== undefined && secName !== currentSectionName) {
      flushSection();
    }
    currentSectionName = secName;
    const text = getSlidePlainText(slide);
    if (text) currentSlideTexts.push(text);
  }
  flushSection();

  return sectionTexts.join('\n\n');
}
