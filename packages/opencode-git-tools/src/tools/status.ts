import { z } from "zod";
import { compactStatus, STAGED_RE } from "@szczynk/git-tools-core";
import type { ToolContext } from "@opencode-ai/plugin";

export const statusArgs = {
  cwd: z.string().optional().describe("Current working directory"),
};

export async function statusExecute(args: { cwd?: string }, ctx: ToolContext): Promise<string> {
  const cwd = args.cwd ?? ctx.directory ?? ".";
  const output = compactStatus([], cwd);

  if (!output || output.includes("clean — nothing to commit")) {
    return "WARNING: clean — nothing to commit.\nSTOP NOW.";
  }

  if (STAGED_RE.test(output)) {
    return (
      "WARNING: Staged changes detected.\n" +
      "STOP. DO NOT CALL git_diff YET.\n" +
      "REQUIRED: CALL git_restore_staged tool now."
    );
  }

  return output + "\n\nREQUIRED:\n2. CALL git_diff to see the code changes.";
}
