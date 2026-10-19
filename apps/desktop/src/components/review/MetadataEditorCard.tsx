import { useState } from 'react';
import { Check, ChevronDown, ChevronUp, Tag } from 'lucide-react';
import { useSourceStore } from '../../state/sourceStore';
import { useFlash } from '../../lib/useFlash';
import { Button } from '../ui/button';
import { Card, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import type { ReviewTabProps } from './types';

export function MetadataEditorCard({
  source,
  song,
}: Pick<ReviewTabProps, 'source' | 'song'>) {
  const updateSongTitle = useSourceStore((s) => s.updateSongTitle);
  const updateSongMetadata = useSourceStore((s) => s.updateSongMetadata);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSaved, flashSaved] = useFlash();

  return (
    <Card className="gap-4 border-border py-5 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 pb-3">
        <CardTitle className="m-0">
          <span className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Metadata Editor
            </span>
          </span>
        </CardTitle>
        {isSaved && (
          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-500 animate-in fade-in duration-200">
            <Check className="w-3.5 h-3.5" />
            <span>Saved ✓</span>
          </span>
        )}
      </CardHeader>

      <div className="flex flex-col gap-1.5">
        <Label
          htmlFor="meta-title"
          className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
        >
          Song Title
        </Label>
        <Input
          id="meta-title"
          type="text"
          aria-label="Song Title"
          value={song.title}
          onChange={(e) =>
            updateSongTitle(source.id, song.id, e.target.value)
          }
          onBlur={flashSaved}
          className="h-9 px-3 text-base font-bold"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetaField
          id="meta-author"
          label="Author"
          placeholder="e.g. John Newton"
          value={song.metadata.author || ''}
          onChange={(v) => updateSongMetadata(source.id, song.id, { author: v })}
          onBlur={flashSaved}
        />
        <MetaField
          id="meta-ccli"
          label="CCLI #"
          placeholder="e.g. 22025"
          value={song.metadata.ccli || ''}
          onChange={(v) => updateSongMetadata(source.id, song.id, { ccli: v })}
          onBlur={flashSaved}
        />
        <MetaField
          id="meta-copyright"
          label="Copyright"
          placeholder="e.g. Public Domain"
          value={song.metadata.copyright || ''}
          onChange={(v) => updateSongMetadata(source.id, song.id, { copyright: v })}
          onBlur={flashSaved}
        />
      </div>

      <div className="pt-2">
        <Button
          type="button"
          variant="link"
          size="xs"
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className="h-auto p-0 select-none"
        >
          {isDrawerOpen ? (
            <>
              <ChevronUp data-icon="inline-start" />
              <span>Hide Extended Metadata</span>
            </>
          ) : (
            <>
              <ChevronDown data-icon="inline-start" />
              <span>View More Metadata</span>
            </>
          )}
        </Button>

        {isDrawerOpen && (
          <div className="mt-3 animate-in fade-in duration-150 space-y-3 border-t border-border/60 pt-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MetaField
                id="meta-language"
                label="Language"
                placeholder="e.g. en-US"
                value={song.metadata.language || ''}
                onChange={(v) => updateSongMetadata(source.id, song.id, { language: v })}
                onBlur={flashSaved}
              />
              <MetaField
                id="meta-theme"
                label="Theme Name"
                placeholder="e.g. Classic Dark"
                value={song.metadata.themeName || ''}
                onChange={(v) => updateSongMetadata(source.id, song.id, { themeName: v })}
                onBlur={flashSaved}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor="meta-notes"
                className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
              >
                Notes
              </Label>
              <Textarea
                id="meta-notes"
                rows={3}
                aria-label="Notes"
                value={song.metadata.notes || ''}
                placeholder="Additional performance notes or copyright remarks..."
                onChange={(e) =>
                  updateSongMetadata(source.id, song.id, { notes: e.target.value })
                }
                onBlur={flashSaved}
                className="p-2.5 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-6 pt-1 text-xs text-muted-foreground">
              <div>
                <span className="font-semibold text-foreground/80">Song ID: </span>
                <code className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]">
                  {song.id}
                </code>
              </div>
              <div>
                <span className="font-semibold text-foreground/80">Original File: </span>
                <span>{song.metadata.originalFileName || source.name}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function MetaField({
  id,
  label,
  placeholder,
  value,
  onChange,
  onBlur,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label
        htmlFor={id}
        className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
      >
        {label}
      </Label>
      <Input
        id={id}
        type="text"
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="h-8 px-2.5 text-xs"
      />
    </div>
  );
}
