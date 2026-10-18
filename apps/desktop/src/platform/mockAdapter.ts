import type { PlatformAdapter, FileFilter } from './adapter';

function normalizePath(p: string): string {
  const normalized = p.replace(/\\/g, '/');
  if (normalized === '/' || normalized === '') {
    return normalized;
  }
  return normalized.replace(/\/+$/, '');
}

export class MockPlatformAdapter implements PlatformAdapter {
  files: Map<string, Uint8Array> = new Map();
  dirs: Set<string> = new Set();
  mockPickedFiles: string[] | null = null;
  mockPickedDirectory: string | null = null;
  openedPaths: string[] = [];

  isMinimized = false;
  isMaximized = false;
  isClosed = false;

  setMockPickedFiles(files: string[] | null): void {
    this.mockPickedFiles = files;
  }

  setMockPickedDirectory(dir: string | null): void {
    this.mockPickedDirectory = dir;
  }

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
      throw new Error(`File not found: ${path}`);
    }
    return data;
  }

  async writeFile(path: string, bytes: Uint8Array): Promise<void> {
    const norm = normalizePath(path);
    this.files.set(norm, bytes);
  }

  async readDir(path: string, options?: { recursive?: boolean }): Promise<string[]> {
    const norm = normalizePath(path);
    const prefix = norm === '' ? '' : norm === '/' ? '/' : `${norm}/`;
    const matched: string[] = [];

    for (const key of this.files.keys()) {
      const normKey = normalizePath(key);
      if (!normKey.startsWith(prefix)) {
        continue;
      }
      if (options?.recursive) {
        matched.push(key);
      } else {
        const sub = normKey.slice(prefix.length);
        if (!sub.includes('/')) {
          matched.push(key);
        }
      }
    }

    return matched.sort();
  }

  async exists(path: string): Promise<boolean> {
    const norm = normalizePath(path);
    if (this.files.has(norm) || this.dirs.has(norm)) {
      return true;
    }

    const prefix = norm === '' ? '' : norm === '/' ? '/' : `${norm}/`;
    for (const key of this.files.keys()) {
      if (normalizePath(key).startsWith(prefix)) {
        return true;
      }
    }
    for (const dir of this.dirs) {
      if (normalizePath(dir).startsWith(prefix)) {
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
