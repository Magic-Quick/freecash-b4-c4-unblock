import { readFileSync, existsSync, statSync, realpathSync } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';

import { InvalidInputError } from './exit-codes.mjs';

const DEFAULT_EXCLUDE = [
  '**/node_modules/**',
  '**/extensions/**',
  '**/test/**',
  '**/tests/**',
  '**/__tests__/**',
  '**/*.test.ts',
  '**/*.spec.ts',
  '**/*.generated.ts',
  '**/*.gen.ts',
  '**/temp/**',
  '**/library/**',
  '**/build/**',
  '**/profiles/**',
  '**/settings/**',
];

export const DEFAULT_CONFIG = {
  schemaVersion: 1,
  creator: {
    path: null,
    expectedVersion: null,
    typescript: 'bundled',
    ccDeclarationPath: null,
    extraTypeFiles: [],
  },
  project: {
    root: '.',
    sourceRoots: ['assets'],
    include: ['**/*.ts'],
    exclude: DEFAULT_EXCLUDE,
    followSymlinks: false,
  },
  compiler: {
    readRootCompilerOptions: true,
    options: {
      target: 'ES2015',
      module: 'ES2015',
      moduleResolution: 'node',
      lib: ['ES2015', 'ES2017', 'DOM'],
      experimentalDecorators: true,
      isolatedModules: true,
      skipLibCheck: true,
    },
  },
};

const ALLOWED_TSCONFIG_OPTIONS = new Set([
  'target',
  'module',
  'moduleResolution',
  'lib',
  'strict',
  'noImplicitAny',
  'strictNullChecks',
  'strictFunctionTypes',
  'strictBindCallApply',
  'strictPropertyInitialization',
  'alwaysStrict',
  'noImplicitThis',
  'noImplicitReturns',
  'noFallthroughCasesInSwitch',
  'noImplicitOverride',
  'noPropertyAccessFromIndexSignature',
  'exactOptionalPropertyTypes',
  'experimentalDecorators',
  'emitDecoratorMetadata',
  'isolatedModules',
  'skipLibCheck',
  'forceConsistentCasingInFileNames',
  'noUnusedLocals',
  'noUnusedParameters',
  'jsx',
  'jsxImportSource',
  'esModuleInterop',
  'allowSyntheticDefaultImports',
  'resolveJsonModule',
  'downlevelIteration',
  'importHelpers',
  'removeComments',
  'stripInternal',
  'noErrorTruncation',
]);

const FORCED_OPTIONS = {
  noEmit: true,
};

const SCHEMA_KEYS = {
  top: new Set(['$schema', 'schemaVersion', 'creator', 'project', 'compiler']),
  creator: new Set([
    'path',
    'expectedVersion',
    'typescript',
    'ccDeclarationPath',
    'extraTypeFiles',
  ]),
  project: new Set([
    'root',
    'sourceRoots',
    'include',
    'exclude',
    'followSymlinks',
  ]),
  compiler: new Set(['readRootCompilerOptions', 'options']),
};

function stripJsonc(text) {
  let result = '';
  let i = 0;
  let inString = false;
  let stringChar = '';
  while (i < text.length) {
    if (inString) {
      if (text[i] === '\\') {
        result += text[i] + (text[i + 1] || '');
        i += 2;
        continue;
      }
      if (text[i] === stringChar) inString = false;
      result += text[i];
      i++;
    } else {
      if (text[i] === '"') {
        inString = true;
        stringChar = '"';
        result += text[i];
        i++;
      } else if (text[i] === '/' && text[i + 1] === '/') {
        while (i < text.length && text[i] !== '\n') i++;
      } else if (text[i] === '/' && text[i + 1] === '*') {
        i += 2;
        while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
        i += 2;
      } else {
        result += text[i];
        i++;
      }
    }
  }
  return result;
}

export function parseJsonc(text, sourceLabel) {
  try {
    return JSON.parse(stripJsonc(text));
  } catch (e) {
    throw new InvalidInputError(
      `Failed to parse JSON in ${sourceLabel}: ${e.message}`,
    );
  }
}

function checkUnknownKeys(obj, allowed, context) {
  if (!obj || typeof obj !== 'object') return;
  for (const key of Object.keys(obj)) {
    if (!allowed.has(key)) {
      throw new InvalidInputError(
        `Unknown key "${key}" in ${context}. Allowed: ${[...allowed].join(', ')}.`,
      );
    }
  }
}

function checkType(value, name, expectedType) {
  if (expectedType === 'array') {
    if (!Array.isArray(value)) {
      throw new InvalidInputError(`"${name}" must be an array.`);
    }
    return;
  }
  if (expectedType === 'string-or-null') {
    if (value !== null && typeof value !== 'string') {
      throw new InvalidInputError(`"${name}" must be a string or null.`);
    }
    return;
  }
  if (typeof value !== expectedType) {
    throw new InvalidInputError(`"${name}" must be a ${expectedType}.`);
  }
}

function validateConfigShape(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new InvalidInputError('Config must be a JSON object.');
  }
  checkUnknownKeys(raw, SCHEMA_KEYS.top, 'config root');

  if (raw.schemaVersion !== undefined) {
    checkType(raw.schemaVersion, 'schemaVersion', 'number');
  }
  if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1) {
    throw new InvalidInputError(
      `Unsupported schemaVersion ${raw.schemaVersion}. Only version 1 is supported.`,
    );
  }

  const creator = raw.creator ?? {};
  checkUnknownKeys(creator, SCHEMA_KEYS.creator, 'creator');
  if (creator.path !== undefined)
    checkType(creator.path, 'creator.path', 'string-or-null');
  if (creator.expectedVersion !== undefined)
    checkType(
      creator.expectedVersion,
      'creator.expectedVersion',
      'string-or-null',
    );
  if (creator.typescript !== undefined) {
    checkType(creator.typescript, 'creator.typescript', 'string');
    if (creator.typescript !== 'bundled') {
      throw new InvalidInputError(
        `creator.typescript "${creator.typescript}" is not supported. Only "bundled" is available in v1.`,
      );
    }
  }
  if (creator.ccDeclarationPath !== undefined)
    checkType(
      creator.ccDeclarationPath,
      'creator.ccDeclarationPath',
      'string-or-null',
    );
  if (creator.extraTypeFiles !== undefined) {
    checkType(creator.extraTypeFiles, 'creator.extraTypeFiles', 'array');
    for (const f of creator.extraTypeFiles) {
      checkType(f, 'creator.extraTypeFiles[]', 'string');
    }
  }

  const project = raw.project ?? {};
  checkUnknownKeys(project, SCHEMA_KEYS.project, 'project');
  if (project.root !== undefined)
    checkType(project.root, 'project.root', 'string');
  if (project.sourceRoots !== undefined) {
    checkType(project.sourceRoots, 'project.sourceRoots', 'array');
    for (const r of project.sourceRoots)
      checkType(r, 'project.sourceRoots[]', 'string');
  }
  if (project.include !== undefined) {
    checkType(project.include, 'project.include', 'array');
    for (const p of project.include)
      checkType(p, 'project.include[]', 'string');
  }
  if (project.exclude !== undefined) {
    checkType(project.exclude, 'project.exclude', 'array');
    for (const p of project.exclude)
      checkType(p, 'project.exclude[]', 'string');
  }
  if (project.followSymlinks !== undefined)
    checkType(project.followSymlinks, 'project.followSymlinks', 'boolean');

  const compiler = raw.compiler ?? {};
  checkUnknownKeys(compiler, SCHEMA_KEYS.compiler, 'compiler');
  if (compiler.readRootCompilerOptions !== undefined)
    checkType(
      compiler.readRootCompilerOptions,
      'compiler.readRootCompilerOptions',
      'boolean',
    );
  if (compiler.options !== undefined) {
    checkType(compiler.options, 'compiler.options', 'object');
  }
}

function deepMerge(base, override) {
  if (
    base === null ||
    typeof base !== 'object' ||
    Array.isArray(base) ||
    override === null ||
    typeof override !== 'object' ||
    Array.isArray(override)
  ) {
    return override === undefined ? base : override;
  }
  const result = { ...base };
  for (const key of Object.keys(override)) {
    result[key] = deepMerge(base[key], override[key]);
  }
  return result;
}

function hasPathTraversal(p) {
  if (!p) return false;
  const parts = p.split(/[\\/]+/);
  return parts.some(
    (part) => part === '..',
  );
}

function resolveWithinRoot(p, projectRoot, label) {
  if (hasPathTraversal(p)) {
    throw new InvalidInputError(
      `${label} "${p}" contains ".." path traversal and must stay inside project root.`,
    );
  }
  const resolved = resolve(projectRoot, p);
  if (!isInsideRoot(resolved, projectRoot)) {
    throw new InvalidInputError(
      `${label} "${p}" resolves outside project root.`,
    );
  }
  return resolved;
}

function resolveExistingFile(p, basePath, label) {
  const resolved = resolve(basePath, p);
  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    throw new InvalidInputError(`${label} "${p}" must reference an existing file.`);
  }
  return realpathSync(resolved);
}

function resolveExistingFileWithinRoot(p, projectRoot, label) {
  const resolved = resolveWithinRoot(p, projectRoot, label);
  if (!existsSync(resolved) || !statSync(resolved).isFile()) {
    throw new InvalidInputError(`${label} "${p}" must reference an existing file.`);
  }

  const realPath = realpathSync(resolved);
  if (!isInsideRoot(realPath, projectRoot)) {
    throw new InvalidInputError(
      `${label} "${p}" resolves outside project root through a symlink.`,
    );
  }

  return realPath;
}

function isInsideRoot(candidatePath, rootPath) {
  const rel = relative(rootPath, candidatePath);
  return rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

function readTsconfigCompilerOptions(projectRoot) {
  const tsconfigPath = resolve(projectRoot, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    return {};
  }
  let raw;
  try {
    raw = readFileSync(tsconfigPath, 'utf-8');
  } catch (e) {
    throw new InvalidInputError(
      `Failed to read tsconfig.json: ${e.message}`,
    );
  }
  const parsed = parseJsonc(raw, 'tsconfig.json');
  const rawOptions = parsed.compilerOptions ?? {};
  const filtered = {};
  for (const key of Object.keys(rawOptions)) {
    if (ALLOWED_TSCONFIG_OPTIONS.has(key)) {
      filtered[key] = rawOptions[key];
    }
  }
  return filtered;
}

export function loadConfig(projectRootArg, configPathArg) {
  const workspaceRoot = resolve(projectRootArg || '.');
  if (!existsSync(workspaceRoot) || !statSync(workspaceRoot).isDirectory()) {
    throw new InvalidInputError(
      `Project root does not exist or is not a directory: ${workspaceRoot}`,
    );
  }
  const projectRoot = realpathSync(workspaceRoot);

  let rawConfig = {};
  let configFilePath = null;

  if (configPathArg) {
    configFilePath = resolve(projectRoot, configPathArg);
  } else {
    const defaultPath = resolve(projectRoot, '.playbox/cocos-typecheck.json');
    if (existsSync(defaultPath)) {
      configFilePath = defaultPath;
    }
  }

  if (configFilePath) {
    if (!existsSync(configFilePath)) {
      throw new InvalidInputError(`Config file not found: ${configFilePath}`);
    }
    const text = readFileSync(configFilePath, 'utf-8');
    rawConfig = parseJsonc(text, configFilePath);
  }

  validateConfigShape(rawConfig);

  const merged = deepMerge(DEFAULT_CONFIG, rawConfig);

  const configuredProjectRoot = resolve(
    projectRoot,
    merged.project.root || '.',
  );
  if (!isInsideRoot(configuredProjectRoot, projectRoot)) {
    throw new InvalidInputError(
      `project.root "${merged.project.root}" resolves outside project root.`,
    );
  }
  if (!existsSync(configuredProjectRoot) || !statSync(configuredProjectRoot).isDirectory()) {
    throw new InvalidInputError(
      `project.root "${merged.project.root}" does not exist or is not a directory.`,
    );
  }
  const projectResolvedRoot = realpathSync(configuredProjectRoot);
  if (!isInsideRoot(projectResolvedRoot, projectRoot)) {
    throw new InvalidInputError(
      `project.root "${merged.project.root}" resolves outside project root through a symlink.`,
    );
  }

  const normalizedSourceRoots = merged.project.sourceRoots.map((r, i) =>
    resolveWithinRoot(r, projectResolvedRoot, `project.sourceRoots[${i}]`),
  );

  const normalizedExtraTypeFiles = merged.creator.extraTypeFiles.map((f, i) => {
    const label = `creator.extraTypeFiles[${i}]`;
    const resolved = resolveExistingFileWithinRoot(f, projectResolvedRoot, label);
    if (!resolved.endsWith('.d.ts')) {
      throw new InvalidInputError(`${label} "${f}" must be a .d.ts file.`);
    }
    return resolved;
  });

  const normalizedCcDeclaration = merged.creator.ccDeclarationPath
    ? resolveExistingFile(
      merged.creator.ccDeclarationPath,
      projectResolvedRoot,
      'creator.ccDeclarationPath',
    )
    : null;

  let compilerOptions = { ...merged.compiler.options };
  if (merged.compiler.readRootCompilerOptions) {
    const tsconfigOptions = readTsconfigCompilerOptions(projectResolvedRoot);
    compilerOptions = { ...compilerOptions, ...tsconfigOptions };
  }
  compilerOptions = { ...compilerOptions, ...FORCED_OPTIONS };

  const normalized = {
    schemaVersion: merged.schemaVersion,
    configFilePath,
    projectRoot: projectResolvedRoot,
    creator: {
      path: merged.creator.path || null,
      expectedVersion: merged.creator.expectedVersion || null,
      typescript: merged.creator.typescript,
      ccDeclarationPath: normalizedCcDeclaration,
      extraTypeFiles: normalizedExtraTypeFiles,
    },
    project: {
      root: projectResolvedRoot,
      sourceRoots: normalizedSourceRoots,
      include: merged.project.include,
      exclude: merged.project.exclude,
      followSymlinks: merged.project.followSymlinks,
    },
    compiler: {
      readRootCompilerOptions: merged.compiler.readRootCompilerOptions,
      options: compilerOptions,
    },
  };

  return Object.freeze(normalized);
}
