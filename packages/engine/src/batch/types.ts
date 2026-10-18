import type { FormatId, Warning } from '../canonical/types.js';

export type CollisionPolicy = 'rename' | 'skip' | 'overwrite' | 'error';

export interface BatchConvertOptions {
  inputs: string[];
  to: FormatId;
  outDir: string;
  recursive?: boolean;
  onCollision?: CollisionPolicy;
  combine?: boolean;
  combineName?: string;
  libraryName?: string;
  strict?: boolean;
}

export interface BatchItemResult {
  sourcePath: string;
  sourceFormat: FormatId;
  presentationTitle: string;
  outputPath?: string;
  status: 'success' | 'skipped' | 'failed';
  warnings: Warning[];
  error?: Error;
}

export interface BatchSummary {
  totalFiles: number;
  totalSongs: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  warningCount: number;
  items: BatchItemResult[];
  combinedOutputPath?: string;
  durationMs: number;
}

export type BatchProgressCallback = (progress: {
  currentFile: number;
  totalFiles: number;
  sourcePath: string;
  songCount?: number;
  status: 'processing' | 'success' | 'skipped' | 'failed';
  error?: Error;
}) => void;
