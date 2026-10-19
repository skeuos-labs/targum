import { Music, ArrowRight } from 'lucide-react';
import { buildArrangementSequence } from '../../lib/slideText';
import { getSectionStyle } from '../../lib/sectionStyle';
import { Card } from '../ui/card';
import type { ReviewTabProps } from './types';

export function ArrangementFlowCard({
  song,
  slideToSection,
}: Pick<ReviewTabProps, 'song' | 'slideToSection'>) {
  const sequenceFor = (slideIds: string[]) =>
    buildArrangementSequence(slideIds, slideToSection, song.sections);

  return (
    <Card className="gap-3 border-border p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2 border-b border-border/60 pb-2.5">
        <Music className="w-4 h-4 text-primary" />
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Arrangement Flow
        </h3>
      </div>

      {song.arrangements.length > 0 ? (
        <div className="space-y-3">
          {song.arrangements.map((arr) => (
            <div
              key={arr.id}
              className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center"
            >
              <span className="shrink-0 rounded border border-border bg-muted px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
                {arr.name}
              </span>
              <SequenceChips
                names={sequenceFor(arr.slideIds)}
                song={song}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-xs">
          <span className="shrink-0 rounded border border-border bg-muted px-2 py-0.5 font-mono text-[11px] font-bold text-foreground">
            Linear
          </span>
          <SequenceChips names={song.sections.map((s) => s.name)} song={song} />
        </div>
      )}
    </Card>
  );
}

function SequenceChips({
  names,
  song,
}: {
  names: string[];
  song: ReviewTabProps['song'];
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {names.map((secName, idx) => {
        const sec = song.sections.find((s) => s.name === secName);
        const style = getSectionStyle(secName, sec?.color);
        return (
          <span key={`${secName}-${idx}`} className="flex items-center gap-1.5">
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.badgeBg}`}
              style={style.hex ? { borderColor: `${style.hex}50` } : undefined}
            >
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${style.dotBg}`}
                style={style.hex ? { backgroundColor: style.hex } : undefined}
              />
              <span>{secName}</span>
            </span>
            {idx < names.length - 1 && (
              <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/60" />
            )}
          </span>
        );
      })}
    </div>
  );
}
