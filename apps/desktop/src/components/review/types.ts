import type { Presentation, Warning } from '@skeuos-labs/mizmor';
import type { SourceFile } from '../../state/sourceStore';
import type { SlideToSectionMap } from '../../lib/slideText';

export interface ReviewTabProps {
  source: SourceFile;
  song: Presentation;
  slideToSection: SlideToSectionMap;
  warnings: Warning[];
}

