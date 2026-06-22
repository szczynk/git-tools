import { z } from "zod";
import { compactDiff } from "@szczynk/git-tools-core";
import type { ToolContext } from "@opencode-ai/plugin";

export const diffNoCompactArgs = {
  cwd: z.string().optional().describe("Current working directory"),
  args: z.string().optional().describe("Extra arguments forwarded verbatim to git diff"),
};

export async function diffNoCompactExecute(args: { cwd?: string; args?: string }, ctx: ToolContext): Promise<string> {
  const cwd = args.cwd ?? ctx.directory ?? ".";
  const extra = (args.args ?? "").trim();
  const extraArgs = extra ? extra.split(/\s+/) : [];

  const output = compactDiff(extraArgs, -1, -1, cwd);

  if (!output) {
    return "WARNING: clean — nothing to commit.\nSTOP NOW.";
  }

  return (
    output +
    "\n\nREQUIRED:\n3. Analyze the diff to understand the changes and draft a commit message.\n" +
    "4. CALL TOOL: git_format_message with your draft message to get the final formatted Conventional Commit message."
  );
}
