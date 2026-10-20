import { Minus, Square, X, Sun, Moon, Laptop } from 'lucide-react';
import { useThemeStore, type Theme } from '../state/themeStore';
import { getPlatformAdapter } from '../platform';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function TopBar() {
  const { theme, setTheme } = useThemeStore();
  const adapter = getPlatformAdapter();

  const handleMinimize = () => {
    adapter.window.minimize().catch(() => {});
  };

  const handleToggleMaximize = () => {
    adapter.window.toggleMaximize().catch(() => {});
  };

  const handleClose = () => {
    adapter.window.close().catch(() => {});
  };

  return (
    <header
      className="flex h-10 w-full items-center justify-between border-b border-border bg-card px-3 text-xs select-none"
      data-tauri-drag-region
    >
      {/* Brand & Version */}
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <span className="font-bold tracking-tight text-foreground">
          Show Converter
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          v0.1.0
        </span>
      </div>

      {/* Right Controls: Theme Selector + Window Controls */}
      <div className="flex items-center gap-3">
        {/* Theme Dropdown */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {theme === 'dark' ? (
            <Moon data-icon="inline-start" />
          ) : theme === 'light' ? (
            <Sun data-icon="inline-start" />
          ) : (
            <Laptop data-icon="inline-start" />
          )}
          <Select value={theme} onValueChange={(value) => setTheme(value as Theme)}>
            <SelectTrigger
              aria-label="Theme"
              className="w-auto"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEME_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            aria-label="Minimize"
            onClick={handleMinimize}
          >
            <Minus />
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-label="Maximize"
            onClick={handleToggleMaximize}
          >
            <Square />
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-label="Close"
            onClick={handleClose}
            className="hover:bg-destructive hover:text-destructive-foreground"
          >
            <X />
          </Button>
        </div>
      </div>
    </header>
  );
}
