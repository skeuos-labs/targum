import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';

export function ExportFooter({
  selectedCount,
  isExporting,
  canExport,
  onExport,
}: {
  selectedCount: number;
  isExporting: boolean;
  canExport: boolean;
  onExport: () => void;
}) {
  return (
    <div className="border-t border-border bg-card/80 p-3">
      <Button
        type="button"
        disabled={!canExport}
        onClick={onExport}
        className="w-full justify-center py-2.5 text-xs font-semibold"
      >
        <CheckCircle2 data-icon="inline-start" />
        <span>
          {isExporting
            ? 'Exporting...'
            : `Export ${selectedCount} Song${selectedCount === 1 ? '' : 's'}`}
        </span>
        <ArrowRight data-icon="inline-end" />
      </Button>
    </div>
  );
}
