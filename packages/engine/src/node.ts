export * from './index.js';

// CLI (Node runtime)
export {
  parseCliArgs,
  HELP_TEXT,
  type CliCommand,
  type CliParsedCommand,
  type CliParsedResult,
} from './cli/args.js';
export {
  disambiguateFileName,
  formatCliWarning,
} from './cli/utils.js';
export {
  executeFormatsCommand,
  type FormatsCommandOptions,
} from './cli/commands/formats.js';
export {
  executeInspectCommand,
  type InspectCommandOptions,
} from './cli/commands/inspect.js';
export {
  executeConvertCommand,
  type ConvertCommandOptions,
} from './cli/commands/convert.js';
export {
  executeBatchCommand,
  type BatchCommandOptions,
} from './cli/commands/batch.js';

// Batch processing (Node filesystem runtime)
export {
  batchConvert,
  scanBatchInputs,
  resolveOutputPath,
} from './batch/index.js';
