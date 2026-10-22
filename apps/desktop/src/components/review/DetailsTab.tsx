import { formatSourceFormatLabel } from '../../lib/formatLabels';
import { Card } from '../ui/card';
import { MetadataEditorCard } from './MetadataEditorCard';
import { ArrangementFlowCard } from './ArrangementFlowCard';
import type { ReviewTabProps } from './types';

/** Metadata editor + metrics + arrangement (Details tab). */
export function DetailsTab({
  source,
  song,
  slideToSection,
}: Omit<ReviewTabProps, 'warnings'>) {
  const sectionCount = song.sections.length;
  const slideCount = song.slides.length;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <MetadataEditorCard source={source} song={song} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Source Format"
          value={formatSourceFormatLabel(song.sourceFormat || source.format)}
        />
        <MetricCard label="Total Sections" value={sectionCount} large />
        <MetricCard label="Total Slides" value={slideCount} large />
      </div>

      <ArrangementFlowCard song={song} slideToSection={slideToSection} />
    </div>
  );
}

function MetricCard({
  label,
  value,
  large,
}: {
  label: string;
  value: string | number;
  large?: boolean;
}) {
  return (
    <Card size="sm" className="gap-1 shadow-sm">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={
          large ? 'text-xl font-extrabold text-foreground' : 'text-sm font-bold text-foreground'
        }
      >
        {value}
      </span>
    </Card>
  );
}
