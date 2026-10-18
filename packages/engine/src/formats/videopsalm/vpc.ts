import { TextWriter, Uint8ArrayReader, ZipReader } from '@zip.js/zip.js';
import type { Library } from '../../canonical/index.js';
import { parseLibraryJson, type Result } from './json.js';
import { VPC_KEY } from './key.js';

function isMacMetadata(name: string): boolean {
  return name.startsWith('__MACOSX/') || (name.split('/').pop()?.startsWith('._') ?? false);
}

/**
 * Parses an AES-128 encrypted VideoPsalm VPC archive into a canonical Library.
 * Fails closed on invalid ZIP bytes, missing password, or missing JSON entry.
 */
export async function parseVpc(
  bytes: Uint8Array,
  fileName?: string
): Promise<Result<Library>> {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    return {
      ok: false,
      error: new Error(
        `Invalid or empty VPC archive bytes${fileName ? ` (${fileName})` : ''}`
      ),
    };
  }

  let zipReader: ZipReader<Uint8Array> | undefined;
  try {
    zipReader = new ZipReader(new Uint8ArrayReader(bytes), { password: VPC_KEY });
    const entries = await zipReader.getEntries();
    const jsonEntry = entries.find(
      (e) =>
        !e.directory &&
        !isMacMetadata(e.filename) &&
        e.filename.toLowerCase().endsWith('.json')
    );

    if (!jsonEntry || jsonEntry.directory) {
      return {
        ok: false,
        error: new Error(
          `No JSON entry found in VideoPsalm VPC archive${fileName ? ` (${fileName})` : ''}`
        ),
      };
    }

    const rawJson = await jsonEntry.getData(new TextWriter());
    return parseLibraryJson(rawJson, fileName ?? jsonEntry.filename, 'vpc');
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  } finally {
    if (zipReader) {
      try {
        await zipReader.close();
      } catch {
        // Ignore reader close errors on corrupted archives
      }
    }
  }
}
