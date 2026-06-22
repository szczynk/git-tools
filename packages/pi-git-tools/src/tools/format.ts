import type { AgentToolResult } from "@earendil-works/pi-coding-agent";
import { formatCommitMessage } from "@szczynk/git-tools-core";
import type { FormatMessageParams } from "@szczynk/git-tools-core";
import {
  GIT_TOOLS_FORMAT_NAME,
  GIT_TOOLS_FORMAT_PROMPT_RESULT_FILE_LIST,
  GIT_TOOLS_FORMAT_PROMPT_RESULT_READY,
  GIT_TOOLS_COMMAND_PROMPT_2,
} from "../constants.js";

export async function executeFormat(_toolCallId: string, params: FormatMessageParams): Promise<AgentToolResult<undefined>> {
  const result = formatCommitMessage(params);

  if (!result.ok) {
    return { content: [{ type: "text", text: `${GIT_TOOLS_FORMAT_NAME} error: ${result.error}` }], details: undefined };
  }

  return {
    content: [{
      type: "text",
      text: GIT_TOOLS_FORMAT_PROMPT_RESULT_FILE_LIST +
        result.fileList +
        GIT_TOOLS_FORMAT_PROMPT_RESULT_READY +
        result.message +
        GIT_TOOLS_COMMAND_PROMPT_2,
    }],
    details: undefined
  };
}
