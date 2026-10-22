import { useUiStore } from '../../state/uiStore';
import { ContentHeader } from './ContentHeader';
import { StructureView } from './StructureView';
import { ProjectionView } from './ProjectionView';
import type { ReviewTabProps } from './types';

export interface ContentTabProps extends ReviewTabProps {
  subtitle: string;
}

/** Content tab: header + Structure|Projection segment view. */
export function ContentTab({
  source,
  song,
  slideToSection,
  warnings,
  subtitle,
}: ContentTabProps) {
  const contentSegment = useUiStore((s) => s.contentSegment);

  return (
    <div className="space-y-5">
      <ContentHeader
        format={source.format}
        fileName={source.name}
        songTitle={song.title}
        subtitle={subtitle}
        warnings={warnings}
        song={song}
        slideToSection={slideToSection}
      />
      {contentSegment === 'structure' ? (
        <StructureView song={song} />
      ) : (
        <ProjectionView song={song} slideToSection={slideToSection} />
      )}
    </div>
  );
}
