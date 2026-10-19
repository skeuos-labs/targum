import { UploadCloud } from 'lucide-react';
import { useDndStore, type DropTargetId } from '../state/dndStore';

interface DropOverlayProps {
  targetId: DropTargetId;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

/** Full-zone translucent drop hint. `pointer-events-none` so it never steals drag events. */
export function DropOverlay({
  targetId,
  title = 'Drop files to import',
  subtitle,
  compact = false,
}: DropOverlayProps) {
  const dragging = useDndStore((s) => s.dragging);
  const activeTarget = useDndStore((s) => s.target);
  if (!dragging || activeTarget !== targetId) {
    return null;
  }

  return (
    <div
      aria-hidden
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 p-4 border-2 border-dashed border-primary pointer-events-none"
    >
      <UploadCloud
        className={`text-primary animate-bounce mb-2 ${compact ? 'h-10 w-10' : 'h-12 w-12 mb-3'}`}
      />
      <p className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-foreground`}>{title}</p>
      {subtitle && (
        <p className={`text-muted-foreground mt-1 ${compact ? 'text-[11px]' : 'text-xs'}`}>{subtitle}</p>
      )}
    </div>
  );
}
