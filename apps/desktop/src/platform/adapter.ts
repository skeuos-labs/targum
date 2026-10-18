export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface PlatformAdapter {
  pickFiles(options?: { filters?: FileFilter[] }): Promise<string[] | null>;
  pickDirectory(options?: { title?: string }): Promise<string | null>;
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  readDir(path: string, options?: { recursive?: boolean }): Promise<string[]>;
  exists(path: string): Promise<boolean>;
  createDir(path: string): Promise<void>;
  openPath(path: string): Promise<void>;
  window: {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    toggleMaximize(): Promise<void>;
    close(): Promise<void>;
  };
}
