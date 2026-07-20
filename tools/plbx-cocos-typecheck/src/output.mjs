import { VERSION, EXIT_CODES, EXIT_CODE_DESCRIPTIONS } from './exit-codes.mjs';
import { countByCategory } from './diagnostics.mjs';

export function formatHuman(report, verbose) {
  const lines = [];
  const { diagnostics, installation, selectedFileCount, excludedCount, exclusionCounts, elapsedMs } = report;

  if (diagnostics.length > 0) {
    for (const d of diagnostics) {
      if (d.file && d.line > 0) {
        lines.push(
          `${d.file}:${d.line}:${d.column} - ${d.category} TS${d.code}: ${d.message}`,
        );
      } else if (d.file) {
        lines.push(`${d.file} - ${d.category} TS${d.code}: ${d.message}`);
      } else {
        lines.push(`${d.category} TS${d.code}: ${d.message}`);
      }
    }
    lines.push('');
  }

  const counts = countByCategory(diagnostics);
  const status =
    counts.error > 0
      ? 'FAILED'
      : counts.warning > 0
        ? 'PASSED (with warnings)'
        : 'PASSED';

  lines.push('─────────────────────────────────────────────');
  lines.push(`Status:     ${status}`);
  lines.push(`Creator:    ${installation.creatorVersion || 'unknown'}`);
  lines.push(`TypeScript: ${installation.typescriptVersion || 'unknown'}`);
  if (verbose) {
    lines.push(`cc.d.ts:    ${installation.ccDeclarationPath}`);
    lines.push(`Creator:    ${installation.creatorPath}`);
  }
  lines.push(
    `Sources:    ${selectedFileCount} selected, ${excludedCount} excluded`,
  );
  if (excludedCount > 0) {
    const reasonParts = Object.entries(exclusionCounts)
      .map(([reason, count]) => `${reason}=${count}`)
      .join(', ');
    lines.push(`Exclusions:  ${reasonParts}`);
  }
  lines.push(
    `Diagnostics: ${counts.error} errors, ${counts.warning} warnings`,
  );
  lines.push(`Elapsed:    ${formatElapsed(elapsedMs)}`);
  lines.push('─────────────────────────────────────────────');

  return lines.join('\n');
}

export function formatJson(report, verbose) {
  const counts = countByCategory(report.diagnostics);
  const status = counts.error > 0 ? 'failed' : 'passed';

  const output = {
    schemaVersion: 1,
    status,
    exitCode: counts.error > 0 ? EXIT_CODES.TYPECHECK_ERRORS : EXIT_CODES.PASSED,
    creator: {
      version: report.installation.creatorVersion || null,
    },
    typescript: {
      version: report.installation.typescriptVersion || null,
    },
    sources: {
      selected: report.selectedFileCount,
      excluded: report.excludedCount,
      ...(Object.keys(report.exclusionCounts).length > 0
        ? { exclusionBreakdown: report.exclusionCounts }
        : {}),
    },
    diagnostics: report.diagnostics.map((d) => ({
      file: d.file,
      line: d.line,
      column: d.column,
      category: d.category,
      code: d.code,
      message: d.message,
    })),
    summary: {
      errors: counts.error,
      warnings: counts.warning,
      elapsedMs: Math.round(report.elapsedMs),
    },
  };

  if (verbose) {
    output.environment = {
      creatorPath: report.installation.creatorPath,
      ccDeclarationPath: report.installation.ccDeclarationPath,
      typescriptLibPath: report.installation.typescriptLibPath,
      platform: report.installation.platform,
    };
  }

  return JSON.stringify(output, null, 2);
}

export function formatConfig(config) {
  const display = {
    schemaVersion: config.schemaVersion,
    projectRoot: config.projectRoot,
    creator: {
      path: config.creator.path,
      expectedVersion: config.creator.expectedVersion,
      typescript: config.creator.typescript,
      ccDeclarationPath: config.creator.ccDeclarationPath,
      extraTypeFiles: config.creator.extraTypeFiles,
    },
    project: {
      root: config.project.root,
      sourceRoots: config.project.sourceRoots,
      include: config.project.include,
      exclude: config.project.exclude,
      followSymlinks: config.project.followSymlinks,
    },
    compiler: {
      readRootCompilerOptions: config.compiler.readRootCompilerOptions,
      options: config.compiler.options,
    },
    configFilePath: config.configFilePath || '(defaults only)',
  };
  return JSON.stringify(display, null, 2);
}

export function printHelp() {
  const lines = [
    `plbx-cocos-typecheck v${VERSION}`,
    '',
    'Read-only TypeScript typecheck for Cocos Creator playable projects.',
    'Uses real engine declarations and bundled TypeScript from the',
    'installed Cocos Creator — checks only selected production sources.',
    '',
    'Usage:',
    '  plbx-cocos-typecheck [options]',
    '',
    'Options:',
    '  --project <path>          Project root (default: current directory)',
    '  --config <path>            JSON config file (default: .playbox/cocos-typecheck.json)',
    '  --creator-path <path>      Explicit path to Cocos Creator app/installation',
    '  --cc-declaration <path>    Explicit path to cc.d.ts',
    '  --format human|json        Output format (default: human)',
    '  --show-config              Print normalized config without running compiler',
    '  --verbose                  Show absolute paths in JSON and full error stack',
    '  --version                  Print helper version',
    '  --help                     Show this help',
    '',
    'Creator resolution priority:',
    '  1. --creator-path',
    '  2. creator.path in config',
    '  3. COCOS_CREATOR_PATH environment variable',
    '  4. Platform-specific standard locations',
    '',
    'Exit codes:',
    ...Object.entries(EXIT_CODE_DESCRIPTIONS).map(
      ([code, desc]) => `  ${code}  ${desc}`,
    ),
    '',
    'Configuration: .playbox/cocos-typecheck.json (optional)',
    'Without config, defaults to assets/**/*.ts inside project root.',
  ];
  return lines.join('\n');
}

function formatElapsed(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}
