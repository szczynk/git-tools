import { z } from "zod";
import { formatCommitMessage, COMMIT_TYPES } from "@szczynk/git-tools-core";
import type { ToolContext } from "@opencode-ai/plugin";

const commitTypes = [...COMMIT_TYPES] as const;
type CommitType = typeof commitTypes[number];

interface FormatArgs {
  files: Array<{ path: string; summary: string }>;
  type: CommitType;
  summary: string;
  scope?: string;
  body: string[];
  breaking?: boolean;
  breaking_description?: string;
}

export const formatArgs = {
  files: z.array(z.object({
    path: z.string().describe("File path relative to repo root. MUST be unique."),
    summary: z.string().describe("5-10 word imperative summary of what changed in this file."),
  })).min(1).describe("A list of unique file paths affected."),
  type: z.enum(commitTypes).describe("Conventional Commit type targeting the primary change."),
  summary: z.string().describe("Short imperative subject line (no trailing period). Example: 'add OAuth2 login support'"),
  scope: z.string().optional().describe("Optional scope in parentheses, e.g. 'auth', 'api', 'ui'"),
  body: z.array(z.string()).min(1).describe("Additional detail lines. Each string becomes one bullet in the body."),
  breaking: z.boolean().optional().default(false).describe("Set true when this commit introduces a breaking change."),
  breaking_description: z.string().optional().describe("CRITICAL: Must be provided if breaking is set to true."),
};

export async function formatExecute(args: FormatArgs, _ctx: ToolContext): Promise<string> {
  const result = formatCommitMessage({
    files: args.files,
    type: args.type,
    summary: args.summary,
    scope: args.scope,
    body: args.body,
    breaking: args.breaking,
    breaking_description: args.breaking_description,
  });

  if (!result.ok) {
    return `git_format_message error: ${result.error}`;
  }

  return (
    `Files changed:\n\n${result.fileList}` +
    `\n\n\nReady to copy-paste:\n\n${result.message}` +
    "\n\n## CRITICAL: Final Output Rule\n\n" +
    "After calling git_format_message, the tool will return the final, perfectly formatted commit message.\n" +
    "**DO NOT output any text after the tool result.**\n" +
    "Do not repeat the message. Do not add introductory or concluding remarks. The tool's output is the final answer and the task is complete."
  );
}
