import { useMemo } from 'react';
import type { Presentation } from '@skeuos-labs/mizmor';
import { buildSlideToSectionMap, type SlideToSectionMap } from './slideText';

/** Memoized slideId → section lookup for a presentation. */
export function useSlideToSectionMap(song: Presentation | undefined): SlideToSectionMap {
  return useMemo(
    () => (song ? buildSlideToSectionMap(song) : new Map()),
    [song]
  );
}

