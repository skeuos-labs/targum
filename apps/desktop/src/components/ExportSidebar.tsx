import { FolderOpen, Settings2, Layers, FolderArchive } from 'lucide-react';
import { useSourceStore } from '../state/sourceStore';
import { useExportStore } from '../state/exportStore';
import { getPlatformAdapter } from '../platform';
import type { CollisionPolicy } from '@show-converter/engine';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { FormatOptions } from './export/FormatOptions';
import { ExportFooter } from './export/ExportFooter';

export function ExportSidebar() {
  const selectedSongs = useSourceStore((s) => s.selectedSongs);
  const {
    targetFormat,
    outputDirectory,
    collisionPolicy,
    combineMode,
    combineName,
    libraryName,
    isExporting,
    setTargetFormat,
    setOutputDirectory,
    setCollisionPolicy,
    setCombineMode,
    setLibraryName,
    executeExport,
  } = useExportStore();

  const adapter = getPlatformAdapter();
  const selectedCount = selectedSongs.size;

  const handleBrowseOutput = async () => {
    try {
      const dir = await adapter.pickDirectory({ title: 'Select Output Directory' });
      if (dir) {
        setOutputDirectory(dir);
      }
    } catch {
      // Pick cancelled
    }
  };

  const handleExport = () => {
    executeExport(adapter).catch(() => {});
  };

  const showCombineOption =
    selectedCount > 1 &&
    (targetFormat === 'pptx' || targetFormat === 'vpc' || targetFormat === 'freeshow');
  const showLibraryOption = selectedCount > 1 && targetFormat === 'pro';

  return (
    <aside className="flex h-full w-80 flex-col border-l border-border bg-card/40 select-none overflow-hidden">
      <div className="border-b border-border p-3">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          <Settings2 className="h-3.5 w-3.5" />
          <span>Export</span>
        </h2>
      </div>

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
          {!outputDirectory.trim() && (
            <p className="text-[11px] text-muted-foreground">Select destination folder</p>
          )}
        </div>
      </div>

      <ExportFooter
        selectedCount={selectedCount}
        isExporting={isExporting}
        canExport={selectedCount > 0 && !isExporting && !!outputDirectory.trim()}
        onExport={handleExport}
      />
    </aside>
  );
}
