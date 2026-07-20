# plbx-cocos-typecheck

Read-only TypeScript typecheck helper for Cocos Creator playable projects.

Checks production TypeScript **outside** the Cocos Editor using the real engine
declarations (`cc.d.ts`) and the **bundled** TypeScript from the installed
Cocos Creator — not the global `tsc`, not a fake `cc.d.ts`, and not the
generated `temp/tsconfig.cocos.json` file selection.

## Why

The standard `npx tsc --noEmit -p tsconfig.json` is unreliable for playable
code because:

- The root `tsconfig.json` inherits `temp/tsconfig.cocos.json`, whose file
  selection captures more than just playable sources.
- Extensions, test fixtures, nested projects, or symlinks with invalid
  TypeScript can block the whole `tsc` run before gameplay code is checked.
- The global `tsc` does not know the `cc` module and may use a different
  TypeScript version than the one bundled with Cocos Creator.

`plbx-cocos-typecheck` solves this by:

1. Loading the TypeScript API **from the Creator installation** via
   `createRequire`.
2. Including the **real** `cc.d.ts` from the same installation.
3. Discovering sources from an explicit **allowlist** (`sourceRoots` +
   `include`/`exclude`), never from `temp/` or the whole repo.
4. Forcing `noEmit: true` and never writing to the project.

## Quick start

```sh
# from the project root
node plbx-cocos-typecheck/bin/plbx-cocos-typecheck.mjs
```

Without a config file, defaults to `assets/**/*.ts` inside the project root.

## CLI

```sh
plbx-cocos-typecheck [options]
```

| Flag | Description |
| --- | --- |
| `--project <path>` | Project root (default: current directory) |
| `--config <path>` | JSON config (default: `.playbox/cocos-typecheck.json`) |
| `--creator-path <path>` | Explicit path to Cocos Creator app/installation |
| `--cc-declaration <path>` | Explicit path to `cc.d.ts` |
| `--format human\|json` | Output format (default: `human`) |
| `--show-config` | Print normalized config without running the compiler |
| `--verbose` | Show absolute paths in JSON + full error stacks |
| `--version` | Print helper version |
| `--help` | Show help and exit codes |

### Creator resolution priority

1. `--creator-path`
2. `creator.path` in project config
3. `COCOS_CREATOR_PATH` environment variable
4. Platform-specific standard locations
5. Exit code `3` if no valid installation is found

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Typecheck passed — no TypeScript errors. |
| `1` | TypeScript errors found in selected production files. |
| `2` | Invalid CLI input or config failed schema validation. |
| `3` | Creator, bundled TypeScript, or `cc.d.ts` not found / version mismatch. |
| `4` | Source discovery error: empty selection, file outside root, forbidden symlink. |
| `5` | Unexpected internal helper error. |

## Configuration

Optional. Place at `.playbox/cocos-typecheck.json`. Without it, safe defaults
are used: `assets/**/*.ts` inside the project root, with standard exclusions
for `temp/`, `library/`, `extensions/`, tests, and build output.

```json
{
  "$schema": "../plbx-cocos-typecheck/schemas/cocos-playable-typecheck.schema.json",
  "schemaVersion": 1,
  "creator": {
    "path": "/Applications/Cocos/Creator/3.8.8/CocosCreator.app",
    "expectedVersion": "3.8.8",
    "typescript": "bundled",
    "ccDeclarationPath": null,
    "extraTypeFiles": []
  },
  "project": {
    "root": ".",
    "sourceRoots": ["assets"],
    "include": ["**/*.ts"],
    "exclude": [
      "**/node_modules/**",
      "**/extensions/**",
      "**/test/**",
      "**/tests/**",
      "**/__tests__/**",
      "**/*.test.ts",
      "**/*.spec.ts",
      "**/*.generated.ts",
      "**/*.gen.ts",
      "**/temp/**",
      "**/library/**",
      "**/build/**",
      "**/profiles/**",
      "**/settings/**"
    ],
    "followSymlinks": false
  },
  "compiler": {
    "readRootCompilerOptions": true,
    "options": {
      "target": "ES2015",
      "module": "ES2015",
      "moduleResolution": "node",
      "lib": ["ES2015", "ES2017", "DOM"],
      "experimentalDecorators": true,
      "isolatedModules": true,
      "skipLibCheck": true
    }
  }
}
```

### Config rules

- `noEmit: true` is **forced** and cannot be overridden.
- The helper reads only **allowed** `compilerOptions` from `tsconfig.json`
  (target, module, strict, experimentalDecorators, etc.) — it ignores
  inherited `files`, `include`, `exclude`, `types`, `typeRoots`, and `paths`.
- `sourceRoots` and `extraTypeFiles` cannot escape the project root via `..`
  or symlinks.
- `ccDeclarationPath` override must actually declare `module "cc"`.
- `extraTypeFiles` accepts only existing `.d.ts` files inside the project root.
- Unknown config keys cause exit code `2`.

## JSON output

```json
{
  "schemaVersion": 1,
  "status": "passed",
  "exitCode": 0,
  "creator": { "version": "3.8.8" },
  "typescript": { "version": "4.9.5" },
  "sources": { "selected": 58, "excluded": 0 },
  "diagnostics": [],
  "summary": { "errors": 0, "warnings": 0, "elapsedMs": 856 }
}
```

Without `--verbose`, JSON contains no absolute paths.

## Architecture

```
plbx-cocos-typecheck/
  bin/
    plbx-cocos-typecheck.mjs   # entry point
  src/
    exit-codes.mjs              # exit codes, error classes, version
    config.mjs                  # config loading, JSONC parsing, validation
    creator-installation.mjs    # Creator/TS/cc.d.ts discovery
    source-discovery.mjs        # glob matching, symlink protection
    compiler.mjs                # TS Program, diagnostics, noEmit
    diagnostics.mjs              # normalize, sort, count
    output.mjs                  # human/JSON formatters, help
    cli.mjs                     # arg parsing, orchestration
  schemas/
    cocos-playable-typecheck.schema.json
```

### Design principles

- **Engine-authoritative types** — uses declarations from the same Creator
  that opens the project.
- **Production scope by allowlist** — selects source roots first, then applies
  include/exclude; never starts from the whole repo.
- **Read-only** — creates no `.meta`, no `temp`, no `library`, no build
  artifacts.
- **No hidden fallback** — exits with code `3` if `cc.d.ts`, bundled TS, or
  Creator version cannot be determined.
- **No generated-config inheritance** — `temp/tsconfig.cocos.json` is not used
  for file selection.
- **Safe filesystem traversal** — symlinks are not followed by default; selected
  files must lie inside the project root.

## Platform support

| Platform | Creator location |
| --- | --- |
| macOS | `/Applications/Cocos/Creator/<ver>/CocosCreator.app` |
| Windows | `C:\Program Files\Cocos\Creator\<ver>\CocosCreator.exe` |
| Linux | `/opt/Cocos/Creator/<ver>/CocosCreator` |

## Validated on

| Field | Value |
| --- | --- |
| Project | SAConveyor |
| Cocos Creator | 3.8.8 |
| Bundled TypeScript | 4.9.5 |
| `cc.d.ts` | `engine/bin/.declarations/cc.d.ts` |
| Production contour | `assets/**/*.ts` (58 files) |
| Result | PASSED, exit 0 |

## Tests

The regression suite is dependency-free and uses Node's built-in test runner:

```sh
node --test plbx-cocos-typecheck/tests/*.test.mjs
```

It covers source isolation, `project.root`, explicit Creator resolution,
compiler-option error classification, and global diagnostics.
