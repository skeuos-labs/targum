import type { Presentation, Warning } from '@show-converter/engine';
import type { SourceFile } from '../../state/sourceStore';
import type { SlideToSectionMap } from '../../lib/slideText';

export interface ReviewTabProps {
  source: SourceFile;
  song: Presentation;
  slideToSection: SlideToSectionMap;
  warnings: Warning[];
}
