import { relative, sep } from 'node:path';
import { realpathSync } from 'node:fs';

import { InvalidInputError } from './exit-codes.mjs';

export function typecheck({
  ts,
  sourceFiles,
  ccDeclarationPath,
  extraTypeFiles,
  compilerOptions,
  projectRoot,
  installation,
  sources,
}) {
  const rootNames = [
    ...sourceFiles,
    ccDeclarationPath,
    ...extraTypeFiles,
  ].filter(Boolean);

  const { options: convertedOptions, errors: convertErrors } =
    ts.convertCompilerOptionsFromJson(compilerOptions, projectRoot);

  if (convertErrors && convertErrors.length > 0) {
    const messages = convertErrors.map(
      (e) => ts.flattenDiagnosticMessageText(e.messageText, '\n'),
    );
    throw new InvalidInputError(
      `Compiler option conversion errors:\n${messages.map((m) => `  - ${m}`).join('\n')}`,
    );
  }

  const finalOptions = {
    ...convertedOptions,
    noEmit: true,
  };

  const program = ts.createProgram({
    rootNames,
    options: finalOptions,
  });

  const selectedSet = new Set(
    sourceFiles.map((f) => normalizePath(f, projectRoot)),
  );

  const selectedRealPaths = new Set(
    sourceFiles.map((f) => realpathSafe(f)),
  );

  const rawDiagnostics = [
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(),
    ...program.getOptionsDiagnostics(),
  ];

  const productionDiagnostics = rawDiagnostics.filter((diag) => {
    if (!diag.file) return true;
    const filePath = diag.file.fileName;
    const normalized = normalizePath(filePath, projectRoot);
    if (selectedSet.has(normalized)) return true;
    try {
      const real = realpathSafe(filePath);
      if (selectedRealPaths.has(real)) return true;
    } catch {
      // ignore
    }
    return false;
  });

  return {
    diagnostics: productionDiagnostics,
    program,
    ts,
    selectedFileCount: sourceFiles.length,
    excludedCount: sources.excluded.length,
    exclusionCounts: sources.exclusionCounts,
    installation,
    compilerOptions: finalOptions,
  };
}

function normalizePath(absolutePath, projectRoot) {
  const rel = relative(projectRoot, absolutePath);
  if (!rel) return '';
  return rel.split(sep).join('/');
}

function realpathSafe(p) {
  try {
    return realpathSync(p);
  } catch {
    return p;
  }
}
