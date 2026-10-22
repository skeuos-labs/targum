import type { Slide } from '@show-converter/engine';
import { getSectionStyle } from '../../lib/sectionStyle';
import { getSlidePlainText } from '../../lib/slideText';
import type { ReviewTabProps } from './types';

/** Sections & Lyrics spine (header owns Copy lyrics). */
export function StructureView({ song }: Pick<ReviewTabProps, 'song'>) {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Sections & Lyrics Spine
        </h3>
      </div>

      <div className="space-y-4">
        {song.sections.map((sec) => {
          const style = getSectionStyle(sec.name, sec.color);
          const sectionSlides = sec.slideIds
            .map((id) => song.slides.find((s) => s.id === id))
            .filter((s): s is Slide => s !== undefined);

          return (
            <div
              key={sec.id}
              className="flex overflow-hidden rounded-lg border border-border bg-card shadow-xs"
            >
              <div
                className={`flex w-[36px] shrink-0 items-center justify-center p-2 text-xs font-bold uppercase tracking-wider select-none ${style.stripeBg} ${style.textColor}`}
                style={{
                  writingMode: 'vertical-lr',
                  transform: 'rotate(180deg)',
                  backgroundColor: style.hex || undefined,
                }}
              >
                {sec.name}
              </div>

              <div className="flex-1 divide-y divide-border/60">
                {sectionSlides.map((slide, sIdx) => {
                  const text = getSlidePlainText(slide);
                  return (
                    <div
                      key={slide.id}
                      className={`flex items-start gap-4 p-3.5 ${
                        sIdx % 2 === 0 ? 'bg-card' : 'bg-muted/40'
                      }`}
                    >
                      <span className="w-8 shrink-0 pt-0.5 text-center font-mono text-xs font-semibold text-muted-foreground select-none">
                        {sIdx + 1}
                      </span>
                      <pre className="flex-1 font-sans text-xs whitespace-pre-wrap leading-relaxed text-foreground">
                        {text || <span className="italic text-muted-foreground">Blank</span>}
                      </pre>
                    </div>
                  );
                })}
                {sectionSlides.length === 0 && (
                  <div className="p-4 text-center text-xs italic text-muted-foreground">
                    No slides in this section
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
