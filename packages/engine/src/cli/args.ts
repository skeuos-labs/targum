import util from 'node:util';
import type { CollisionPolicy } from '../batch/index.js';

const parseArgs = util.parseArgs;

export type CliCommand =
  | { kind: 'help'; text: string }
  | { kind: 'formats'; json: boolean }
  | { kind: 'inspect'; input: string; json: boolean }
  | {
      kind: 'convert';
      input: string;
      to: string;
      out?: string;
      force: boolean;
      strict: boolean;
      song?: string;
      split?: string;
      json: boolean;
      recursive?: boolean;
    }
  | {
      kind: 'batch';
      inputs: string[];
      to: string;
      out: string;
      recursive: boolean;
      combine?: boolean | string;
      combineName?: string;
      libraryName?: string;
      onCollision: CollisionPolicy;
      strict: boolean;
      json: boolean;
    };

export type CliParsedResult =
  | { ok: true; command: CliCommand }
  | { ok: false; error: string; help?: string };

export type CliParsedCommand = CliParsedResult;

export const HELP_TEXT = `Show Converter — CLI worship presentation conversion utility

Usage:
  show-converter [command] [options]
  show-converter <input> -t <format> [options]
  show-converter batch <inputs...> -t <format> -o <outDir> [options]

Commands:
  convert <input> -t <format>    Convert input presentation to target format (default command)
  batch <inputs...> -t <format>  Batch convert multiple files or folders
  inspect <input>                Inspect presentation structure and metadata
  formats                        List all supported formats and capabilities
  help, --help, -h               Show this help message

Options (convert):
  -t, --to <format>              Target format (pro, vpc, show, txt, pptx) [required]
  -o, --out <path>               Output file or directory path
  -f, --force                    Overwrite existing destination file
  --strict                       Treat warnings as errors (exit code 1)
  --song <index|title>           Select single song from multi-song input
  --split <dir>                  Split multi-song input into individual files
  --json                         Output result summary as JSON

Options (batch):
  -t, --to <format>              Target format (pro, vpc, show, txt, pptx) [required]
  -o, --out <path>               Output directory path [required]
  -r, --recursive                Recursively scan input directories
  --combine [name]               Combine presentations into single file (pptx, vpc, show)
  --library <name>               Generate ProPresenter library folder with playlist (pro only)
  --on-collision <policy>        File collision policy (rename, skip, overwrite, error) [default: rename]
  -f, --force                    Alias for --on-collision overwrite
  --strict                       Treat warnings as errors (exit code 1)
  --json                         Output batch summary as JSON

Options (inspect):
  --json                         Output canonical library structure as JSON

Options (formats):
  --json                         Output supported formats as JSON array`;

const PARSE_OPTIONS = {
  to: { type: 'string', short: 't' },
  out: { type: 'string', short: 'o' },
  force: { type: 'boolean', short: 'f' },
  strict: { type: 'boolean' },
  song: { type: 'string' },
  split: { type: 'string' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
  recursive: { type: 'boolean', short: 'r' },
  library: { type: 'string' },
  'library-name': { type: 'string' },
  'on-collision': { type: 'string' },
} as const;

export function parseCliArgs(argv: string[]): CliParsedResult {
  // Pre-process argv to extract --combine or --combine=<name>
  let combineVal: boolean | string | undefined;
  const filteredArgv: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === '--combine') {
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        combineVal = next;
        i++;
      } else {
        combineVal = true;
      }
    } else if (arg.startsWith('--combine=')) {
      combineVal = arg.slice('--combine='.length);
    } else {
      filteredArgv.push(arg);
    }
  }

  let parsed: {
    values: {
      to?: string;
      out?: string;
      force?: boolean;
      strict?: boolean;
      song?: string;
      split?: string;
      json?: boolean;
      help?: boolean;
      recursive?: boolean;
      library?: string;
      'library-name'?: string;
      'on-collision'?: string;
    };
    positionals: string[];
  };

  try {
    parsed = parseArgs({
      args: filteredArgv,
      options: PARSE_OPTIONS,
      allowPositionals: true,
      strict: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, help: HELP_TEXT };
  }

  if (parsed.values.help) {
    return { ok: true, command: { kind: 'help', text: HELP_TEXT } };
  }

  if (parsed.positionals.length === 0) {
    if (parsed.values.to) {
      return { ok: false, error: 'Missing required input file for convert command', help: HELP_TEXT };
    }
    return { ok: true, command: { kind: 'help', text: HELP_TEXT } };
  }

  const [first, second] = parsed.positionals;

  if (first === 'help') {
    return { ok: true, command: { kind: 'help', text: HELP_TEXT } };
  }

  if (first === 'formats') {
    if (combineVal !== undefined) {
      return { ok: false, error: "Unknown option '--combine'", help: HELP_TEXT };
    }
    if (parsed.positionals.length > 1) {
      return { ok: false, error: `Unexpected argument: "${parsed.positionals[1]}"`, help: HELP_TEXT };
    }
    return { ok: true, command: { kind: 'formats', json: Boolean(parsed.values.json) } };
  }

  if (first === 'inspect') {
    if (combineVal !== undefined) {
      return { ok: false, error: "Unknown option '--combine'", help: HELP_TEXT };
    }
    if (!second) {
      return { ok: false, error: 'Missing required input file for inspect command', help: HELP_TEXT };
    }
    if (parsed.positionals.length > 2) {
      return { ok: false, error: `Unexpected argument: "${parsed.positionals[2]}"`, help: HELP_TEXT };
    }
    return { ok: true, command: { kind: 'inspect', input: second, json: Boolean(parsed.values.json) } };
  }

  if (first === 'batch') {
    const inputs = parsed.positionals.slice(1);
    if (inputs.length === 0) {
      return {
        ok: false,
        error: 'Missing required input file(s) or directory for batch command',
        help: HELP_TEXT,
      };
    }
    if (!parsed.values.to) {
      return {
        ok: false,
        error: 'Missing required --to / -t option for batch command',
        help: HELP_TEXT,
      };
    }
    if (!parsed.values.out) {
      return {
        ok: false,
        error: 'Missing required --out / -o option for batch command',
        help: HELP_TEXT,
      };
    }

    const rawTo = parsed.values.to;
    const toFormat = rawTo.toLowerCase() === 'show' ? 'freeshow' : rawTo;
    const libraryName = parsed.values.library || parsed.values['library-name'];

    if (combineVal !== undefined && libraryName) {
      return {
        ok: false,
        error: '--combine and --library are mutually exclusive.',
        help: HELP_TEXT,
      };
    }

    if (
      combineVal !== undefined &&
      toFormat !== 'pptx' &&
      toFormat !== 'vpc' &&
      toFormat !== 'freeshow'
    ) {
      return {
        ok: false,
        error: `--combine is only supported for pptx, vpc, and show formats (incompatible with "${rawTo}").`,
        help: HELP_TEXT,
      };
    }

    if (libraryName && toFormat !== 'pro') {
      return {
        ok: false,
        error: '--library is only supported when target format is "pro".',
        help: HELP_TEXT,
      };
    }

    let onCollision: CollisionPolicy = 'rename';
    if (parsed.values['on-collision']) {
      const policy = parsed.values['on-collision'].toLowerCase();
      if (
        policy !== 'rename' &&
        policy !== 'skip' &&
        policy !== 'overwrite' &&
        policy !== 'error'
      ) {
        return {
          ok: false,
          error: `Invalid --on-collision policy: "${parsed.values['on-collision']}". Must be one of: rename, skip, overwrite, error.`,
          help: HELP_TEXT,
        };
      }
      onCollision = policy as CollisionPolicy;
    } else if (parsed.values.force) {
      onCollision = 'overwrite';
    }

    return {
      ok: true,
      command: {
        kind: 'batch',
        inputs,
        to: toFormat,
        out: parsed.values.out,
        recursive: Boolean(parsed.values.recursive),
        ...(combineVal !== undefined ? { combine: combineVal } : {}),
        ...(typeof combineVal === 'string' ? { combineName: combineVal } : {}),
        ...(libraryName ? { libraryName } : {}),
        onCollision,
        strict: Boolean(parsed.values.strict),
        json: Boolean(parsed.values.json),
      },
    };
  }

  if (first === 'convert') {
    if (combineVal !== undefined) {
      return { ok: false, error: "Unknown option '--combine'", help: HELP_TEXT };
    }
    if (parsed.values.library || parsed.values['library-name']) {
      return { ok: false, error: "Option '--library' is only valid for batch command", help: HELP_TEXT };
    }
    if (parsed.values['on-collision']) {
      return { ok: false, error: "Option '--on-collision' is only valid for batch command", help: HELP_TEXT };
    }
    if (!second) {
      return { ok: false, error: 'Missing required input file for convert command', help: HELP_TEXT };
    }
    if (parsed.positionals.length > 2) {
      return { ok: false, error: `Unexpected argument: "${parsed.positionals[2]}"`, help: HELP_TEXT };
    }
    if (!parsed.values.to) {
      return { ok: false, error: 'Missing required --to / -t option for convert command', help: HELP_TEXT };
    }
    const toFormat = parsed.values.to.toLowerCase() === 'show' ? 'freeshow' : parsed.values.to;
    return {
      ok: true,
      command: {
        kind: 'convert',
        input: second,
        to: toFormat,
        ...(parsed.values.out !== undefined ? { out: parsed.values.out } : {}),
        force: Boolean(parsed.values.force),
        strict: Boolean(parsed.values.strict),
        ...(parsed.values.song !== undefined ? { song: parsed.values.song } : {}),
        ...(parsed.values.split !== undefined ? { split: parsed.values.split } : {}),
        json: Boolean(parsed.values.json),
        ...(parsed.values.recursive !== undefined ? { recursive: Boolean(parsed.values.recursive) } : {}),
      },
    };
  }

  // Root shorthand conversion or unknown command
  const hasConvertFlags =
    parsed.values.to !== undefined ||
    parsed.values.out !== undefined ||
    parsed.values.force ||
    parsed.values.strict ||
    parsed.values.song !== undefined ||
    parsed.values.split !== undefined ||
    parsed.values.recursive !== undefined;

  if (hasConvertFlags) {
    if (combineVal !== undefined) {
      return { ok: false, error: "Unknown option '--combine'", help: HELP_TEXT };
    }
    if (parsed.values.library || parsed.values['library-name']) {
      return { ok: false, error: "Option '--library' is only valid for batch command", help: HELP_TEXT };
    }
    if (parsed.values['on-collision']) {
      return { ok: false, error: "Option '--on-collision' is only valid for batch command", help: HELP_TEXT };
    }
    if (parsed.positionals.length > 1) {
      return { ok: false, error: `Unexpected argument: "${parsed.positionals[1]}"`, help: HELP_TEXT };
    }
    if (!parsed.values.to) {
      return { ok: false, error: 'Missing required --to / -t option for convert command', help: HELP_TEXT };
    }
    const toFormat = parsed.values.to.toLowerCase() === 'show' ? 'freeshow' : parsed.values.to;
    return {
      ok: true,
      command: {
        kind: 'convert',
        input: first,
        to: toFormat,
        ...(parsed.values.out !== undefined ? { out: parsed.values.out } : {}),
        force: Boolean(parsed.values.force),
        strict: Boolean(parsed.values.strict),
        ...(parsed.values.song !== undefined ? { song: parsed.values.song } : {}),
        ...(parsed.values.split !== undefined ? { split: parsed.values.split } : {}),
        json: Boolean(parsed.values.json),
        ...(parsed.values.recursive !== undefined ? { recursive: Boolean(parsed.values.recursive) } : {}),
      },
    };
  }

  return { ok: false, error: `Unknown command: ${first}`, help: HELP_TEXT };
}
