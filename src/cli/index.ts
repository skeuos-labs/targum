#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCliArgs } from './args.js';
import { executeBatchCommand } from './commands/batch.js';
import { executeConvertCommand } from './commands/convert.js';
import { executeFormatsCommand } from './commands/formats.js';
import { executeInspectCommand } from './commands/inspect.js';

function writeStream(stream: NodeJS.WriteStream, text: string): void {
  if (!text) return;
  stream.write(text.endsWith('\n') ? text : `${text}\n`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  try {
    const parsed = parseCliArgs(argv);

    if (!parsed.ok) {
      process.stderr.write(`${parsed.error}\n`);
      if (parsed.help) {
        process.stderr.write(`\n${parsed.help}\n`);
      }
      process.exitCode = 3;
      return;
    }

    const { command } = parsed;

    if (command.kind === 'help') {
      writeStream(process.stdout, command.text);
      process.exitCode = 0;
      return;
    }

    if (command.kind === 'formats') {
      const result = executeFormatsCommand({ json: command.json });
      writeStream(process.stdout, result.stdout);
      writeStream(process.stderr, result.stderr);
      process.exitCode = result.exitCode;
      return;
    }

    if (command.kind === 'inspect') {
      const result = await executeInspectCommand({
        input: command.input,
        json: command.json,
      });
      writeStream(process.stdout, result.stdout);
      writeStream(process.stderr, result.stderr);
      process.exitCode = result.exitCode;
      return;
    }

    if (command.kind === 'convert') {
      const result = await executeConvertCommand({
        input: command.input,
        to: command.to,
        out: command.out,
        force: command.force,
        strict: command.strict,
        song: command.song,
        split: command.split,
        json: command.json,
      });
      writeStream(process.stdout, result.stdout);
      writeStream(process.stderr, result.stderr);
      process.exitCode = result.exitCode;
      return;
    }

    if (command.kind === 'batch') {
      const result = await executeBatchCommand({
        inputs: command.inputs,
        to: command.to,
        out: command.out,
        recursive: command.recursive,
        combine: command.combine,
        combineName: command.combineName,
        libraryName: command.libraryName,
        onCollision: command.onCollision,
        strict: command.strict,
        json: command.json,
      });
      writeStream(process.stdout, result.stdout);
      writeStream(process.stderr, result.stderr);
      process.exitCode = result.exitCode;
      return;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Unexpected error: ${message}\n`);
    process.exitCode = 2;
  }
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main().catch((err) => {
    process.stderr.write(`[FATAL] ${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(2);
  });
}
