import type { PlatformAdapter, FileFilter, NativeDragDropEvent } from './adapter';

function normalizePath(p: string): string {
  return p.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/$/, '');
}

export class MockPlatformAdapter implements PlatformAdapter {
  files = new Map<string, Uint8Array>();
  dirs = new Set<string>();
  openedPaths: string[] = [];

  mockPickedFiles: string[] | null = null;
  mockPickedDirectory: string | null = null;

  setMockPickedFiles(files: string[] | null): void {
    this.mockPickedFiles = files;
  }

  setMockPickedDirectory(dir: string | null): void {
    this.mockPickedDirectory = dir;
  }

  isMinimized = false;
  isMaximized = false;
  isClosed = false;

  private dragDropListeners = new Set<(event: NativeDragDropEvent) => void>();

  async pickFiles(_options?: { filters?: FileFilter[] }): Promise<string[] | null> {
    return this.mockPickedFiles;
  }

  async pickDirectory(_options?: { title?: string }): Promise<string | null> {
    return this.mockPickedDirectory;
  }

  async readFile(path: string): Promise<Uint8Array> {
    const norm = normalizePath(path);
    const data = this.files.get(norm);
    if (!data) {
      throw new Error(`File not found in MockPlatformAdapter: ${path}`);
    }
    return data.slice();
  }

  async writeFile(path: string, bytes: Uint8Array): Promise<void> {
    const norm = normalizePath(path);
    this.files.set(norm, bytes.slice());

    // Auto-create parent directory in mock store
    const lastSlash = norm.lastIndexOf('/');
    if (lastSlash > 0) {
      this.dirs.add(norm.slice(0, lastSlash));
    }
  }

  async readDir(path: string, options?: { recursive?: boolean }): Promise<string[]> {
    const norm = normalizePath(path);
    const prefix = `${norm}/`;
    const matched: string[] = [];

    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        const sub = key.slice(prefix.length);
        if (!options?.recursive && sub.includes('/')) {
          continue;
        }
        matched.push(key);
      }
    }

    return matched.sort();
  }

  async exists(path: string): Promise<boolean> {
    const norm = normalizePath(path);
    if (this.files.has(norm) || this.dirs.has(norm)) {
      return true;
    }

    const prefix = `${norm}/`;
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        return true;
      }
    }

    return false;
  }

  async createDir(path: string): Promise<void> {
    const norm = normalizePath(path);
    this.dirs.add(norm);
  }

  async openPath(path: string): Promise<void> {
    this.openedPaths.push(path);
  }

  onDragDrop(handler: (event: NativeDragDropEvent) => void): () => void {
    this.dragDropListeners.add(handler);
    return () => {
      this.dragDropListeners.delete(handler);
    };
  }

  simulateDragDrop(event: NativeDragDropEvent): void {
    for (const listener of this.dragDropListeners) {
      listener(event);
    }
  }

  window = {
    minimize: async (): Promise<void> => {
      this.isMinimized = true;
      this.isMaximized = false;
    },
    maximize: async (): Promise<void> => {
      this.isMaximized = true;
      this.isMinimized = false;
    },
    toggleMaximize: async (): Promise<void> => {
      this.isMaximized = !this.isMaximized;
      if (this.isMaximized) {
        this.isMinimized = false;
      }
    },
    close: async (): Promise<void> => {
      this.isClosed = true;
    },
  };
}
