import type { FormatId, Library, Warning } from '../canonical/index.js';
import { parseFreeShow, writeFreeShow } from '../formats/freeshow/index.js';
import { parsePptx, writePptx } from '../formats/pptx/index.js';
import { parsePro, parsePro6, writePro } from '../formats/propresenter/index.js';
import { parseTxt, writeTxt } from '../formats/txt/index.js';
import {
  parseLibraryJson,
  parseVpc,
  writeVpc,
} from '../formats/videopsalm/index.js';

export type { FormatId };

export type Result<T> =
  | { ok: true; value: T; warnings: Warning[] }
  | { ok: false; error: Error };

export interface FormatDef {
  id: FormatId;
  label: string;
  extensions: string[];
  canImport: boolean;
  canExport: boolean;
  importBytes?: (bytes: Uint8Array, fileName: string) => Promise<Result<Library>>;
  exportBytes?: (
    library: Library
  ) => Promise<Result<{ bytes: Uint8Array; warnings: Warning[] }>>;
}

export const FORMAT_REGISTRY: readonly FormatDef[] = Object.freeze([
  {
    id: 'pro',
    label: 'ProPresenter 7+',
    extensions: ['.pro'],
    canImport: true,
    canExport: true,
    importBytes: async (bytes: Uint8Array, fileName: string): Promise<Result<Library>> => {
      const res = await parsePro(bytes, fileName);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      return {
        ok: true,
        value: { presentations: [res.value] },
        warnings: res.warnings,
      };
    },
    exportBytes: async (
      library: Library
    ): Promise<Result<{ bytes: Uint8Array; warnings: Warning[] }>> => {
      if (
        !library ||
        !Array.isArray(library.presentations) ||
        library.presentations.length !== 1
      ) {
        return {
          ok: false,
          error: new Error(
            'ProPresenter export supports exactly one presentation per file.'
          ),
        };
      }
      const res = writePro(library.presentations[0]!);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      return {
        ok: true,
        value: { bytes: res.bytes, warnings: res.warnings },
        warnings: res.warnings,
      };
    },
  },
  {
    id: 'pro6',
    label: 'ProPresenter 6',
    extensions: ['.pro6'],
    canImport: true,
    canExport: false,
    importBytes: async (bytes: Uint8Array, fileName: string): Promise<Result<Library>> => {
      const res = await parsePro6(bytes, fileName);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      return {
        ok: true,
        value: { presentations: [res.value] },
        warnings: res.warnings,
      };
    },
  },
  {
    id: 'vpc',
    label: 'VideoPsalm VPC',
    extensions: ['.vpc'],
    canImport: true,
    canExport: true,
    importBytes: async (bytes: Uint8Array, fileName: string): Promise<Result<Library>> => {
      return parseVpc(bytes, fileName);
    },
    exportBytes: async (
      library: Library
    ): Promise<Result<{ bytes: Uint8Array; warnings: Warning[] }>> => {
      if (
        !library ||
        !Array.isArray(library.presentations) ||
        library.presentations.length === 0
      ) {
        return {
          ok: false,
          error: new Error('Cannot write a VPC library with no presentations.'),
        };
      }
      const res = await writeVpc(library.presentations);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      return {
        ok: true,
        value: res.value,
        warnings: res.warnings,
      };
    },
  },
  {
    id: 'json',
    label: 'VideoPsalm JSON',
    extensions: ['.json'],
    canImport: true,
    canExport: false,
    importBytes: async (bytes: Uint8Array, fileName: string): Promise<Result<Library>> => {
      try {
        const text = new TextDecoder('utf-8').decode(bytes);
        return parseLibraryJson(text, fileName, 'json');
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err : new Error(String(err)),
        };
      }
    },
  },
  {
    id: 'freeshow',
    label: 'FreeShow',
    extensions: ['.show'],
    canImport: true,
    canExport: true,
    importBytes: async (bytes: Uint8Array, fileName: string): Promise<Result<Library>> => {
      return parseFreeShow(bytes, fileName);
    },
    exportBytes: async (
      library: Library
    ): Promise<Result<{ bytes: Uint8Array; warnings: Warning[] }>> => {
      if (
        !library ||
        !Array.isArray(library.presentations) ||
        library.presentations.length === 0
      ) {
        return {
          ok: false,
          error: new Error('Cannot write a FreeShow file with no presentations.'),
        };
      }
      const res = await writeFreeShow(library);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      return {
        ok: true,
        value: res.value,
        warnings: res.warnings,
      };
    },
  },
  {
    id: 'txt',
    label: 'Plain Text',
    extensions: ['.txt'],
    canImport: true,
    canExport: true,
    importBytes: async (bytes: Uint8Array, fileName: string): Promise<Result<Library>> => {
      return parseTxt(bytes, fileName);
    },
    exportBytes: async (
      library: Library
    ): Promise<Result<{ bytes: Uint8Array; warnings: Warning[] }>> => {
      if (
        !library ||
        !Array.isArray(library.presentations) ||
        library.presentations.length === 0
      ) {
        return {
          ok: false,
          error: new Error('Cannot write a text file with no presentations.'),
        };
      }
      if (library.presentations.length !== 1) {
        return {
          ok: false,
          error: new Error(
            'Text export supports exactly one presentation per file.'
          ),
        };
      }
      const res = writeTxt(library);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      return {
        ok: true,
        value: res.value,
        warnings: res.warnings,
      };
    },
  },
  {
    id: 'pptx',
    label: 'PowerPoint',
    extensions: ['.pptx'],
    canImport: true,
    canExport: true,
    importBytes: async (bytes: Uint8Array, fileName: string): Promise<Result<Library>> => {
      return parsePptx(bytes, fileName);
    },
    exportBytes: async (
      library: Library
    ): Promise<Result<{ bytes: Uint8Array; warnings: Warning[] }>> => {
      if (
        !library ||
        !Array.isArray(library.presentations) ||
        library.presentations.length === 0
      ) {
        return {
          ok: false,
          error: new Error('Cannot write PPTX with no presentations.'),
        };
      }
      const res = await writePptx(library);
      if (!res.ok) {
        return { ok: false, error: res.error };
      }
      return {
        ok: true,
        value: res.value,
        warnings: res.warnings,
      };
    },
  },
]);

export function getFormat(id: FormatId): FormatDef | undefined {
  return FORMAT_REGISTRY.find((f) => f.id === id);
}

export function listFormats(): FormatDef[] {
  return [...FORMAT_REGISTRY];
}

export function listExportFormats(): FormatDef[] {
  return FORMAT_REGISTRY.filter((f) => f.canExport);
}
