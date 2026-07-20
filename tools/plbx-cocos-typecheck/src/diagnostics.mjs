import { relative, sep } from 'node:path';

const CATEGORY_NAMES = {
  0: 'warning',
  1: 'error',
  2: 'suggestion',
  3: 'message',
};

export function normalizeDiagnostics(rawDiagnostics, ts, projectRoot) {
  const normalized = [];

  for (const diag of rawDiagnostics) {
    const relPath = diag.file
      ? toRelativePosix(diag.file.fileName, projectRoot)
      : null;

    let line = 0;
    let column = 0;
    if (diag.file && typeof diag.start === 'number') {
      const pos = diag.file.getLineAndCharacterOfPosition(diag.start);
      line = pos.line + 1;
      column = pos.character + 1;
    }

    const category = CATEGORY_NAMES[diag.category] || 'error';
    const code = diag.code;
    const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');

    normalized.push({
      file: relPath,
      line,
      column,
      category,
      code,
      message,
    });
  }

  return sortDiagnostics(normalized);
}

export function sortDiagnostics(diagnostics) {
  return [...diagnostics].sort((a, b) => {
    const leftFile = a.file || '';
    const rightFile = b.file || '';
    if (leftFile !== rightFile) return leftFile.localeCompare(rightFile);
    if (a.line !== b.line) return a.line - b.line;
    if (a.column !== b.column) return a.column - b.column;
    if (a.code !== b.code) return a.code - b.code;
    return a.message.localeCompare(b.message);
  });
}

export function countByCategory(diagnostics) {
  const counts = { error: 0, warning: 0, suggestion: 0, message: 0 };
  for (const d of diagnostics) {
    if (counts[d.category] !== undefined) {
      counts[d.category]++;
    }
  }
  return counts;
}

function toRelativePosix(absolutePath, projectRoot) {
  const rel = relative(projectRoot, absolutePath);
  return rel ? rel.split(sep).join('/') : absolutePath;
}
