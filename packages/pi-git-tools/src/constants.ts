export const GIT_TOOLS_STATUS_NAME = "git_status"
export const GIT_TOOLS_RESTORE_STAGED_NAME = "git_restore_staged"
export const GIT_TOOLS_DIFF_NAME = "git_diff"
export const GIT_TOOLS_DIFF_NO_COMPACT_NAME = "git_diff_no_compact"
export const GIT_TOOLS_FORMAT_NAME = "git_format_message"

export const GIT_TOOLS_COMMAND_NAME = "git-tools"
export const GIT_TOOLS_COMMAND_DESCRIPTION = "Produces copy-paste conventional commit messages from git diffs"

export const GIT_TOOLS_COMMAND_PROMPT_1 =
  "# Git Commit Assistant\n\n" +
  "## Tools Workflow\n\n" +
  `1. CALL \`${GIT_TOOLS_STATUS_NAME}\` to see changed files.\n` +
  "   If output contains \"WARNING: Staged changes detected\":\n" +
  `      - 1a. CALL TOOL: \`${GIT_TOOLS_RESTORE_STAGED_NAME}\` (no arguments)\n` +
  `      - 1b. CALL TOOL: \`${GIT_TOOLS_STATUS_NAME}\` again to confirm clean index\n` +
  "      - 1c. Only then proceed to step 2\n" +
  `2. CALL \`${GIT_TOOLS_DIFF_NAME}\` to see the code changes.\n` +
  "   *Note: The diff output provided is complete. Do not use bash tools to read external log files.*\n" +
  "3. Analyze the diff to understand the changes and draft a commit message.\n" +
  `4. CALL TOOL: \`${GIT_TOOLS_FORMAT_NAME}\` with your draft message to get the final formatted Conventional Commit message.`

export const GIT_TOOLS_COMMAND_PROMPT_2 =
  "\n\n## CRITICAL: Final Output Rule\n\n" +
  `After calling \`${GIT_TOOLS_FORMAT_NAME}\`, the tool will return the final, perfectly formatted commit message.\n` +
  "**DO NOT output any text after the tool result.**\n" +
  "Do not repeat the message. Do not add introductory or concluding remarks. The tool's output is the final answer and the task is complete."

export const GIT_TOOLS_COMMAND_PROMPT = GIT_TOOLS_COMMAND_PROMPT_1 + GIT_TOOLS_COMMAND_PROMPT_2

export const GIT_TOOLS_STATUS_LABEL = "Git Status"
export const GIT_TOOLS_STATUS_DESCRIPTION =
  "Show compact git status (porcelain format with branch info). " +
  `If staged changes are present — call \`${GIT_TOOLS_RESTORE_STAGED_NAME}\` ` +
  `to unstage them, then call \`${GIT_TOOLS_STATUS_NAME}\` again to confirm a clean index.`
export const GIT_TOOLS_STATUS_PROMPT_SNIPPET = "Show compact git status (porcelain format with branch info)."
export const GIT_TOOLS_STATUS_PROMPT_RESULT =
  "\n\n\nREQUIRED:\n" + `2. CALL \`${GIT_TOOLS_DIFF_NAME}\` to see the code changes.`
export const GIT_TOOLS_STATUS_PROMPT_RESULT_STAGED =
  "WARNING: Staged changes detected.\n" +
  `STOP. DO NOT CALL \`${GIT_TOOLS_DIFF_NAME}\` YET.\n` +
  `REQUIRED: CALL \`${GIT_TOOLS_RESTORE_STAGED_NAME}\` tool now.`
export const GIT_TOOLS_STATUS_PROMPT_RESULT_EMPTY =
  "WARNING: clean — nothing to commit.\nSTOP NOW."

export const GIT_TOOLS_RESTORE_STAGED_LABEL = "Git Restore Staged"
export const GIT_TOOLS_RESTORE_STAGED_DESCRIPTION = "Unstage all staged changes."
export const GIT_TOOLS_RESTORE_STAGED_PROMPT_SNIPPET = "Unstage all staged changes (git restore --staged .)."
export const GIT_TOOLS_RESTORE_STAGED_PROMPT_RESULT =
  "All staged changes have been unstaged.\n" +
  `REQUIRED: CALL \`${GIT_TOOLS_STATUS_NAME}\` again to confirm clean index.`

export const GIT_TOOLS_DIFF_LABEL = "Git Diff"
export const GIT_TOOLS_DIFF_DESCRIPTION =
  "Show compact git diff with stat summary. " +
  "If the output ends with `[full diff: rtk git diff --no-compact]`, " +
  `call \`${GIT_TOOLS_DIFF_NO_COMPACT_NAME}\` to retrieve the complete diff.`
export const GIT_TOOLS_DIFF_PROMPT_SNIPPET =
  `Show compact git diff with stat summary; escalates to \`${GIT_TOOLS_DIFF_NO_COMPACT_NAME}\` when needed.`
export const GIT_TOOLS_DIFF_PROMPT_RESULT =
  "\n\n\nREQUIRED:\n" + "3. Analyze the diff to understand the changes and draft a commit message.\n" +
  `4. CALL TOOL: \`${GIT_TOOLS_FORMAT_NAME}\` with your draft message to get the final formatted Conventional Commit message.`
export const GIT_TOOLS_DIFF_PROMPT_RESULT_BLOCKED =
  "BLOCKED: git_diff called while staged changes exist.\n" +
  `REQUIRED: CALL \`${GIT_TOOLS_RESTORE_STAGED_NAME}\` first, then retry.`
export const GIT_TOOLS_DIFF_PROMPT_RESULT_TRUNCATED =
  "WARNING: this diff truncated.\n" +
  `REQUIRED: CALL \`${GIT_TOOLS_DIFF_NO_COMPACT_NAME}\` now to retrieve the complete diff.`

export const GIT_TOOLS_DIFF_NO_COMPACT_LABEL = "Git Diff No Compact"
export const GIT_TOOLS_DIFF_NO_COMPACT_DESCRIPTION = "Show full git diff with stat summary."
export const GIT_TOOLS_DIFF_NO_COMPACT_PROMPT_SNIPPET = "Show full git diff with stat summary (no truncation, no hint)."

export const GIT_TOOLS_FORMAT_LABEL = "Git Format Message"
export const GIT_TOOLS_FORMAT_DESCRIPTION =
  "Assemble and validate a Conventional Commit message from structured fields. " +
  "Call this after analysing the diff instead of writing the commit message yourself. " +
  "The tool returns the final formatted message. Do not output anything else after calling this tool."
export const GIT_TOOLS_FORMAT_PROMPT_SNIPPET = "Assemble a Conventional Commit message from structured fields and return it ready to copy."

export const GIT_TOOLS_FORMAT_PROMPT_RESULT_FILE_LIST = "Files changed:\n\n"
export const GIT_TOOLS_FORMAT_PROMPT_RESULT_READY = "\n\n\nReady to copy-paste:\n\n"
export const GIT_TOOLS_FORMAT_PROMPT_RESULT_NOT_CALLED =
  `WARNING: You just reviewed the diff but haven't called ${GIT_TOOLS_FORMAT_NAME} yet.\n` +
  `REQUIRED: CALL \`${GIT_TOOLS_FORMAT_NAME}\` now.`

export const GIT_TOOLS_PARAMETER_CWD_DESCRIPTION = "Current working directory."
export const GIT_TOOLS_PARAMETER_ARGS_DESCRIPTION = "Extra arguments forwarded verbatim to git diff."
