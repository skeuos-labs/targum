import type { RefObject } from 'react';
import { FolderArchive, FolderOpen, Layers } from 'lucide-react';
import type { CollisionPolicy } from '@skeuos-labs/mizmor';
import { useSourceStore } from '../../state/sourceStore';
import { useExportStore } from '../../state/exportStore';
import { getPlatformAdapter } from '../../platform';
import { Button } from '../ui/button';
import { Checkbox } from '../ui/checkbox';
import { Input } from '../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { FormatOptions } from './FormatOptions';

/** Expanded export configuration body (format grid, multi-song, collision, destination). */
export function ExportSettings({ inputRef }: { inputRef: RefObject<HTMLInputElement | null> }) {
  const selectedCount = useSourceStore((s) => s.selectedSongs.size);
  const targetFormat = useExportStore((s) => s.targetFormat);
  const outputDirectory = useExportStore((s) => s.outputDirectory);
  const collisionPolicy = useExportStore((s) => s.collisionPolicy);
  const combineMode = useExportStore((s) => s.combineMode);
  const combineName = useExportStore((s) => s.combineName);
  const libraryName = useExportStore((s) => s.libraryName);
  const setTargetFormat = useExportStore((s) => s.setTargetFormat);
  const setOutputDirectory = useExportStore((s) => s.setOutputDirectory);
  const setCollisionPolicy = useExportStore((s) => s.setCollisionPolicy);
  const setCombineMode = useExportStore((s) => s.setCombineMode);
  const setLibraryName = useExportStore((s) => s.setLibraryName);

  const handleBrowseOutput = async () => {
    try {
      const dir = await getPlatformAdapter().pickDirectory({ title: 'Select Output Directory' });
      if (dir) {
        setOutputDirectory(dir);
      }
    } catch {
      // Pick cancelled
    }
  };

  const showCombineOption =
    selectedCount > 1 &&
    (targetFormat === 'pptx' || targetFormat === 'vpc' || targetFormat === 'freeshow');
  const showLibraryOption = selectedCount > 1 && targetFormat === 'pro';

  return (
    <div className="flex-1 space-y-5 overflow-y-auto p-3">
      <FormatOptions value={targetFormat} onChange={setTargetFormat} />

      {(showCombineOption || showLibraryOption) && (
        <div className="space-y-3 rounded-md border border-border bg-card/60 p-3">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>Multi-song Options</span>
          </span>

          {showCombineOption && (
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                <Checkbox
                  checked={combineMode}
                  onCheckedChange={(checked) =>
                    setCombineMode(
                      checked === true,
                      checked === true ? combineName : undefined
                    )
                  }
                  aria-label="Combine into single file"
                />
                <span>Combine into single file</span>
              </label>
              {combineMode && (
                <Input
                  placeholder="Combined filename (e.g. WorshipSet)"
                  value={combineName}
                  onChange={(e) => setCombineMode(true, e.target.value)}
                  className="h-7 px-2.5 text-xs"
                />
              )}
            </div>
          )}

          {showLibraryOption && (
            <div className="flex flex-col gap-1.5">
              <label className="flex items-center gap-1 text-xs text-foreground">
                <FolderArchive className="h-3 w-3 text-muted-foreground" />
                <span>Library Folder Name (Optional)</span>
              </label>
              <Input
                placeholder="e.g. SundayService"
                value={libraryName}
                onChange={(e) => setLibraryName(e.target.value)}
                className="h-7 px-2.5 text-xs"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="collision-policy-select"
          className="text-xs font-semibold text-foreground"
        >
          Collision Policy
        </label>
        <Select
          value={collisionPolicy}
          onValueChange={(value) => setCollisionPolicy(value as CollisionPolicy)}
        >
          <SelectTrigger
            id="collision-policy-select"
            aria-label="Collision Policy"
            size="sm"
            className="w-full"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rename">Auto-rename</SelectItem>
            <SelectItem value="skip">Skip existing</SelectItem>
            <SelectItem value="overwrite">Overwrite</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-foreground">Output Directory</span>
        <div className="flex gap-1.5">
          <Input
            id="output-directory-input"
            ref={inputRef}
            placeholder="/path/to/output"
            value={outputDirectory}
            onChange={(e) => setOutputDirectory(e.target.value)}
            className="h-7 flex-1 truncate px-2.5 text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={handleBrowseOutput}
            className="shrink-0"
          >
            <FolderOpen data-icon="inline-start" />
            <span>Browse...</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

