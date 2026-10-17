import type { FormatId } from './registry.js';

function containsAscii(bytes: Uint8Array, needle: string): boolean {
  const target = new TextEncoder().encode(needle);
  if (bytes.byteLength < target.byteLength) return false;

  // Search first 64KB
  const headLimit = Math.min(bytes.byteLength, 65536);
  for (let i = 0; i <= headLimit - target.byteLength; i++) {
    let match = true;
    for (let j = 0; j < target.byteLength; j++) {
      if (bytes[i + j] !== target[j]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }

  // Search tail 64KB (central directory)
  if (bytes.byteLength > 65536) {
    const start = Math.max(0, bytes.byteLength - 65536);
    for (let i = start; i <= bytes.byteLength - target.byteLength; i++) {
      let match = true;
      for (let j = 0; j < target.byteLength; j++) {
        if (bytes[i + j] !== target[j]) {
          match = false;
          break;
        }
      }
      if (match) return true;
    }
  }

  return false;
}

/**
 * Detects format of an input presentation file by filename extension
 * or magic byte sniffing.
 */
export function detectFormat(
  fileName: string,
  bytes: Uint8Array
): FormatId | undefined {
  // 1. Checks file extension first (case-insensitive)
  if (fileName) {
    const extMatch = /\.([a-z0-9]+)$/i.exec(fileName.trim());
    if (extMatch) {
      const ext = extMatch[1]!.toLowerCase();
      switch (ext) {
        case 'pro':
          return 'pro';
        case 'pro6':
          return 'pro6';
        case 'vpc':
          return 'vpc';
        case 'json':
          return 'json';
        case 'show':
          return 'freeshow';
        case 'txt':
          return 'txt';
        case 'pptx':
          return 'pptx';
      }
    }
  }

  // 2. Sniffs magic bytes
  if (!bytes || !(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    return undefined;
  }

  // 0x0a: .pro (Protobuf tag 1)
  if (bytes[0] === 0x0a) {
    return 'pro';
  }

  // 0x50, 0x4b ('PK'): ZIP file
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    if (
      containsAscii(bytes, '[Content_Types].xml') ||
      containsAscii(bytes, 'ppt/')
    ) {
      return 'pptx';
    }
    if (containsAscii(bytes, 'show.json')) {
      return 'freeshow';
    }
    // Fallback for ZIP archive (VideoPsalm VPC archive)
    return 'vpc';
  }

  // First non-whitespace '{' or '[': .json or .show
  let firstNonWs: number | undefined;
  let firstIdx = -1;
  const scanLimit = Math.min(bytes.byteLength, 1024);
  for (let i = 0; i < scanLimit; i++) {
    const b = bytes[i]!;
    if (b !== 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) {
      firstNonWs = b;
      firstIdx = i;
      break;
    }
  }

  if (firstNonWs === 0x7b /* { */ || firstNonWs === 0x5b /* [ */) {
    const sample = new TextDecoder('utf-8', { fatal: false }).decode(
      bytes.subarray(firstIdx, Math.min(bytes.byteLength, firstIdx + 2048))
    );
    if (sample.includes('"presentations"') || sample.includes('"groups"')) {
      return 'freeshow';
    }
    return 'json';
  }

  // ProPresenter 6 XML sniffing
  if (containsAscii(bytes, 'RVPresentationDocument')) {
    return 'pro6';
  }

  return undefined;
}
