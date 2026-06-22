import type { AgentToolResult } from "@earendil-works/pi-coding-agent";
import { gitSync, FAILED_ERROR_MESSAGE } from "@szczynk/git-tools-core";
import {
  GIT_TOOLS_RESTORE_STAGED_NAME,
  GIT_TOOLS_RESTORE_STAGED_PROMPT_RESULT,
} from "../constants.js";

interface GitStatusParams { cwd?: string }

export async function executeRestoreStaged(_toolCallId: string, params: GitStatusParams): Promise<AgentToolResult<undefined>> {
  const cwd = params.cwd ?? ".";
  const result = gitSync(["restore", "--staged", "."], cwd);

  if (result.exitCode !== 0) {
    return {
      content: [{
        type: "text",
        text: `${GIT_TOOLS_RESTORE_STAGED_NAME} ${FAILED_ERROR_MESSAGE} ${result.stderr || "unknown error"}`,
      }],
      details: undefined
    };
  }

  return { content: [{ type: "text", text: GIT_TOOLS_RESTORE_STAGED_PROMPT_RESULT }], details: undefined };
}
