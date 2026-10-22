import type { Presentation } from '@show-converter/engine';
import { Check, Copy } from 'lucide-react';
import { useCopyText } from '../../lib/useCopyText';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { JsonTreeNode } from '../JsonTreeNode';

/** Modal wrapping the canonical AST JSON tree + Copy JSON. */
export function JsonViewerModal({ song }: { song: Presentation }) {
  const open = useUiStore((s) => s.jsonViewerOpen);
  const setJsonViewerOpen = useUiStore((s) => s.setJsonViewerOpen);
  const { copied, copy } = useCopyText();

  const handleCopyJson = () => copy(JSON.stringify(song, null, 2));

  return (
    <Dialog open={open} onOpenChange={(next) => setJsonViewerOpen(next)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-8">
            <div>
              <DialogTitle>Raw JSON AST</DialogTitle>
              <DialogDescription className="mt-1">
                Canonical presentation JSON
              </DialogDescription>
            </div>
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
        </DialogHeader>

        <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-800 bg-[#181D26] p-4 font-mono text-xs text-[#E5E7EB] shadow-inner">
          <JsonTreeNode value={song} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
