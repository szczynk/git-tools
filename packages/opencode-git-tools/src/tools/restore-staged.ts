import { z } from "zod";
import { gitSync } from "@szczynk/git-tools-core";
import type { ToolContext } from "@opencode-ai/plugin";

export const restoreStagedArgs = {
  cwd: z.string().optional().describe("Current working directory"),
};

export async function restoreStagedExecute(args: { cwd?: string }, ctx: ToolContext): Promise<string> {
  const cwd = args.cwd ?? ctx.directory ?? ".";
  const result = gitSync(["restore", "--staged", "."], cwd);

  if (result.exitCode !== 0) {
    return `git_restore_staged failed: ${result.stderr || "unknown error"}`;
  }

  return "All staged changes have been unstaged.\nREQUIRED: CALL git_status again to confirm clean index.";
}
