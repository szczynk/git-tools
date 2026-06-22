export const STAGED_RE = /^[MADRCU][ MADRCU] /m;
export const FULL_DIFF_HINT = "[full diff: rtk git diff --no-compact]";
export const MAX_NUDGES = 2;
export const FAILED_ERROR_MESSAGE = "failed:";
export const COMMIT_TYPES = new Set([
  "feat", "fix", "refactor", "perf", "docs",
  "test", "chore", "build", "ci", "style", "revert"
]);
