import { z } from "zod";
import { compactStatus, compactDiff, STAGED_RE, FULL_DIFF_HINT } from "@szczynk/git-tools-core";
import type { ToolContext } from "@opencode-ai/plugin";

export const diffArgs = {
  cwd: z.string().optional().describe("Current working directory"),
  args: z.string().optional().describe("Extra arguments forwarded verbatim to git diff"),
};

export async function diffExecute(args: { cwd?: string; args?: string }, ctx: ToolContext): Promise<string> {
  const cwd = args.cwd ?? ctx.directory ?? ".";
  const extra = (args.args ?? "").trim();
  const extraArgs = extra ? extra.split(/\s+/) : [];

  const statusOut = compactStatus([], cwd);
  if (STAGED_RE.test(statusOut)) {
    return "BLOCKED: git_diff called while staged changes exist.\nREQUIRED: CALL git_restore_staged first, then retry.";
  }

  const output = compactDiff(extraArgs, 500, 100, cwd);

  if (!output) {
    return "WARNING: clean — nothing to commit.\nSTOP NOW.";
  }

  if (output.includes(FULL_DIFF_HINT)) {
    return "WARNING: this diff truncated.\nREQUIRED: CALL git_diff_no_compact now to retrieve the complete diff.";
  }

  return (
    output +
    "\n\nREQUIRED:\n3. Analyze the diff to understand the changes and draft a commit message.\n" +
    "4. CALL TOOL: git_format_message with your draft message to get the final formatted Conventional Commit message."
  );
}
