import { parseArgs } from 'node:util';

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
    };

export type CliParsedResult =
  | { ok: true; command: CliCommand }
  | { ok: false; error: string; help?: string };

export type CliParsedCommand = CliParsedResult;

export const HELP_TEXT = `Show Converter — CLI worship presentation conversion utility

Usage:
  show-converter [command] [options]
  show-converter <input> -t <format> [options]

Commands:
  convert <input> -t <format>    Convert input presentation to target format (default command)
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
} as const;

export function parseCliArgs(argv: string[]): CliParsedResult {
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
    };
    positionals: string[];
  };

  try {
    parsed = parseArgs({
      args: argv,
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
    return { ok: true, command: { kind: 'formats', json: Boolean(parsed.values.json) } };
  }

  if (first === 'inspect') {
    if (!second) {
      return { ok: false, error: 'Missing required input file for inspect command', help: HELP_TEXT };
    }
    return { ok: true, command: { kind: 'inspect', input: second, json: Boolean(parsed.values.json) } };
  }

  if (first === 'convert') {
    if (!second) {
      return { ok: false, error: 'Missing required input file for convert command', help: HELP_TEXT };
    }
    if (!parsed.values.to) {
      return { ok: false, error: 'Missing required --to / -t option for convert command', help: HELP_TEXT };
    }
    return {
      ok: true,
      command: {
        kind: 'convert',
        input: second,
        to: parsed.values.to,
        ...(parsed.values.out !== undefined ? { out: parsed.values.out } : {}),
        force: Boolean(parsed.values.force),
        strict: Boolean(parsed.values.strict),
        ...(parsed.values.song !== undefined ? { song: parsed.values.song } : {}),
        ...(parsed.values.split !== undefined ? { split: parsed.values.split } : {}),
        json: Boolean(parsed.values.json),
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
    parsed.values.split !== undefined;

  if (hasConvertFlags) {
    if (!parsed.values.to) {
      return { ok: false, error: 'Missing required --to / -t option for convert command', help: HELP_TEXT };
    }
    return {
      ok: true,
      command: {
        kind: 'convert',
        input: first,
        to: parsed.values.to,
        ...(parsed.values.out !== undefined ? { out: parsed.values.out } : {}),
        force: Boolean(parsed.values.force),
        strict: Boolean(parsed.values.strict),
        ...(parsed.values.song !== undefined ? { song: parsed.values.song } : {}),
        ...(parsed.values.split !== undefined ? { split: parsed.values.split } : {}),
        json: Boolean(parsed.values.json),
      },
    };
  }

  return { ok: false, error: `Unknown command: ${first}`, help: HELP_TEXT };
}
