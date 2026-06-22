import type { AgentToolResult } from "@earendil-works/pi-coding-agent";
import { compactStatus, STAGED_RE, FAILED_ERROR_MESSAGE } from "@szczynk/git-tools-core";
import {
  GIT_TOOLS_STATUS_NAME,
  GIT_TOOLS_STATUS_PROMPT_RESULT,
  GIT_TOOLS_STATUS_PROMPT_RESULT_EMPTY,
  GIT_TOOLS_STATUS_PROMPT_RESULT_STAGED,
} from "../constants.js";

interface GitStatusParams { cwd?: string }

export async function executeStatus(_toolCallId: string, params: GitStatusParams): Promise<AgentToolResult<undefined>> {
  const cwd = params.cwd ?? ".";
  const output = compactStatus([], cwd);

  if (output.startsWith("git_status") && output.includes(FAILED_ERROR_MESSAGE)) {
    return { content: [{ type: "text", text: `${GIT_TOOLS_STATUS_NAME} ${FAILED_ERROR_MESSAGE} ${output}` }], details: undefined };
  }

  if (!output || output.includes("clean — nothing to commit")) {
    return { content: [{ type: "text", text: GIT_TOOLS_STATUS_PROMPT_RESULT_EMPTY }], details: undefined };
  }

  if (STAGED_RE.test(output)) {
    return { content: [{ type: "text", text: GIT_TOOLS_STATUS_PROMPT_RESULT_STAGED }], details: undefined };
  }

  return { content: [{ type: "text", text: output + GIT_TOOLS_STATUS_PROMPT_RESULT }], details: undefined };
}
