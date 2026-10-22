import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useUiStore } from '../../state/uiStore';
import { Button } from '../ui/button';

/** Overflow dropdown: Full diagnostics → warnings sheet; Raw JSON AST → JSON modal. */
export function OverflowMenu() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const setWarningsSheetOpen = useUiStore((s) => s.setWarningsSheetOpen);
  const setJsonViewerOpen = useUiStore((s) => s.setJsonViewerOpen);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent | MouseEvent) => {
      const target = event.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [open]);

  // Focus first item on open so keyboard users land inside the menu.
  useEffect(() => {
    if (open) {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    }
  }, [open]);

  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    if (items.length === 0) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    const currentIndex = items.findIndex((item) => item === document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(currentIndex + 1) % items.length]!.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length]!.focus();
    }
  };

  const select = (action: () => void) => {
    setOpen(false);
    action();
  };

  return (
    <div ref={rootRef} className="relative">
      <Button
        ref={triggerRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal />
      </Button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          aria-label="More"
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-border bg-popover p-1 text-sm text-popover-foreground shadow-md"
        >
          <button
            type="button"
            role="menuitem"
            className="w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium hover:bg-muted"
            onClick={() => select(() => setWarningsSheetOpen(true))}
          >
            Full diagnostics
          </button>
          <button
            type="button"
            role="menuitem"
            className="w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium hover:bg-muted"
            onClick={() => select(() => setJsonViewerOpen(true))}
          >
            Raw JSON AST
          </button>
        </div>
      )}
    </div>
  );
}
