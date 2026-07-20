import { readdirSync, lstatSync, realpathSync, existsSync, readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep, join } from 'node:path';

import { SourceDiscoveryError } from './exit-codes.mjs';

function toPosix(p) {
  return p.split(sep).join('/');
}

function globToRegex(glob) {
  let i = 0;
  let regex = '';
  while (i < glob.length) {
    const c = glob[i];
    if (c === '*') {
      if (glob[i + 1] === '*') {
        i += 2;
        if (glob[i] === '/') {
          i++;
          regex += '(?:.*/)?';
        } else {
          regex += '.*';
        }
      } else {
        regex += '[^/]*';
        i++;
      }
    } else if (c === '?') {
      regex += '[^/]';
      i++;
    } else if (c === '.') {
      regex += '\\.';
      i++;
    } else if (c === '/') {
      regex += '/';
      i++;
    } else if ('+()|^{}[]$\\'.includes(c)) {
      regex += '\\' + c;
      i++;
    } else {
      regex += c;
      i++;
    }
  }
  return new RegExp('^' + regex + '$');
}

function inferExclusionReason(pattern) {
  if (/test|spec/i.test(pattern)) return 'test';
  if (/generated|\.gen/i.test(pattern)) return 'generated';
  if (/node_modules|temp|library|profiles|settings/i.test(pattern))
    return 'cache';
  if (/build/i.test(pattern)) return 'build';
  if (/extensions/i.test(pattern)) return 'extension';
  return 'pattern';
}

function isInsideProject(filePath, projectRoot) {
  const rel = relative(projectRoot, filePath);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function isSymlink(filePath) {
  try {
    return lstatSync(filePath).isSymbolicLink();
  } catch {
    return false;
  }
}

function isNestedCocosProject(dirPath, projectRoot) {
  if (dirPath === projectRoot) return false;
  const tempConfig = join(dirPath, 'temp', 'tsconfig.cocos.json');
  if (existsSync(tempConfig)) return true;
  const pkg = join(dirPath, 'package.json');
  if (existsSync(pkg)) {
    try {
      const content = JSON.parse(readFileSync(pkg, 'utf-8'));
      if (content.creator && content.creator.version) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

export function discoverSources(projectRoot, config) {
  const { sourceRoots, include, exclude, followSymlinks } = config.project;

  const includeRegexes = include.map((p) => ({
    pattern: p,
    regex: globToRegex(p),
  }));

  const excludeEntries = exclude.map((p) => ({
    pattern: p,
    regex: globToRegex(p),
    reason: inferExclusionReason(p),
  }));

  const selected = [];
  const excluded = [];
  const errors = [];
  const visitedRealPaths = new Set();

  for (const root of sourceRoots) {
    if (!existsSync(root)) {
      errors.push(`Source root does not exist: ${root}`);
      continue;
    }
    const rootStat = lstatSync(root);
    if (!rootStat.isDirectory()) {
      errors.push(`Source root is not a directory: ${root}`);
      continue;
    }
    if (!followSymlinks && rootStat.isSymbolicLink()) {
      errors.push(`Source root is a symlink and followSymlinks is false: ${root}`);
      continue;
    }

    walkDirectory(root, projectRoot, {
      includeRegexes,
      excludeEntries,
      followSymlinks,
      selected,
      excluded,
      errors,
      visitedRealPaths,
    });
  }

  if (errors.length > 0) {
    throw new SourceDiscoveryError(
      `Source discovery errors:\n${errors.map((e) => `  - ${e}`).join('\n')}`,
    );
  }

  if (selected.length === 0) {
    throw new SourceDiscoveryError(
      `No source files selected.\n` +
        `Source roots: ${sourceRoots.join(', ')}\n` +
        `Include patterns: ${include.join(', ')}\n` +
        `Excluded ${excluded.length} files.`,
    );
  }

  const sortedSelected = [...selected].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath),
  );

  const sortedExcluded = [...excluded].sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath),
  );

  const exclusionCounts = {};
  for (const e of sortedExcluded) {
    exclusionCounts[e.reason] = (exclusionCounts[e.reason] || 0) + 1;
  }

  return {
    selected: sortedSelected.map((s) => s.absolutePath),
    selectedFiles: sortedSelected,
    excluded: sortedExcluded,
    exclusionCounts,
  };
}

function walkDirectory(
  dirPath,
  projectRoot,
  ctx,
) {
  if (isNestedCocosProject(dirPath, projectRoot)) {
    return;
  }

  let entries;
  try {
    entries = readdirSync(dirPath, { withFileTypes: true });
  } catch (e) {
    ctx.errors.push(`Cannot read directory: ${dirPath} (${e.message})`);
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    const relativePath = toPosix(relative(projectRoot, fullPath));

    if (entry.isSymbolicLink() && !ctx.followSymlinks) {
      ctx.excluded.push({
        relativePath,
        absolutePath: fullPath,
        reason: 'symlink',
        pattern: '(symlink)',
      });
      continue;
    }

    let realPath;
    try {
      realPath = realpathSync(fullPath);
    } catch {
      realPath = fullPath;
    }

    if (!isInsideProject(realPath, projectRoot)) {
      ctx.excluded.push({
        relativePath,
        absolutePath: fullPath,
        reason: 'symlink',
        pattern: '(outside root)',
      });
      continue;
    }

    if (entry.isDirectory()) {
      walkDirectory(fullPath, projectRoot, ctx);
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      processFile(fullPath, relativePath, realPath, ctx);
    }
  }
}

function processFile(absolutePath, relativePath, realPath, ctx) {
  if (ctx.visitedRealPaths.has(realPath)) {
    return;
  }
  ctx.visitedRealPaths.add(realPath);

  const matchesInclude = ctx.includeRegexes.some((r) => r.regex.test(relativePath));
  if (!matchesInclude) {
    return;
  }

  for (const ex of ctx.excludeEntries) {
    if (ex.regex.test(relativePath)) {
      ctx.excluded.push({
        relativePath,
        absolutePath,
        reason: ex.reason,
        pattern: ex.pattern,
      });
      return;
    }
  }

  ctx.selected.push({ relativePath, absolutePath });
}
