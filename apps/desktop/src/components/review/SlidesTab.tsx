import { getSectionStyle } from '../../lib/sectionStyle';
import { getSlidePlainText } from '../../lib/slideText';
import type { ReviewTabProps } from './types';

export function SlidesTab({ song, slideToSection }: ReviewTabProps) {
  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Projection Simulator (16:9)
        </h3>
        <span className="text-xs text-muted-foreground">{song.slides.length} slides</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
        {song.slides.map((slide, index) => {
          const sec = slideToSection.get(slide.id);
          const prevSec =
            index > 0 ? slideToSection.get(song.slides[index - 1]!.id) : null;
          const isSameSectionAsPrev = prevSec?.name === sec?.name;
          const style = getSectionStyle(sec?.name || 'Slide', sec?.color);
          const slideText = getSlidePlainText(slide);

          return (
            <div
              key={slide.id || index}
              className="group relative flex flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-950 text-white shadow-sm transition-all select-text cursor-text hover:border-slate-600 hover:ring-2 hover:ring-primary"
              style={{ aspectRatio: '16 / 9' }}
            >
              <div className="flex flex-1 items-center justify-center overflow-hidden p-3 text-center">
                <p className="line-clamp-4 text-xs font-semibold whitespace-pre-wrap leading-relaxed text-white drop-shadow-md">
                  {slideText || <span className="italic text-slate-500">Blank</span>}
                </p>
              </div>

              <div
                className={`flex h-7 w-full shrink-0 items-center justify-between px-2.5 text-[11px] font-bold select-none shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] ${style.stripeBg} ${style.textColor}`}
                style={style.hex ? { backgroundColor: style.hex } : undefined}
              >
                <span className="truncate">
                  {!isSameSectionAsPrev && (sec?.name || slide.label || 'Slide')}
                </span>
                <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums">
                  {index + 1}/{song.slides.length}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
