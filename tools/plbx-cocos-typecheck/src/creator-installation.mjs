import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';

import { CreatorNotFoundError } from './exit-codes.mjs';

const CC_MODULE_PATTERN = /declare\s+module\s+["']cc["']/;

function findStandardCreatorLocations(platform) {
  const locations = [];
  const home = homedir();

  if (platform === 'darwin') {
    const appDirs = [
      '/Applications/Cocos/Creator',
      '/Applications/CocosCreator',
      join(home, 'Applications/Cocos/Creator'),
    ];
    for (const dir of appDirs) {
      if (existsSync(dir)) {
        try {
          const entries = readdirSync(dir);
          for (const entry of entries) {
            const versionDir = join(dir, entry);
            const appPath = join(versionDir, 'CocosCreator.app');
            if (existsSync(appPath)) {
              locations.push(appPath);
            }
          }
        } catch {
          // skip unreadable
        }
      }
    }
    if (existsSync('/Applications/CocosCreator.app')) {
      locations.push('/Applications/CocosCreator.app');
    }
  } else if (platform === 'win32') {
    const baseDirs = [
      'C:\\Program Files\\Cocos\\Creator',
      'C:\\Program Files (x86)\\Cocos\\Creator',
      join(home, 'AppData\\Local\\Cocos\\Creator'),
    ];
    for (const dir of baseDirs) {
      if (existsSync(dir)) {
        try {
          const entries = readdirSync(dir);
          for (const entry of entries) {
            const versionDir = join(dir, entry);
            const exePath = join(versionDir, 'CocosCreator.exe');
            if (existsSync(exePath)) {
              locations.push(versionDir);
            }
          }
        } catch {
          // skip
        }
      }
    }
  } else if (platform === 'linux') {
    const baseDirs = [
      '/opt/Cocos/Creator',
      '/usr/local/Cocos/Creator',
      join(home, 'Cocos/Creator'),
    ];
    for (const dir of baseDirs) {
      if (existsSync(dir)) {
        try {
          const entries = readdirSync(dir);
          for (const entry of entries) {
            const versionDir = join(dir, entry);
            const exePath = join(versionDir, 'CocosCreator');
            if (existsSync(exePath)) {
              locations.push(versionDir);
            }
          }
        } catch {
          // skip
        }
      }
    }
  }

  return locations;
}

const CC_DECLARATION_CANDIDATES = [
  'Contents/Resources/resources/3d/engine/bin/.declarations/cc.d.ts',
  'resources/resources/3d/engine/bin/.declarations/cc.d.ts',
  'resources/3d/engine/bin/.declarations/cc.d.ts',
];

const TYPESCRIPT_CANDIDATES = [
  'Contents/Resources/resources/3d/engine/node_modules/typescript',
  'resources/resources/3d/engine/node_modules/typescript',
  'resources/3d/engine/node_modules/typescript',
  'Contents/Resources/resources/3d/engine/node_modules/@cocos/typescript',
  'resources/resources/3d/engine/node_modules/@cocos/typescript',
];

function findFile(basePath, candidates) {
  for (const candidate of candidates) {
    const full = join(basePath, candidate);
    if (existsSync(full) && statSync(full).isFile()) {
      return full;
    }
  }
  return null;
}

function findDir(basePath, candidates) {
  for (const candidate of candidates) {
    const full = join(basePath, candidate);
    if (existsSync(full) && statSync(full).isDirectory()) {
      return full;
    }
  }
  return null;
}

function findTypescriptLib(typescriptDir) {
  const libFile = join(typescriptDir, 'lib', 'typescript.js');
  if (existsSync(libFile)) return libFile;
  const tscFile = join(typescriptDir, 'lib', 'tsc.js');
  if (existsSync(tscFile)) return tscFile;
  return null;
}

function verifyCcDeclaration(filePath) {
  try {
    const content = readFileSync(filePath, { encoding: 'utf-8', flag: 'r' });
    const head = content.slice(0, 8192);
    return CC_MODULE_PATTERN.test(head);
  } catch {
    return false;
  }
}

function inferCreatorVersionFromPath(creatorPath) {
  const match = creatorPath.match(/(\d+\.\d+\.\d+)/);
  return match ? match[1] : null;
}

export function resolveCreator({ creatorPathArg, ccDeclarationArg, config }) {
  const platform = process.platform;

  let creatorPath = null;
  const triedPaths = [];

  if (creatorPathArg) {
    triedPaths.push(creatorPathArg);
    if (!existsSync(creatorPathArg)) {
      throw new CreatorNotFoundError(
        `--creator-path does not exist: ${creatorPathArg}`,
      );
    }
    creatorPath = resolve(creatorPathArg);
  }

  if (!creatorPath && config?.creator?.path) {
    triedPaths.push(config.creator.path);
    if (!existsSync(config.creator.path)) {
      throw new CreatorNotFoundError(
        `creator.path does not exist: ${config.creator.path}`,
      );
    }
    creatorPath = resolve(config.creator.path);
  }

  if (!creatorPath) {
    const envPath = process.env.COCOS_CREATOR_PATH;
    if (envPath) {
      triedPaths.push(`${envPath} (COCOS_CREATOR_PATH)`);
      if (!existsSync(envPath)) {
        throw new CreatorNotFoundError(
          `COCOS_CREATOR_PATH does not exist: ${envPath}`,
        );
      }
      creatorPath = resolve(envPath);
    }
  }

  if (!creatorPath) {
    const standard = findStandardCreatorLocations(platform);
    for (const loc of standard) {
      triedPaths.push(loc);
    }
    if (standard.length > 0) {
      creatorPath = standard[0];
    }
  }

  if (!creatorPath) {
    throw new CreatorNotFoundError(
      `Cocos Creator installation not found.\n` +
        `Tried:\n${triedPaths.map((p) => `  - ${p}`).join('\n')}\n` +
        `Set --creator-path, creator.path in config, or COCOS_CREATOR_PATH env variable.\n` +
        `Platform: ${platform}`,
    );
  }

  let ccDeclarationPath = null;
  if (ccDeclarationArg) {
    if (!existsSync(ccDeclarationArg)) {
      throw new CreatorNotFoundError(
        `--cc-declaration path does not exist: ${ccDeclarationArg}`,
      );
    }
    if (!verifyCcDeclaration(ccDeclarationArg)) {
      throw new CreatorNotFoundError(
        `--cc-declaration file does not declare module "cc": ${ccDeclarationArg}`,
      );
    }
    ccDeclarationPath = resolve(ccDeclarationArg);
  } else if (config?.creator?.ccDeclarationPath) {
    if (!existsSync(config.creator.ccDeclarationPath)) {
      throw new CreatorNotFoundError(
        `creator.ccDeclarationPath does not exist: ${config.creator.ccDeclarationPath}`,
      );
    }
    if (!verifyCcDeclaration(config.creator.ccDeclarationPath)) {
      throw new CreatorNotFoundError(
        `creator.ccDeclarationPath does not declare module "cc": ${config.creator.ccDeclarationPath}`,
      );
    }
    ccDeclarationPath = config.creator.ccDeclarationPath;
  } else {
    ccDeclarationPath = findFile(creatorPath, CC_DECLARATION_CANDIDATES);
    if (!ccDeclarationPath) {
      throw new CreatorNotFoundError(
        `cc.d.ts not found inside Creator installation: ${creatorPath}\n` +
          `Searched:\n${CC_DECLARATION_CANDIDATES.map(
            (c) => `  - ${join(creatorPath, c)}`,
          ).join('\n')}\n` +
          `Use --cc-declaration or creator.ccDeclarationPath to override.`,
      );
    }
    if (!verifyCcDeclaration(ccDeclarationPath)) {
      throw new CreatorNotFoundError(
        `Found cc.d.ts at ${ccDeclarationPath} but it does not declare module "cc".`,
      );
    }
  }

  const typescriptDir = findDir(creatorPath, TYPESCRIPT_CANDIDATES);
  let typescriptLibPath = null;
  if (typescriptDir) {
    typescriptLibPath = findTypescriptLib(typescriptDir);
  }

  if (!typescriptLibPath) {
    throw new CreatorNotFoundError(
      `Bundled TypeScript not found inside Creator installation: ${creatorPath}\n` +
        `Searched:\n${TYPESCRIPT_CANDIDATES.map(
          (c) => `  - ${join(creatorPath, c)}`,
        ).join('\n')}`,
    );
  }

  let tsApi;
  try {
    tsApi = createRequire(import.meta.url)(typescriptLibPath);
  } catch (e) {
    throw new CreatorNotFoundError(
      `Failed to load bundled TypeScript from ${typescriptLibPath}: ${e.message}`,
    );
  }

  const typescriptVersion = tsApi.version || null;
  const creatorVersion = inferCreatorVersionFromPath(creatorPath);

  if (config?.creator?.expectedVersion) {
    const expected = config.creator.expectedVersion;
    if (creatorVersion && creatorVersion !== expected) {
      throw new CreatorNotFoundError(
        `Creator version mismatch: expected ${expected}, found ${creatorVersion} (from path: ${creatorPath}).`,
      );
    }
  }

  return {
    creatorPath,
    creatorVersion,
    ccDeclarationPath,
    typescriptLibPath,
    typescriptDir,
    typescriptVersion,
    ts: tsApi,
    platform,
  };
}
