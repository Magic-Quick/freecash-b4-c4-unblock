export const VERSION = '1.0.0';

export const EXIT_CODES = {
  PASSED: 0,
  TYPECHECK_ERRORS: 1,
  INVALID_INPUT: 2,
  CREATOR_NOT_FOUND: 3,
  SOURCE_DISCOVERY_ERROR: 4,
  INTERNAL_ERROR: 5,
};

export const EXIT_CODE_DESCRIPTIONS = {
  [EXIT_CODES.PASSED]:
    'Typecheck passed — no TypeScript errors in selected production files.',
  [EXIT_CODES.TYPECHECK_ERRORS]:
    'TypeScript diagnostics of error level found in selected production files.',
  [EXIT_CODES.INVALID_INPUT]:
    'Invalid CLI input or project config failed schema validation.',
  [EXIT_CODES.CREATOR_NOT_FOUND]:
    'Creator, bundled TypeScript, cc.d.ts not found or version mismatch.',
  [EXIT_CODES.SOURCE_DISCOVERY_ERROR]:
    'Source discovery error: empty selection, file outside root, forbidden symlink, or inaccessible source root.',
  [EXIT_CODES.INTERNAL_ERROR]:
    'Unexpected internal helper error.',
};

export class CliError extends Error {
  constructor(message, exitCode) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}

export class InvalidInputError extends CliError {
  constructor(message) {
    super(message, EXIT_CODES.INVALID_INPUT);
    this.name = 'InvalidInputError';
  }
}

export class CreatorNotFoundError extends CliError {
  constructor(message) {
    super(message, EXIT_CODES.CREATOR_NOT_FOUND);
    this.name = 'CreatorNotFoundError';
  }
}

export class SourceDiscoveryError extends CliError {
  constructor(message) {
    super(message, EXIT_CODES.SOURCE_DISCOVERY_ERROR);
    this.name = 'SourceDiscoveryError';
  }
}
