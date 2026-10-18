import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  readFile as tauriReadFile,
  writeFile as tauriWriteFile,
  readDir as tauriReadDir,
  mkdir as tauriMkdir,
  exists as tauriExists,
} from '@tauri-apps/plugin-fs';
import { openPath as tauriOpenPath } from '@tauri-apps/plugin-opener';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { PlatformAdapter, FileFilter } from './adapter';

export class TauriPlatformAdapter implements PlatformAdapter {
  async pickFiles(options?: { filters?: FileFilter[] }): Promise<string[] | null> {
    const selected = await openDialog({
      multiple: true,
      directory: false,
      filters: options?.filters,
    });
    if (selected === null) {
      return null;
    }
    if (Array.isArray(selected)) {
      return selected;
    }
    return [selected];
  }

  async pickDirectory(options?: { title?: string }): Promise<string | null> {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: options?.title,
    });
    if (Array.isArray(selected)) {
      return selected[0] ?? null;
    }
    return selected;
  }

  async readFile(path: string): Promise<Uint8Array> {
    return await tauriReadFile(path);
  }

  async writeFile(path: string, bytes: Uint8Array): Promise<void> {
    await tauriWriteFile(path, bytes);
  }

  async readDir(path: string, options?: { recursive?: boolean }): Promise<string[]> {
    const filePaths: string[] = [];

    const walk = async (currentDir: string): Promise<void> => {
      const entries = await tauriReadDir(currentDir);
      for (const entry of entries) {
        const fullPath = currentDir.endsWith('/') || currentDir.endsWith('\\')
          ? `${currentDir}${entry.name}`
          : `${currentDir}/${entry.name}`;

        if (entry.isDirectory) {
          if (options?.recursive) {
            await walk(fullPath);
          }
        } else {
          filePaths.push(fullPath);
        }
      }
    };

    await walk(path);
    return filePaths.sort();
  }

  async exists(path: string): Promise<boolean> {
    return await tauriExists(path);
  }

  async createDir(path: string): Promise<void> {
    await tauriMkdir(path, { recursive: true });
  }

  async openPath(path: string): Promise<void> {
    await tauriOpenPath(path);
  }

  window = {
    minimize: async (): Promise<void> => {
      await getCurrentWindow().minimize();
    },
    maximize: async (): Promise<void> => {
      await getCurrentWindow().maximize();
    },
    toggleMaximize: async (): Promise<void> => {
      await getCurrentWindow().toggleMaximize();
    },
    close: async (): Promise<void> => {
      await getCurrentWindow().close();
    },
  };
}
