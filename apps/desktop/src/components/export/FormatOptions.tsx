import { FileBox } from 'lucide-react';
import type { FormatId } from '@skeuos-labs/mizmor';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

interface FormatOption {
  id: FormatId;
  label: string;
  ext: string;
}

export const FORMAT_OPTIONS: FormatOption[] = [
  { id: 'pro', label: 'ProPresenter', ext: '.pro' },
  { id: 'vpc', label: 'VideoPsalm', ext: '.vpc' },
  { id: 'freeshow', label: 'FreeShow', ext: '.show' },
  { id: 'txt', label: 'Plain Text', ext: '.txt' },
  { id: 'pptx', label: 'PowerPoint', ext: '.pptx' },
];

export function FormatOptions({
  value,
  onChange,
}: {
  value: FormatId;
  onChange: (id: FormatId) => void;
}) {
  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold text-foreground">Target Format</span>
      <div className="grid grid-cols-1 gap-1.5">
        {FORMAT_OPTIONS.map((f) => {
          const isSelected = value === f.id;
          return (
            <Button
              key={f.id}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              aria-label={f.label}
              onClick={() => onChange(f.id)}
              className="h-auto justify-between rounded-md px-3 py-2 text-xs font-normal"
            >
              <span className="flex items-center gap-2">
                <FileBox data-icon="inline-start" className="opacity-80" />
                <span>{f.label}</span>
              </span>
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 font-mono text-[10px]',
                  isSelected
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {f.ext}
              </span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

