import {
  TextReader,
  TextWriter,
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from '@zip.js/zip.js';
import { XMLParser } from 'fast-xml-parser';
import {
  parsePresentation,
  randomUUID,
  warning,
  type Arrangement,
  type Library,
  type Metadata,
  type Presentation,
  type Section,
  type Slide,
  type TextItem,
  type Warning,
} from '../../canonical/index.js';

export type Result<T> =
  | { ok: true; value: T; warnings: Warning[] }
  | { ok: false; error: Error };

export type ParsePptxResult = Result<Library>;

export type WritePptxSuccess = {
  bytes: Uint8Array;
  warnings: Warning[];
};

export type WritePptxResult =
  | {
      ok: true;
      value: WritePptxSuccess;
      bytes: Uint8Array;
      warnings: Warning[];
    }
  | { ok: false; error: Error };

const SLIDE_ENTRY_REGEX = /^ppt\/slides\/slide(\d+)\.xml$/i;

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function extractTextValue(node: unknown): string {
  if (node === null || node === undefined) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number' || typeof node === 'boolean') return String(node);
  if (typeof node === 'object') {
    const textProp = (node as Record<string, unknown>)['#text'];
    if (textProp !== undefined) return extractTextValue(textProp);
  }
  return '';
}

function hasRunFormatting(rPr: unknown): boolean {
  if (!rPr || typeof rPr !== 'object') return false;
  const r = rPr as Record<string, unknown>;

  // Attribute-based styling
  if (
    r['@_b'] === '1' ||
    r['@_b'] === 'true' ||
    r['@_b'] === true ||
    r['@_i'] === '1' ||
    r['@_i'] === 'true' ||
    r['@_i'] === true ||
    (r['@_u'] !== undefined && r['@_u'] !== 'none') ||
    (r['@_strike'] !== undefined && r['@_strike'] !== 'noStrike') ||
    r['@_sz'] !== undefined
  ) {
    return true;
  }

  // Child element styling
  if (
    r['a:solidFill'] !== undefined ||
    r['solidFill'] !== undefined ||
    r['a:gradFill'] !== undefined ||
    r['gradFill'] !== undefined ||
    r['a:highlight'] !== undefined ||
    r['highlight'] !== undefined ||
    r['a:latin'] !== undefined ||
    r['latin'] !== undefined ||
    r['a:ea'] !== undefined ||
    r['ea'] !== undefined ||
    r['a:cs'] !== undefined ||
    r['cs'] !== undefined ||
    r['a:effectLst'] !== undefined ||
    r['effectLst'] !== undefined
  ) {
    return true;
  }

  return false;
}

function collectParagraphs(
  node: unknown,
  out: Record<string, unknown>[]
): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const item of node) {
      collectParagraphs(item, out);
    }
    return;
  }
  const obj = node as Record<string, unknown>;
  for (const [key, val] of Object.entries(obj)) {
    if (key === 'a:p' || key === 'p') {
      if (Array.isArray(val)) {
        for (const p of val) {
          if (p && typeof p === 'object') {
            out.push(p as Record<string, unknown>);
          }
        }
      } else if (val && typeof val === 'object') {
        out.push(val as Record<string, unknown>);
      }
    } else {
      collectParagraphs(val, out);
    }
  }
}

function extractParagraphText(
  p: Record<string, unknown>,
  hadStyleRef: { value: boolean }
): string {
  let pText = '';

  const runs = p['a:r'] ?? p['r'];
  const runList = Array.isArray(runs) ? runs : runs ? [runs] : [];
  for (const r of runList) {
    if (r && typeof r === 'object') {
      const rObj = r as Record<string, unknown>;
      const rPr = rObj['a:rPr'] ?? rObj['rPr'];
      if (hasRunFormatting(rPr)) {
        hadStyleRef.value = true;
      }
      const t = rObj['a:t'] ?? rObj['t'];
      pText += extractTextValue(t);
    }
  }

  const flds = p['a:fld'] ?? p['fld'];
  const fldList = Array.isArray(flds) ? flds : flds ? [flds] : [];
  for (const f of fldList) {
    if (f && typeof f === 'object') {
      const fObj = f as Record<string, unknown>;
      const rPr = fObj['a:rPr'] ?? fObj['rPr'];
      if (hasRunFormatting(rPr)) {
        hadStyleRef.value = true;
      }
      const t = fObj['a:t'] ?? fObj['t'];
      pText += extractTextValue(t);
    }
  }

  const directT = p['a:t'] ?? p['t'];
  if (directT !== undefined) {
    pText += extractTextValue(directT);
  }

  return pText;
}

/**
 * Parse a PowerPoint OpenXML (.pptx) archive into a canonical Library.
 *
 * Text-only reader:
 * - Reads archive with @zip.js/zip.js.
 * - Discovers `ppt/slides/slide(\d+).xml` in numeric order.
 * - Extracts paragraph texts (`<a:p>...<a:t>`) using `fast-xml-parser`.
 * - Detects title from `docProps/core.xml` `<dc:title>`, else falls back to fileName.
 * - Emits PPTX_STYLES_NOT_EXTRACTED if run formatting is present.
 * - Emits PPTX_EMPTY_SLIDE if a slide contains no text.
 * - Validates candidate presentation via `parsePresentation()`.
 * - Fails closed on corrupt bytes or 0 slides.
 */
export async function parsePptx(
  bytes: Uint8Array,
  fileName?: string
): Promise<ParsePptxResult> {
  if (!bytes || !(bytes instanceof Uint8Array) || bytes.byteLength === 0) {
    return {
      ok: false,
      error: new Error(
        `Invalid or empty PowerPoint (.pptx) bytes${fileName ? ` (${fileName})` : ''}.`
      ),
    };
  }

  let zipReader: ZipReader<Uint8Array> | undefined;
  let entries;
  try {
    zipReader = new ZipReader(new Uint8ArrayReader(bytes));
    entries = await zipReader.getEntries();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: new Error(
        `Failed to read PowerPoint (.pptx) archive: ${msg}${fileName ? ` (${fileName})` : ''}`
      ),
    };
  } finally {
    if (zipReader) {
      try {
        await zipReader.close();
      } catch {
        // Ignore secondary close error
      }
    }
  }

  const slideEntries = entries
    .filter((e) => !e.directory && SLIDE_ENTRY_REGEX.test(e.filename))
    .sort((a, b) => {
      const matchA = a.filename.match(SLIDE_ENTRY_REGEX);
      const matchB = b.filename.match(SLIDE_ENTRY_REGEX);
      const numA = matchA ? parseInt(matchA[1]!, 10) : 0;
      const numB = matchB ? parseInt(matchB[1]!, 10) : 0;
      return numA - numB;
    });

  if (slideEntries.length === 0) {
    return {
      ok: false,
      error: new Error(
        `No slides found in PowerPoint (.pptx) archive${fileName ? ` (${fileName})` : ''}.`
      ),
    };
  }

  const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    trimValues: false,
  });

  const metadata: Metadata = {};
  if (fileName) {
    metadata.originalFileName = fileName;
  }

  let title = '';

  const coreEntry = entries.find(
    (e) => !e.directory && e.filename.toLowerCase() === 'docprops/core.xml'
  );
  if (
    coreEntry &&
    !coreEntry.directory &&
    'getData' in coreEntry &&
    typeof coreEntry.getData === 'function'
  ) {
    try {
      const coreXml = (await coreEntry.getData(new TextWriter())) as string;
      const coreParsed = xmlParser.parse(coreXml) as Record<string, unknown>;
      const coreRoot =
        (coreParsed['cp:coreProperties'] as Record<string, unknown>) ??
        (coreParsed['coreProperties'] as Record<string, unknown>) ??
        coreParsed;

      const rawTitle = coreRoot['dc:title'] ?? coreRoot['title'];
      const titleVal = extractTextValue(rawTitle).trim();
      if (titleVal.length > 0) {
        title = titleVal;
      }

      const rawAuthor = coreRoot['dc:creator'] ?? coreRoot['creator'];
      const authorVal = extractTextValue(rawAuthor).trim();
      if (authorVal.length > 0) {
        metadata.author = authorVal;
      }

      const rawDesc = coreRoot['dc:description'] ?? coreRoot['description'];
      const descVal = extractTextValue(rawDesc).trim();
      if (descVal.length > 0) {
        metadata.notes = descVal;
      }
    } catch {
      // Ignore core.xml parsing failure, fallback to fileName
    }
  }

  if (!title && fileName) {
    const stripped = fileName.replace(/\.pptx$/i, '').trim();
    if (stripped.length > 0) {
      title = stripped;
    }
  }

  if (!title) {
    title = 'Untitled Presentation';
  }

  const hadStyleRef = { value: false };
  const emptySlideWarnings: Warning[] = [];
  const slides: Slide[] = [];

  for (let i = 0; i < slideEntries.length; i++) {
    const entry = slideEntries[i]!;
    let slideXml = '';
    if (
      !entry.directory &&
      'getData' in entry &&
      typeof entry.getData === 'function'
    ) {
      try {
        slideXml = (await entry.getData(new TextWriter())) as string;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          ok: false,
          error: new Error(`Failed to read slide entry ${entry.filename}: ${msg}`),
        };
      }
    }

    let parsedSlide: Record<string, unknown> = {};
    try {
      parsedSlide = xmlParser.parse(slideXml) as Record<string, unknown>;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false,
        error: new Error(`Failed to parse XML for slide ${entry.filename}: ${msg}`),
      };
    }

    const pList: Record<string, unknown>[] = [];
    collectParagraphs(parsedSlide, pList);

    const paragraphLines = pList.map((p) =>
      extractParagraphText(p, hadStyleRef)
    );
    const slideText = paragraphLines.join('\n');

    const slideId = randomUUID();
    const items: TextItem[] =
      slideText.trim().length > 0
        ? [{ type: 'text', plainText: slideText }]
        : [];

    if (slideText.trim().length === 0) {
      emptySlideWarnings.push(
        warning(
          'PPTX_EMPTY_SLIDE',
          'warn',
          `Slide ${i + 1} contains no text.`,
          {
            slideIndex: i,
            slideNumber: i + 1,
            entryName: entry.filename,
          }
        )
      );
    }

    slides.push({
      id: slideId,
      label: `Slide ${i + 1}`,
      items,
    });
  }

  const warnings: Warning[] = [];

  if (hadStyleRef.value) {
    warnings.push(
      warning(
        'PPTX_STYLES_NOT_EXTRACTED',
        'info',
        'PowerPoint presentation contains text formatting (such as bold, italic, custom colors, or sizes) that was not extracted into canonical plain text.'
      )
    );
  }

  warnings.push(...emptySlideWarnings);

  const presentationId = randomUUID();
  const defaultSectionId = randomUUID();
  const slideIds = slides.map((s) => s.id);

  const sections: Section[] = [
    {
      id: defaultSectionId,
      name: 'Default',
      slideIds,
    },
  ];

  const arrangements: Arrangement[] = [
    {
      id: randomUUID(),
      name: 'Default',
      slideIds,
    },
  ];

  const candidate: Presentation = {
    id: presentationId,
    title,
    sourceFormat: 'pptx',
    metadata,
    sections,
    arrangements,
    slides,
    warnings,
  };

  const validated = parsePresentation(candidate);
  if (!validated.ok) {
    return {
      ok: false,
      error: new Error(
        `Candidate PowerPoint presentation failed validation: ${validated.error.message}`
      ),
    };
  }

  return {
    ok: true,
    value: { presentations: [validated.value] },
    warnings: validated.value.warnings,
  };
}

/**
 * Package a canonical Library into a text-only OpenXML PowerPoint (.pptx) archive.
 *
 * Single-presentation writer:
 * - Fails closed if library has 0 or >1 presentations.
 * - Writes 16:9 widescreen layout with centered text frame per slide.
 * - Standard OpenXML packaging structure using @zip.js/zip.js.
 */
export async function writePptx(
  library: Library
): Promise<WritePptxResult> {
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

  if (library.presentations.length > 1) {
    return {
      ok: false,
      error: new Error(
        `Cannot write PPTX with multiple presentations (expected exactly 1, got ${library.presentations.length}).`
      ),
    };
  }

  const p = library.presentations[0]!;
  const warnings: Warning[] = [];

  const zipWriter = new ZipWriter(new Uint8ArrayWriter());
  try {
    const slideCount = p.slides.length;

    // 1. [Content_Types].xml
    const slideOverrides = Array.from(
      { length: slideCount },
      (_, i) =>
        `  <Override PartName="/ppt/slides/slide${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    ).join('\n');

    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
${slideOverrides}
</Types>`;

    await zipWriter.add('[Content_Types].xml', new TextReader(contentTypesXml));

    // 2. _rels/.rels
    const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

    await zipWriter.add('_rels/.rels', new TextReader(rootRelsXml));

    // 3. docProps/core.xml
    const creatorTag = p.metadata.author
      ? `  <dc:creator>${escapeXml(p.metadata.author)}</dc:creator>\n`
      : '';
    const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(p.title)}</dc:title>
${creatorTag}  <cp:revision>1</cp:revision>
</cp:coreProperties>`;

    await zipWriter.add('docProps/core.xml', new TextReader(coreXml));

    // 4. ppt/presentation.xml
    const slideIdsXml = Array.from(
      { length: slideCount },
      (_, i) => `    <p:sldId id="${256 + i}" r:id="rId${i + 1}"/>`
    ).join('\n');

    const presentationXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>
${slideIdsXml}
  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="5143500" type="screen16x9"/>
  <p:notesSz cx="5143500" cy="9144000"/>
  <p:defaultTextStyle>
    <a:lvl1pPr algn="ctr">
      <a:defRPr sz="4000">
        <a:solidFill>
          <a:srgbClr val="FFFFFF"/>
        </a:solidFill>
      </a:defRPr>
    </a:lvl1pPr>
  </p:defaultTextStyle>
</p:presentation>`;

    await zipWriter.add('ppt/presentation.xml', new TextReader(presentationXml));

    // 5. ppt/_rels/presentation.xml.rels
    const presRelsXml = Array.from(
      { length: slideCount },
      (_, i) =>
        `  <Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i + 1}.xml"/>`
    ).join('\n');

    const presentationRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${presRelsXml}
</Relationships>`;

    await zipWriter.add(
      'ppt/_rels/presentation.xml.rels',
      new TextReader(presentationRelsXml)
    );

    // 6. ppt/slides/slide{i}.xml
    for (let i = 0; i < slideCount; i++) {
      const slide = p.slides[i]!;
      const text = slide.items.map((it) => it.plainText).join('\n');
      const lines = text.split(/\r?\n/);

      let paragraphsXml: string;
      if (text.trim().length === 0) {
        paragraphsXml = `          <a:p>
            <a:pPr algn="ctr"/>
            <a:endParaRPr/>
          </a:p>`;
      } else {
        paragraphsXml = lines
          .map(
            (line) => `          <a:p>
            <a:pPr algn="ctr"/>
            <a:r>
              <a:rPr lang="en-US"/>
              <a:t>${escapeXml(line)}</a:t>
            </a:r>
          </a:p>`
          )
          .join('\n');
      }

      const slideXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld name="Slide ${i + 1}">
    <p:bg>
      <p:bgPr>
        <a:solidFill>
          <a:srgbClr val="000000"/>
        </a:solidFill>
      </p:bgPr>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
          <a:chOff x="0" y="0"/>
          <a:chExt cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="TextBox 1"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="457200"/>
            <a:ext cx="8229600" cy="4229100"/>
          </a:xfrm>
          <a:prstGeom prst="rect">
            <a:avLst/>
          </a:prstGeom>
          <a:noFill/>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square" anchor="ctr" rtlCol="0"/>
          <a:lstStyle/>
${paragraphsXml}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:sld>`;

      await zipWriter.add(
        `ppt/slides/slide${i + 1}.xml`,
        new TextReader(slideXml)
      );
    }

    const bytes = await zipWriter.close();
    return {
      ok: true,
      value: { bytes, warnings },
      bytes,
      warnings,
    };
  } catch (err) {
    try {
      await zipWriter.close();
    } catch {
      // Ignore secondary close error
    }
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      error: new Error(`Failed to write PowerPoint (.pptx) package: ${message}`),
    };
  }
}
