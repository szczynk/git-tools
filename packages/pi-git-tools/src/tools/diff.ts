import type { AgentToolResult } from "@earendil-works/pi-coding-agent";
import { compactStatus, compactDiff, STAGED_RE, FULL_DIFF_HINT, FAILED_ERROR_MESSAGE } from "@szczynk/git-tools-core";
import {
  GIT_TOOLS_DIFF_NAME,
  GIT_TOOLS_DIFF_PROMPT_RESULT,
  GIT_TOOLS_DIFF_PROMPT_RESULT_BLOCKED,
  GIT_TOOLS_DIFF_PROMPT_RESULT_TRUNCATED,
} from "../constants.js";

interface GitDiffParams { cwd?: string; args?: string }

export async function executeDiff(_toolCallId: string, params: GitDiffParams): Promise<AgentToolResult<undefined>> {
  const cwd = params.cwd ?? ".";
  const extra = (params.args ?? "").trim();
  const args = extra ? extra.split(/\s+/) : [];

  const statusOut = compactStatus([], cwd);
  if (STAGED_RE.test(statusOut)) {
    return { content: [{ type: "text", text: GIT_TOOLS_DIFF_PROMPT_RESULT_BLOCKED }], details: undefined };
  }

  const output = compactDiff(args, 500, 100, cwd);

  if (output.startsWith("git_diff") && output.includes(FAILED_ERROR_MESSAGE)) {
    return { content: [{ type: "text", text: `${GIT_TOOLS_DIFF_NAME} ${FAILED_ERROR_MESSAGE} ${output}` }], details: undefined };
  }

  if (!output) {
    return { content: [{ type: "text", text: "WARNING: clean — nothing to commit.\nSTOP NOW." }], details: undefined };
  }

  if (output.includes(FULL_DIFF_HINT)) {
    return { content: [{ type: "text", text: GIT_TOOLS_DIFF_PROMPT_RESULT_TRUNCATED }], details: undefined };
  }

  return { content: [{ type: "text", text: output + GIT_TOOLS_DIFF_PROMPT_RESULT }], details: undefined };
}
