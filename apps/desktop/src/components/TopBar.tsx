import { Minus, Square, X, Sun, Moon, Laptop } from 'lucide-react';
import { useThemeStore, type Theme } from '../state/themeStore';
import { getPlatformAdapter } from '../platform';

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
      <div className="flex items-center space-x-2" data-tauri-drag-region>
        <span className="font-bold tracking-tight text-foreground">
          Show Converter
        </span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          v0.1.0
        </span>
      </div>

      {/* Right Controls: Theme Selector + Window Controls */}
      <div className="flex items-center space-x-3">
        {/* Theme Dropdown */}
        <div className="flex items-center space-x-1.5 text-muted-foreground">
          {theme === 'dark' ? (
            <Moon className="h-3.5 w-3.5" />
          ) : theme === 'light' ? (
            <Sun className="h-3.5 w-3.5" />
          ) : (
            <Laptop className="h-3.5 w-3.5" />
          )}
          <select
            aria-label="Theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
            className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>

        {/* Window Controls */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            aria-label="Minimize"
            onClick={handleMinimize}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="Maximize"
            onClick={handleToggleMaximize}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Square className="h-3 w-3" />
          </button>
          <button
            type="button"
            aria-label="Close"
            onClick={handleClose}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
