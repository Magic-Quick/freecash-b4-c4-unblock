import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';

import {
  VERSION,
  EXIT_CODES,
  InvalidInputError,
  CreatorNotFoundError,
  SourceDiscoveryError,
} from './exit-codes.mjs';
import { loadConfig } from './config.mjs';
import { resolveCreator } from './creator-installation.mjs';
import { discoverSources } from './source-discovery.mjs';
import { typecheck } from './compiler.mjs';
import { normalizeDiagnostics, countByCategory } from './diagnostics.mjs';
import { formatHuman, formatJson, formatConfig, printHelp } from './output.mjs';

const VALUE_FLAGS = new Set([
  '--project', '-p',
  '--config', '-c',
  '--creator-path',
  '--cc-declaration',
  '--format', '-f',
]);

const BOOL_FLAGS = new Set([
  '--show-config',
  '--verbose', '-v',
  '--version',
  '--help', '-h',
]);

const FLAG_TO_KEY = {
  '--project': 'project',
  '-p': 'project',
  '--config': 'config',
  '-c': 'config',
  '--creator-path': 'creatorPath',
  '--cc-declaration': 'ccDeclaration',
  '--format': 'format',
  '-f': 'format',
};

function parseArgs(argv) {
  const args = {
    project: null,
    config: null,
    creatorPath: null,
    ccDeclaration: null,
    format: null,
    showConfig: false,
    verbose: false,
    version: false,
    help: false,
  };

  const raw = argv.slice(2);

  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i];

    if (BOOL_FLAGS.has(arg)) {
      const key =
        arg === '--show-config' ? 'showConfig' :
        arg === '--verbose' || arg === '-v' ? 'verbose' :
        arg === '--version' ? 'version' : 'help';
      args[key] = true;
      continue;
    }

    if (VALUE_FLAGS.has(arg)) {
      const value = raw[i + 1];
      if (value === undefined || value.startsWith('--')) {
        throw new InvalidInputError(`Missing value for ${arg}`);
      }
      args[FLAG_TO_KEY[arg]] = value;
      i++;
      continue;
    }

    throw new InvalidInputError(`Unknown argument: ${arg}`);
  }

  if (args.format && !['human', 'json'].includes(args.format)) {
    throw new InvalidInputError(
      `--format must be 'human' or 'json', got '${args.format}'`,
    );
  }

  return args;
}

export async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    if (e instanceof InvalidInputError) {
      console.error(`Error: ${e.message}`);
      console.error(`Run with --help for usage.`);
      return EXIT_CODES.INVALID_INPUT;
    }
    if (e?.stack) console.error(e.stack);
    console.error(`Internal error: ${e.message}`);
    return EXIT_CODES.INTERNAL_ERROR;
  }

  if (args.help) {
    console.log(printHelp());
    return EXIT_CODES.PASSED;
  }

  if (args.version) {
    console.log(VERSION);
    return EXIT_CODES.PASSED;
  }

  const projectRoot = resolve(args.project || '.');

  let config;
  try {
    config = loadConfig(projectRoot, args.config);
  } catch (e) {
    if (e instanceof InvalidInputError) {
      console.error(`Error: ${e.message}`);
      return EXIT_CODES.INVALID_INPUT;
    }
    if (args.verbose) console.error(e.stack);
    console.error(`Internal error: ${e.message}`);
    return EXIT_CODES.INTERNAL_ERROR;
  }

  if (args.showConfig) {
    console.log(formatConfig(config));
    return EXIT_CODES.PASSED;
  }

  let installation;
  try {
    installation = resolveCreator({
      creatorPathArg: args.creatorPath,
      ccDeclarationArg: args.ccDeclaration,
      config,
    });
  } catch (e) {
    if (e instanceof CreatorNotFoundError) {
      console.error(`Error: ${e.message}`);
      return EXIT_CODES.CREATOR_NOT_FOUND;
    }
    if (args.verbose) console.error(e.stack);
    console.error(`Internal error: ${e.message}`);
    return EXIT_CODES.INTERNAL_ERROR;
  }

  let sources;
  try {
    sources = discoverSources(config.projectRoot, config);
  } catch (e) {
    if (e instanceof SourceDiscoveryError) {
      console.error(`Error: ${e.message}`);
      return EXIT_CODES.SOURCE_DISCOVERY_ERROR;
    }
    if (args.verbose) console.error(e.stack);
    console.error(`Internal error: ${e.message}`);
    return EXIT_CODES.INTERNAL_ERROR;
  }

  const startTime = performance.now();

  let compileResult;
  try {
    compileResult = typecheck({
      ts: installation.ts,
      sourceFiles: sources.selected,
      ccDeclarationPath: installation.ccDeclarationPath,
      extraTypeFiles: config.creator.extraTypeFiles,
      compilerOptions: config.compiler.options,
      projectRoot: config.projectRoot,
      installation,
      sources,
    });
  } catch (e) {
    if (e instanceof InvalidInputError) {
      console.error(`Error: ${e.message}`);
      return EXIT_CODES.INVALID_INPUT;
    }
    if (args.verbose) console.error(e.stack);
    console.error(`Internal error during typecheck: ${e.message}`);
    return EXIT_CODES.INTERNAL_ERROR;
  }

  const elapsedMs = performance.now() - startTime;

  const diagnostics = normalizeDiagnostics(
    compileResult.diagnostics,
    installation.ts,
    config.projectRoot,
  );

  const report = {
    diagnostics,
    installation,
    selectedFileCount: compileResult.selectedFileCount,
    excludedCount: compileResult.excludedCount,
    exclusionCounts: compileResult.exclusionCounts,
    elapsedMs,
  };

  const format = args.format || 'human';
  if (format === 'json') {
    console.log(formatJson(report, args.verbose));
  } else {
    console.log(formatHuman(report, args.verbose));
  }

  const counts = countByCategory(diagnostics);
  return counts.error > 0 ? EXIT_CODES.TYPECHECK_ERRORS : EXIT_CODES.PASSED;
}
