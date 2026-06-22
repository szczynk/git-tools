export { gitSync } from "./git.js";

export { compactStatus, hasStagedChanges } from "./status.js";
export { compactDiff, compactDiffText } from "./diff.js";
export { formatCommitMessage } from "./format.js";

export { STAGED_RE, FULL_DIFF_HINT, FAILED_ERROR_MESSAGE, MAX_NUDGES, COMMIT_TYPES } from "./constants.js";

export type { GitFile, FormatMessageParams, FormatMessageResult } from "./types.js";
