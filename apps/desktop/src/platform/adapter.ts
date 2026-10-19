export interface FileFilter {
  name: string;
  extensions: string[];
}

export interface DragPosition {
  x: number;
  y: number;
}

export type NativeDragDropEvent =
  | { type: 'enter'; paths: string[]; position?: DragPosition }
  | { type: 'over'; position?: DragPosition }
  | { type: 'leave' }
  | { type: 'drop'; paths: string[]; position?: DragPosition };

export interface PlatformAdapter {
  /** Open native file picker (supports multiple files) */
  pickFiles(options?: { filters?: FileFilter[] }): Promise<string[] | null>;
  /** Open native directory picker */
  pickDirectory(options?: { title?: string }): Promise<string | null>;
  /** Read binary file from disk */
  readFile(path: string): Promise<Uint8Array>;
  /** Write binary file to disk */
  writeFile(path: string, bytes: Uint8Array): Promise<void>;
  /** Read directory entries (returns paths of files inside) */
  readDir(path: string, options?: { recursive?: boolean }): Promise<string[]>;
  /** Check if path exists */
  exists(path: string): Promise<boolean>;
  /** Create directory recursively */
  createDir(path: string): Promise<void>;
  /** Open folder or file in OS file explorer */
  openPath(path: string): Promise<void>;
  /** Register OS drag and drop listener (Tauri native file drops) */
  onDragDrop?(handler: (event: NativeDragDropEvent) => void): () => void;
  /** Window control operations */
  window: {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    toggleMaximize(): Promise<void>;
    close(): Promise<void>;
  };
}
