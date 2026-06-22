import { tool } from "@opencode-ai/plugin";
import type { PluginInput, PluginModule, ToolDefinition } from "@opencode-ai/plugin";

import {
  statusArgs, statusExecute,
} from "./tools/status.js";
import {
  restoreStagedArgs, restoreStagedExecute,
} from "./tools/restore-staged.js";
import {
  diffArgs, diffExecute,
} from "./tools/diff.js";
import {
  diffNoCompactArgs, diffNoCompactExecute,
} from "./tools/diff-no-compact.js";
import {
  formatArgs, formatExecute,
} from "./tools/format.js";

const tools: Record<string, ToolDefinition> = {
  git_status: tool({
    description:
      "Show compact git status (porcelain format with branch info). " +
      "If staged changes are present, call git_restore_staged to unstage them.",
    args: statusArgs as any,
    execute: statusExecute as any,
  }),
  git_restore_staged: tool({
    description: "Unstage all staged changes.",
    args: restoreStagedArgs as any,
    execute: restoreStagedExecute as any,
  }),
  git_diff: tool({
    description:
      "Show compact git diff with stat summary. " +
      "If the output ends with `[full diff: rtk git diff --no-compact]`, " +
      "call git_diff_no_compact to retrieve the complete diff.",
    args: diffArgs as any,
    execute: diffExecute as any,
  }),
  git_diff_no_compact: tool({
    description: "Show full git diff with stat summary (no truncation, no hint).",
    args: diffNoCompactArgs as any,
    execute: diffNoCompactExecute as any,
  }),
  git_format_message: tool({
    description:
      "Assemble and validate a Conventional Commit message from structured fields. " +
      "Call this after analysing the diff instead of writing the commit message yourself. " +
      "The tool returns the final formatted message.",
    args: formatArgs as any,
    execute: formatExecute as any,
  }),
};

const plugin: PluginModule = {
  id: "git-tools",
  async server(_input: PluginInput) {
    return { tool: tools };
  },
};

export default plugin;
