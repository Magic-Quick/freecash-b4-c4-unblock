import assert from 'node:assert/strict';
import {
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { loadConfig } from '../src/config.mjs';
import { typecheck } from '../src/compiler.mjs';
import { normalizeDiagnostics } from '../src/diagnostics.mjs';
import {
  CreatorNotFoundError,
  InvalidInputError,
  SourceDiscoveryError,
} from '../src/exit-codes.mjs';
import { resolveCreator } from '../src/creator-installation.mjs';
import { discoverSources } from '../src/source-discovery.mjs';

function createFixtureRoot() {
  return mkdtempSync(join(tmpdir(), 'plbx-cocos-typecheck-'));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function cleanupFixture(rootPath) {
  rmSync(rootPath, { recursive: true, force: true });
}

test('selects production files and excludes test files from a canonical project root', (t) => {
  const rootPath = createFixtureRoot();
  t.after(() => cleanupFixture(rootPath));

  mkdirSync(join(rootPath, 'assets', 'tests'), { recursive: true });
  writeFileSync(join(rootPath, 'assets', 'valid.ts'), 'export const value = 1;\n');
  writeFileSync(join(rootPath, 'assets', 'tests', 'invalid.test.ts'), 'const value: number = "test";\n');

  const config = loadConfig(rootPath, null);
  const result = discoverSources(config.projectRoot, config);

  assert.deepEqual(
    result.selectedFiles.map((file) => file.relativePath),
    ['assets/valid.ts'],
  );
  assert.equal(result.exclusionCounts.test, 1);
});

test('uses project.root as the base for source roots and tsconfig options', (t) => {
  const workspaceRoot = createFixtureRoot();
  t.after(() => cleanupFixture(workspaceRoot));

  const nestedProjectRoot = join(workspaceRoot, 'playable');
  mkdirSync(join(nestedProjectRoot, 'assets'), { recursive: true });
  writeFileSync(join(nestedProjectRoot, 'assets', 'entry.ts'), 'export const value = 1;\n');
  writeJson(join(workspaceRoot, 'tsconfig.json'), {
    compilerOptions: { strict: true },
  });
  writeJson(join(nestedProjectRoot, 'tsconfig.json'), {
    compilerOptions: { strict: false },
  });
  writeJson(join(workspaceRoot, 'typecheck.json'), {
    project: {
      root: 'playable',
      sourceRoots: ['assets'],
    },
  });

  const config = loadConfig(workspaceRoot, 'typecheck.json');
  const result = discoverSources(config.projectRoot, config);

  assert.equal(config.projectRoot, realpathSync(nestedProjectRoot));
  assert.equal(config.project.sourceRoots[0], join(realpathSync(nestedProjectRoot), 'assets'));
  assert.equal(config.compiler.options.strict, false);
  assert.deepEqual(
    result.selectedFiles.map((file) => relative(config.projectRoot, file.absolutePath)),
    ['assets/entry.ts'],
  );
});

test('rejects a source root symlink when followSymlinks is disabled', (t) => {
  const rootPath = createFixtureRoot();
  const externalPath = createFixtureRoot();
  t.after(() => cleanupFixture(rootPath));
  t.after(() => cleanupFixture(externalPath));

  mkdirSync(join(externalPath, 'assets'), { recursive: true });
  writeFileSync(join(externalPath, 'assets', 'external.ts'), 'export const value = 1;\n');
  symlinkSync(join(externalPath, 'assets'), join(rootPath, 'linked-assets'));
  writeJson(join(rootPath, 'typecheck.json'), {
    project: { sourceRoots: ['linked-assets'] },
  });

  const config = loadConfig(rootPath, 'typecheck.json');
  assert.throws(
    () => discoverSources(config.projectRoot, config),
    SourceDiscoveryError,
  );
});

test('rejects an explicit missing Creator path instead of falling back', () => {
  assert.throws(
    () => resolveCreator({
      creatorPathArg: join(tmpdir(), 'missing-cocos-creator'),
      ccDeclarationArg: null,
      config: { creator: { path: null, expectedVersion: null } },
    }),
    (error) => error instanceof CreatorNotFoundError
      && error.message.includes('--creator-path does not exist'),
  );
});

test('classifies invalid compiler options as user input errors', () => {
  const fakeTypeScript = {
    convertCompilerOptionsFromJson: () => ({
      options: {},
      errors: [{ messageText: 'Invalid compiler option.' }],
    }),
    flattenDiagnosticMessageText: (message) => message,
  };

  assert.throws(
    () => typecheck({
      ts: fakeTypeScript,
      sourceFiles: [],
      ccDeclarationPath: null,
      extraTypeFiles: [],
      compilerOptions: {},
      projectRoot: tmpdir(),
      installation: {},
      sources: { excluded: [], exclusionCounts: {} },
    }),
    InvalidInputError,
  );
});

test('retains compiler diagnostics without an attached source file', () => {
  const fakeTypeScript = {
    convertCompilerOptionsFromJson: () => ({ options: {}, errors: [] }),
    createProgram: () => ({
      getSyntacticDiagnostics: () => [],
      getSemanticDiagnostics: () => [],
      getOptionsDiagnostics: () => [{
        file: undefined,
        category: 1,
        code: 9999,
        messageText: 'Global compiler diagnostic.',
      }],
    }),
  };

  const result = typecheck({
    ts: fakeTypeScript,
    sourceFiles: [],
    ccDeclarationPath: null,
    extraTypeFiles: [],
    compilerOptions: {},
    projectRoot: tmpdir(),
    installation: {},
    sources: { excluded: [], exclusionCounts: {} },
  });

  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, 9999);
});

test('preserves global compiler diagnostics without a source file', () => {
  const result = normalizeDiagnostics([
    {
      file: undefined,
      start: undefined,
      category: 1,
      code: 9999,
      messageText: 'Global compiler diagnostic.',
    },
  ], {
    flattenDiagnosticMessageText: (message) => message,
  }, tmpdir());

  assert.deepEqual(result, [{
    file: null,
    line: 0,
    column: 0,
    category: 'error',
    code: 9999,
    message: 'Global compiler diagnostic.',
  }]);
});
