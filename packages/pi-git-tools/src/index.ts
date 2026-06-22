import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { executeStatus } from "./tools/status.js";
import { executeRestoreStaged } from "./tools/restore-staged.js";
import { executeDiff } from "./tools/diff.js";
import { executeDiffNoCompact } from "./tools/diff-no-compact.js";
import { executeFormat } from "./tools/format.js";
import { registerCommand } from "./command.js";
import { registerEvents } from "./events.js";
import {
  GIT_TOOLS_STATUS_NAME,
  GIT_TOOLS_STATUS_LABEL,
  GIT_TOOLS_STATUS_DESCRIPTION,
  GIT_TOOLS_STATUS_PROMPT_SNIPPET,
  GIT_TOOLS_RESTORE_STAGED_NAME,
  GIT_TOOLS_RESTORE_STAGED_LABEL,
  GIT_TOOLS_RESTORE_STAGED_DESCRIPTION,
  GIT_TOOLS_RESTORE_STAGED_PROMPT_SNIPPET,
  GIT_TOOLS_DIFF_NAME,
  GIT_TOOLS_DIFF_LABEL,
  GIT_TOOLS_DIFF_DESCRIPTION,
  GIT_TOOLS_DIFF_PROMPT_SNIPPET,
  GIT_TOOLS_DIFF_NO_COMPACT_NAME,
  GIT_TOOLS_DIFF_NO_COMPACT_LABEL,
  GIT_TOOLS_DIFF_NO_COMPACT_DESCRIPTION,
  GIT_TOOLS_DIFF_NO_COMPACT_PROMPT_SNIPPET,
  GIT_TOOLS_FORMAT_NAME,
  GIT_TOOLS_FORMAT_LABEL,
  GIT_TOOLS_FORMAT_DESCRIPTION,
  GIT_TOOLS_FORMAT_PROMPT_SNIPPET,
  GIT_TOOLS_PARAMETER_CWD_DESCRIPTION,
  GIT_TOOLS_PARAMETER_ARGS_DESCRIPTION,
} from "./constants.js";

const GitStatusParamsSchema = Type.Object({
  cwd: Type.Optional(Type.String({ description: GIT_TOOLS_PARAMETER_CWD_DESCRIPTION })),
});

const GitDiffParamsSchema = Type.Object({
  cwd: Type.Optional(Type.String({ description: GIT_TOOLS_PARAMETER_CWD_DESCRIPTION })),
  args: Type.Optional(Type.String({ description: GIT_TOOLS_PARAMETER_ARGS_DESCRIPTION })),
});

const GitFormatParamsSchema = Type.Object({
  files: Type.Array(
    Type.Object({
      path: Type.String({ description: "File path relative to repo root. MUST be unique." }),
      summary: Type.String({ description: "5-10 word imperative summary of what changed in this file." }),
    }),
    { minItems: 1, uniqueItems: true, description: "A list of unique file paths affected." }
  ),
  type: Type.Union([
    Type.Literal("feat"), Type.Literal("fix"), Type.Literal("refactor"),
    Type.Literal("perf"), Type.Literal("docs"), Type.Literal("test"),
    Type.Literal("chore"), Type.Literal("build"), Type.Literal("ci"),
    Type.Literal("style"), Type.Literal("revert"),
  ], { description: "Conventional Commit type targeting the primary change." }),
  summary: Type.String({
    description: "Short imperative subject line (no trailing period). Example: 'add OAuth2 login support'",
  }),
  scope: Type.Optional(Type.String({ description: "Optional scope in parentheses, e.g. 'auth', 'api', 'ui'" })),
  body: Type.Array(Type.String(), {
    minItems: 1,
    description: "Additional detail lines. Each string becomes one bullet in the body.",
  }),
  breaking: Type.Optional(Type.Boolean({ default: false, description: "Set true when this commit introduces a breaking change." })),
  breaking_description: Type.Optional(Type.String({
    description: "CRITICAL: Must be provided if breaking is set to true.",
  })),
});

export default function (pi: ExtensionAPI) {
  registerCommand(pi);
  const events = registerEvents(pi);

  pi.registerTool({
    name: GIT_TOOLS_STATUS_NAME,
    label: GIT_TOOLS_STATUS_LABEL,
    description: GIT_TOOLS_STATUS_DESCRIPTION,
    promptSnippet: GIT_TOOLS_STATUS_PROMPT_SNIPPET,
    parameters: GitStatusParamsSchema,
    execute: executeStatus,
  });

  pi.registerTool({
    name: GIT_TOOLS_RESTORE_STAGED_NAME,
    label: GIT_TOOLS_RESTORE_STAGED_LABEL,
    description: GIT_TOOLS_RESTORE_STAGED_DESCRIPTION,
    promptSnippet: GIT_TOOLS_RESTORE_STAGED_PROMPT_SNIPPET,
    parameters: GitStatusParamsSchema,
    execute: executeRestoreStaged,
  });

  pi.registerTool({
    name: GIT_TOOLS_DIFF_NAME,
    label: GIT_TOOLS_DIFF_LABEL,
    description: GIT_TOOLS_DIFF_DESCRIPTION,
    promptSnippet: GIT_TOOLS_DIFF_PROMPT_SNIPPET,
    parameters: GitDiffParamsSchema,
    async execute(toolCallId: string, params: any) {
      const result = await executeDiff(toolCallId, params);
      events.setAwaitingGitFormatMessage(result.content[0]?.type === "text" && !result.content[0].text.includes("BLOCKED") && !result.content[0].text.includes("WARNING"));
      return result;
    },
  });

  pi.registerTool({
    name: GIT_TOOLS_DIFF_NO_COMPACT_NAME,
    label: GIT_TOOLS_DIFF_NO_COMPACT_LABEL,
    description: GIT_TOOLS_DIFF_NO_COMPACT_DESCRIPTION,
    promptSnippet: GIT_TOOLS_DIFF_NO_COMPACT_PROMPT_SNIPPET,
    parameters: GitDiffParamsSchema,
    async execute(toolCallId: string, params: any) {
      const result = await executeDiffNoCompact(toolCallId, params);
      events.setAwaitingGitFormatMessage(true);
      return result;
    },
  });

  pi.registerTool({
    name: GIT_TOOLS_FORMAT_NAME,
    label: GIT_TOOLS_FORMAT_LABEL,
    description: GIT_TOOLS_FORMAT_DESCRIPTION,
    promptSnippet: GIT_TOOLS_FORMAT_PROMPT_SNIPPET,
    parameters: GitFormatParamsSchema,
    async execute(toolCallId: string, params: any) {
      const result = await executeFormat(toolCallId, params);
      events.setAwaitingGitFormatMessage(false);
      return result;
    },
  });
}
