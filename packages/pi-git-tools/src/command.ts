import type { ExtensionCommandContext, ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  GIT_TOOLS_COMMAND_NAME,
  GIT_TOOLS_COMMAND_DESCRIPTION,
  GIT_TOOLS_COMMAND_PROMPT,
} from "./constants.js";

export function registerCommand(pi: ExtensionAPI) {
  pi.registerCommand(GIT_TOOLS_COMMAND_NAME, {
    description: GIT_TOOLS_COMMAND_DESCRIPTION,
    handler: async (_args: string, ctx: ExtensionCommandContext) => {
      await ctx.waitForIdle();
      pi.sendUserMessage(GIT_TOOLS_COMMAND_PROMPT);
    },
  });
}
