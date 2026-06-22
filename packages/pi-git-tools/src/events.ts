import type {
  ExtensionAPI,
  ExtensionContext,
  TurnEndEvent,
  TurnStartEvent,
} from "@earendil-works/pi-coding-agent";
import type { TextContent, ToolResultMessage } from "@earendil-works/pi-ai/base";
import { FULL_DIFF_HINT, MAX_NUDGES } from "@szczynk/git-tools-core";
import {
  GIT_TOOLS_DIFF_NAME,
  GIT_TOOLS_DIFF_NO_COMPACT_NAME,
  GIT_TOOLS_FORMAT_NAME,
  GIT_TOOLS_FORMAT_PROMPT_RESULT_NOT_CALLED,
} from "./constants.js";

export function registerEvents(pi: ExtensionAPI) {
  let awaitingGitFormatMessage = false;
  let nudgeCount = 0;
  let shouldNudge = false;

  pi.on("turn_start", async (_event: TurnStartEvent, _ctx: ExtensionContext) => {
    if (shouldNudge) {
      pi.sendMessage({
        customType: `${GIT_TOOLS_FORMAT_NAME}_remainder`,
        content: GIT_TOOLS_FORMAT_PROMPT_RESULT_NOT_CALLED,
        display: true,
      });
      shouldNudge = false;
    }
  });

  pi.on("turn_end", async (event: TurnEndEvent, ctx: ExtensionContext) => {
    if (!awaitingGitFormatMessage) return;

    const toolResults = event.toolResults ?? [];

    const calledGitFormatMessage = toolResults.some(
      (r: ToolResultMessage) => r.toolName === GIT_TOOLS_FORMAT_NAME
    );

    if (calledGitFormatMessage) {
      awaitingGitFormatMessage = false;
      nudgeCount = 0;
      shouldNudge = false;
      return;
    }

    const showedFullDiff = toolResults.some((r) => {
      if (r.toolName === GIT_TOOLS_DIFF_NO_COMPACT_NAME) return true;
      if (r.toolName === GIT_TOOLS_DIFF_NAME) {
        const text = (r.content as TextContent[])?.map(c => c.text).join('') ?? '';
        return !text.includes(FULL_DIFF_HINT);
      }
      return false;
    });

    if (!showedFullDiff) {
      return;
    }

    if (nudgeCount < MAX_NUDGES) {
      nudgeCount++;
      shouldNudge = true;
      ctx.ui.notify(`Nudging model to call ${GIT_TOOLS_FORMAT_NAME} after diff`, "warning");
    } else {
      awaitingGitFormatMessage = false;
      shouldNudge = false;
      ctx.ui.notify(
        `Model still hasn't called ${GIT_TOOLS_FORMAT_NAME} after diff after ${MAX_NUDGES} nudges`,
        "error",
      );
    }
  });

  return {
    setAwaitingGitFormatMessage: (v: boolean) => { awaitingGitFormatMessage = v; },
  };
}
