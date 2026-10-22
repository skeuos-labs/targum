import { useEffect, useRef } from 'react';
import { useUiStore } from '../../state/uiStore';
import { useExportStore } from '../../state/exportStore';
import { useSourceStore } from '../../state/sourceStore';
import { getExportBlockReason } from '../../lib/exportEligibility';
import { ExportPeek } from './ExportPeek';
import { ExportSettings } from './ExportSettings';

/**
 * Right export drawer. Collapsed peek is the default; expanding swaps the
 * status-only rows for full settings while keeping the Export button pinned.
 * Never resets store settings or selection on collapse.
 */
export function ExportDrawer() {
  const expanded = useUiStore((s) => s.exportDrawerExpanded);
  const setExpanded = useUiStore((s) => s.setExportDrawerExpanded);
  const selectedCount = useSourceStore((s) => s.selectedSongs.size);
  const outputDirectory = useExportStore((s) => s.outputDirectory);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const blockReason = getExportBlockReason(selectedCount, outputDirectory);

  // Expanding while the destination is unset puts the caret in the path input.
  useEffect(() => {
    if (expanded && blockReason === 'no-output-dir') {
      inputRef.current?.focus();
    }
  }, [expanded, blockReason]);

  const handleToggle = () => {
    setExpanded(!expanded);
  };

  const handleHelperClick = () => {
    if (!expanded) {
      // Focus follows via the effect above when the reason is no-output-dir.
      setExpanded(true);
      return;
    }
    if (blockReason === 'no-output-dir') {
      inputRef.current?.focus();
    }
  };

  return (
    <aside
      data-drop-target="export"
      className="relative flex h-full w-80 flex-col border-l border-border bg-card/40 select-none overflow-hidden"
    >
      <ExportPeek
        expanded={expanded}
        onToggle={handleToggle}
        onHelperClick={handleHelperClick}
      >
        {expanded && <ExportSettings inputRef={inputRef} />}
      </ExportPeek>
    </aside>
  );
}
