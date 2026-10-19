// Canonical data model, schemas, types, normalizers, and warnings
export * from './canonical/index.js';

// Format registry and capabilities
export {
  FORMAT_REGISTRY,
  getFormat,
  listFormats,
  listExportFormats,
  type FormatDef,
  type FormatId,
  type Result,
} from './pipeline/registry.js';

// Format detector
export { detectFormat } from './pipeline/detector.js';

// Conversion pipeline
export {
  importFile,
  exportLibrary,
  exportPresentation,
  convertFile,
} from './pipeline/convert.js';

// Format codecs
export {
  parsePro,
  writePro,
  parsePro6,
  encodeRtf,
  decodeRtf,
  getProtoRoot,
  type ParseProResult,
  type ParsePro6Result,
  type WriteProResult,
} from './formats/propresenter/index.js';

export {
  parseVpc,
  writeVpc,
  parseLibraryJson,
  serializeDialect,
  TAG_NAMES,
  VPC_KEY,
  type ParseLibraryJsonResult,
} from './formats/videopsalm/index.js';

export {
  parseFreeShow,
  writeFreeShow,
  type WriteFreeShowResult,
  type WriteFreeShowSuccess,
} from './formats/freeshow/index.js';

export {
  parseTxt,
  writeTxt,
  type ParseTxtResult,
  type WriteTxtResult,
  type WriteTxtSuccess,
} from './formats/txt/index.js';

export {
  parsePptx,
  writePptx,
  type ParsePptxResult,
  type WritePptxResult,
  type WritePptxSuccess,
} from './formats/pptx/index.js';

// Fixtures
export {
  AMAZING_GRACE,
  createAmazingGracePresentation,
} from './fixtures/amazing-grace.js';

// Batch & Playlist (browser/webview safe)
export {
  generateProPlaylist,
  type PlaylistPresentationEntry,
} from './batch/playlist.js';

export {
  type CollisionPolicy,
  type BatchConvertOptions,
  type BatchItemResult,
  type BatchSummary,
  type BatchProgressCallback,
} from './batch/types.js';

// Pure Utilities (no node:fs / node:path dependencies)
export { sanitizeFileName } from './cli/sanitize.js';

