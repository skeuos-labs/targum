import { Check, Copy } from 'lucide-react';
import { useFlash } from '../../lib/useFlash';
import { Button } from '../ui/button';
import { JsonTreeNode } from '../JsonTreeNode';
import type { ReviewTabProps } from './types';

export function JsonTab({ song }: ReviewTabProps) {
  const [copied, flashCopied] = useFlash();

  const handleCopyJson = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(JSON.stringify(song, null, 2));
        flashCopied();
      }
    } catch {
      // clipboard fallback
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Canonical Presentation AST (JSON)
        </h3>
        <Button type="button" variant="secondary" size="xs" onClick={handleCopyJson}>
          {copied ? (
            <>
              <Check data-icon="inline-start" className="text-emerald-500" />
              <span className="text-emerald-500">Copied!</span>
            </>
          ) : (
            <>
              <Copy data-icon="inline-start" />
              <span>Copy JSON</span>
            </>
          )}
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#181D26] p-5 font-mono text-xs text-[#E5E7EB] shadow-inner">
        <JsonTreeNode value={song} />
      </div>
    </div>
  );
}
