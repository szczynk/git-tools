import type { AgentToolResult } from "@earendil-works/pi-coding-agent";
import { compactDiff, FAILED_ERROR_MESSAGE } from "@szczynk/git-tools-core";
import {
  GIT_TOOLS_DIFF_NO_COMPACT_NAME,
  GIT_TOOLS_DIFF_PROMPT_RESULT,
} from "../constants.js";

interface GitDiffParams { cwd?: string; args?: string }

export async function executeDiffNoCompact(_toolCallId: string, params: GitDiffParams): Promise<AgentToolResult<undefined>> {
  const cwd = params.cwd ?? ".";
  const extra = (params.args ?? "").trim();
  const args = extra ? extra.split(/\s+/) : [];

  const output = compactDiff(args, -1, -1, cwd);

  if (output.startsWith("git_diff") && output.includes(FAILED_ERROR_MESSAGE)) {
    return {
      content: [{ type: "text", text: `${GIT_TOOLS_DIFF_NO_COMPACT_NAME} ${FAILED_ERROR_MESSAGE} ${output}` }],
      details: undefined
    };
  }

  if (!output) {
    return { content: [{ type: "text", text: "WARNING: clean — nothing to commit.\nSTOP NOW." }], details: undefined };
  }

  return { content: [{ type: "text", text: output + GIT_TOOLS_DIFF_PROMPT_RESULT }], details: undefined };
}
