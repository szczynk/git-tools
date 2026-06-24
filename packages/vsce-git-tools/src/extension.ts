import * as vscode from "vscode";
import type { GitExtension, Repository } from "./git.js";
import {
  compactStatus, compactDiff, hasStagedChanges, formatCommitMessage, gitSync,
  STAGED_RE, FULL_DIFF_HINT, FAILED_ERROR_MESSAGE,
  type FormatMessageParams,
} from "@szczynk/git-tools-core";
import { LlamaProvider, getConfig } from "./llm-provider.js";
import { LlamaConfigViewProvider } from "./llm-config-view.js";
import { streamChat } from "./llm-service.js";
import type { ChatMsg, ToolCallChunk } from "./llm-service.js";
import path from "path";

const P = "git_tools_";
const TOOL_STATUS = `${P}git_status`;
const TOOL_RESTORE = `${P}git_restore_staged`;
const TOOL_DIFF = `${P}git_diff`;
const TOOL_DIFF_NC = `${P}git_diff_no_compact`;
const TOOL_FORMAT = `${P}git_format_message`;

const CMD_PROMPT =
  "# Git Commit Assistant\n\n" +
  "## Tools Workflow\n\n" +
  "1. CALL `" + TOOL_STATUS + "` to see changed files.\n" +
  "   If output contains \"WARNING: Staged changes detected\":\n" +
  `      - 1a. CALL TOOL: \`${TOOL_RESTORE}\` (no arguments)\n` +
  `      - 1b. CALL TOOL: \`${TOOL_STATUS}\` again to confirm clean index\n` +
  `      - 1c. Only then proceed to step 2\n` +
  `2. CALL \`${TOOL_DIFF}\` to see the code changes.\n` +
  "   *Note: The diff output provided is complete. Do not use bash tools to read external log files.*\n" +
  "3. Analyze the diff to understand the changes and draft a commit message.\n" +
  `4. CALL TOOL: \`${TOOL_FORMAT}\` with your draft message to get the final formatted Conventional Commit message.` +
  "\n\n## CRITICAL: Final Output Rule\n\n" +
  `After calling \`${TOOL_FORMAT}\`, the tool will return the final, perfectly formatted commit message.\n` +
  "**DO NOT output any text after the tool result.**\n" +
  "Do not repeat the message. Do not add introductory or concluding remarks. The tool's output is the final answer and the task is complete.";

const TOOL_DESCRIPTIONS: Record<string, string> = {
  [TOOL_STATUS]:
    "Show compact git status (porcelain format with branch info). " +
    "If staged changes are present, call " + TOOL_RESTORE + " to unstage them.",
  [TOOL_RESTORE]: "Unstage all staged changes.",
  [TOOL_DIFF]:
    "Show compact git diff with stat summary (500 line cap, 100 lines per hunk). " +
    "If the result contains `[full diff:` hint, call " + TOOL_DIFF_NC + ".",
  [TOOL_DIFF_NC]: "Show full git diff (no truncation).",
  [TOOL_FORMAT]:
    "Assemble and validate a Conventional Commit message from structured fields. " +
    "Call this after analyzing the diff.",
};

const TOOL_SCHEMAS: Record<string, object> = {
  [TOOL_STATUS]: {
    type: "object",
    properties: {
      cwd: { type: "string", description: "Current working directory" },
    },
  },
  [TOOL_RESTORE]: {
    type: "object",
    properties: {
      cwd: { type: "string", description: "Current working directory" },
    },
  },
  [TOOL_DIFF]: {
    type: "object",
    properties: {
      cwd: { type: "string", description: "Current working directory" },
      args: { type: "string", description: "Extra arguments forwarded verbatim to git diff" },
    },
  },
  [TOOL_DIFF_NC]: {
    type: "object",
    properties: {
      cwd: { type: "string", description: "Current working directory" },
      args: { type: "string", description: "Extra arguments forwarded verbatim to git diff" },
    },
  },
  [TOOL_FORMAT]: {
    type: "object",
    properties: {
      files: {
        type: "array",
        items: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path relative to repo root. MUST be unique." },
            summary: { type: "string", description: "5-10 word imperative summary of what changed." },
          },
          required: ["path", "summary"],
        },
        minItems: 1,
        description: "List of unique file paths affected.",
      },
      type: {
        type: "string",
        enum: ["feat", "fix", "refactor", "perf", "docs", "test", "chore", "build", "ci", "style", "revert"],
        description: "Conventional Commit type.",
      },
      summary: { type: "string", description: "Short imperative subject line (no trailing period)." },
      scope: { type: "string", description: "Optional scope in parentheses." },
      body: { type: "array", items: { type: "string" }, description: "Additional detail lines (one per bullet)." },
      breaking: { type: "boolean", default: false, description: "Set true for breaking changes." },
      breaking_description: { type: "string", description: "Required if breaking is true." },
    },
    required: ["files", "type", "summary", "body"],
  },
};

let _channel: vscode.OutputChannel;
function channel(): vscode.OutputChannel {
  if (!_channel) _channel = vscode.window.createOutputChannel("Git Tools");
  return _channel;
}

async function getRepo(): Promise<Repository | undefined> {
  const ext = vscode.extensions.getExtension<GitExtension>("vscode.git")?.exports;
  if (!ext?.getAPI) return;
  const api = ext.getAPI(1);
  const log = channel();

  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri) {
    for (const r of api.repositories) {
      if (activeUri.fsPath.startsWith(r.rootUri.fsPath + "/")) {
        log.appendLine(`[getRepo] matched via editor: ${r.rootUri.fsPath}`);
        return r;
      }
    }
    log.appendLine(`[getRepo] active editor not in any repo`);
  }

  if (api.repositories.length === 1) {
    log.appendLine(`[getRepo] single repo: ${api.repositories[0].rootUri.fsPath}`);
    return api.repositories[0];
  }

  const picks = api.repositories.map(r => ({
    label: path.basename(r.rootUri.fsPath),
    description: r.rootUri.fsPath,
    repo: r,
  }));
  const chosen = await vscode.window.showQuickPick(picks, {
    placeHolder: "Select repo for AI commit",
  });
  if (chosen) {
    log.appendLine(`[getRepo] user picked: ${chosen.description}`);
    return chosen.repo;
  }
  return;
}

// ── Tool implementations ────────────────────────────────────────────

function execStatus(cwd?: string): string {
  const dir = cwd ?? ".";
  const out = compactStatus([], dir);
  if (out.startsWith("git_status") && out.includes(FAILED_ERROR_MESSAGE)) {
    return `${TOOL_STATUS} ${FAILED_ERROR_MESSAGE} ${out}`;
  }
  if (!out || out.includes("clean — nothing to commit")) {
    return "WARNING: clean — nothing to commit.\nSTOP NOW.";
  }
  if (STAGED_RE.test(out)) {
    return "WARNING: Staged changes detected.\nSTOP. DO NOT CALL " + TOOL_DIFF + " YET.\nREQUIRED: CALL " + TOOL_RESTORE + " now.";
  }
  return out + "\n\n\nREQUIRED:\n2. CALL `" + TOOL_DIFF + "` to see the code changes.";
}

function execRestore(cwd?: string): string {
  const result = gitSync(["restore", "--staged", "."], cwd ?? ".");
  if (result.exitCode !== 0) {
    return `${TOOL_RESTORE} ${FAILED_ERROR_MESSAGE} ${result.stderr || "unknown error"}`;
  }
  return "All staged changes have been unstaged.\nREQUIRED: CALL `" + TOOL_STATUS + "` again to confirm clean index.";
}

function execDiff(cwd?: string, extraArgs?: string): string {
  const dir = cwd ?? ".";
  const args = (extraArgs ?? "").trim().split(/\s+/).filter(Boolean);
  const statusOut = compactStatus([], dir);
  if (STAGED_RE.test(statusOut)) {
    return "BLOCKED: git_diff called while staged changes exist.\nREQUIRED: CALL `" + TOOL_RESTORE + "` first, then retry.";
  }
  const out = compactDiff(args, 500, 100, dir);
  if (out.startsWith("git_diff") && out.includes(FAILED_ERROR_MESSAGE)) {
    return `${TOOL_DIFF} ${FAILED_ERROR_MESSAGE} ${out}`;
  }
  if (!out) {
    return "WARNING: clean — nothing to commit.\nSTOP NOW.";
  }
  if (out.includes(FULL_DIFF_HINT)) {
    return "WARNING: this diff truncated.\nREQUIRED: CALL `" + TOOL_DIFF_NC + "` now to retrieve the complete diff.";
  }
  return out + "\n\n\nREQUIRED:\n3. Analyze the diff to understand changes and draft a commit message.\n4. CALL TOOL: `" + TOOL_FORMAT + "` with your draft.";
}

function execDiffNC(cwd?: string, extraArgs?: string): string {
  const dir = cwd ?? ".";
  const args = (extraArgs ?? "").trim().split(/\s+/).filter(Boolean);
  const out = compactDiff(args, -1, -1, dir);
  if (out.startsWith("git_diff") && out.includes(FAILED_ERROR_MESSAGE)) {
    return `${TOOL_DIFF_NC} ${FAILED_ERROR_MESSAGE} ${out}`;
  }
  return out + "\n\n\nREQUIRED:\n3. Analyze the diff...\n4. CALL TOOL: `" + TOOL_FORMAT + "` with your draft.";
}

function execFormat(params: FormatMessageParams): string {
  const result = formatCommitMessage(params);
  if (!result.ok) {
    return `${TOOL_FORMAT} error: ${result.error}`;
  }
  const FILE_LIST_HEADER = "Files changed:\n\n";
  const READY_SUFFIX = "\n\n\nReady to copy-paste:\n\n";
  return FILE_LIST_HEADER + result.fileList + READY_SUFFIX + result.message +
    "\n\n## CRITICAL: Final Output Rule\n\n" +
    "**DO NOT output any text after the tool result.**\n" +
    "Do not add introductory or concluding remarks. The tool's output is the final answer.";
}

// ── LM tool providers ────────────────────────────────────────────────

class StatusTool implements vscode.LanguageModelTool<{ cwd?: string }> {
  async invoke(opt: vscode.LanguageModelToolInvocationOptions<{ cwd?: string }>): Promise<vscode.LanguageModelToolResult> {
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(execStatus(opt.input.cwd))]);
  }
}
class RestoreTool implements vscode.LanguageModelTool<{ cwd?: string }> {
  async invoke(opt: vscode.LanguageModelToolInvocationOptions<{ cwd?: string }>): Promise<vscode.LanguageModelToolResult> {
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(execRestore(opt.input.cwd))]);
  }
}
class DiffTool implements vscode.LanguageModelTool<{ cwd?: string; args?: string }> {
  async invoke(opt: vscode.LanguageModelToolInvocationOptions<{ cwd?: string; args?: string }>): Promise<vscode.LanguageModelToolResult> {
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(execDiff(opt.input.cwd, opt.input.args))]);
  }
}
class DiffNCTool implements vscode.LanguageModelTool<{ cwd?: string; args?: string }> {
  async invoke(opt: vscode.LanguageModelToolInvocationOptions<{ cwd?: string; args?: string }>): Promise<vscode.LanguageModelToolResult> {
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(execDiffNC(opt.input.cwd, opt.input.args))]);
  }
}
class FormatTool implements vscode.LanguageModelTool<FormatMessageParams> {
  async invoke(opt: vscode.LanguageModelToolInvocationOptions<FormatMessageParams>): Promise<vscode.LanguageModelToolResult> {
    return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(execFormat(opt.input))]);
  }
}

// ── SCM commit workflow ──────────────────────────────────────────────

async function handleCommit() {
  const repo = await getRepo();
  if (!repo) {
    void vscode.window.showErrorMessage("No git repository found");
    return;
  }

  const cfg = getConfig();
  if (!cfg) {
    void vscode.window.showErrorMessage("Git Tools LLM not configured. Set base URL and model in the Git Tools LLM sidebar.");
    return;
  }

  const ac = new AbortController();

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Git Tools: Running commit workflow...",
    cancellable: true,
  }, async (progress, token) => {
    token.onCancellationRequested(() => ac.abort());

    const log = channel();
    log.show();
    log.appendLine("── Git Commit Workflow ──");
    log.appendLine(`[model] ${cfg.model}`);

    const tools = Object.entries(TOOL_DESCRIPTIONS).map(([name, description]) => ({
      type: "function" as const,
      function: {
        name,
        description,
        parameters: TOOL_SCHEMAS[name] as Record<string, unknown>,
      },
    }));

    let msgs: ChatMsg[] = [
      { role: "system", content: CMD_PROMPT },
      { role: "user", content: "Run the git commit workflow for this repository." },
    ];

    let commitMessage = "";
    let formatResultCaptured = "";
    let round = 0;
    const MAX_ROUNDS = 8;

    while (round < MAX_ROUNDS && !ac.signal.aborted) {
      round++;
      progress.report({ message: `Round ${round}/${MAX_ROUNDS}...` });

      let text = "";
      let pendingToolCalls = new Map<number, ToolCallChunk>();

      try {
        const stream = streamChat(cfg, {
          messages: msgs,
          tools,
          stream: true,
          signal: ac.signal,
        });

        for await (const chunk of stream) {
          if (ac.signal.aborted) break;

          if (chunk.type === "text") {
            text += chunk.text;
          } else if (chunk.type === "tool_call" && chunk.toolCall) {
            const idx = chunk.toolCall.index;
            const existing = pendingToolCalls.get(idx);
            if (existing) {
              if (chunk.toolCall.name) existing.name = chunk.toolCall.name;
              if (chunk.toolCall.args) existing.args += chunk.toolCall.args;
              if (chunk.toolCall.id) existing.id = chunk.toolCall.id;
            } else {
              pendingToolCalls.set(idx, { ...chunk.toolCall });
            }
          }
        }
      } catch (e) {
        if (ac.signal.aborted) {
          log.appendLine("Workflow cancelled");
          return;
        }
        log.appendLine(`LM request failed: ${e}`);
        break;
      }

      if (ac.signal.aborted) {
        log.appendLine("Workflow cancelled");
        return;
      }

      const toolCalls = Array.from(pendingToolCalls.values());
      log.appendLine(`[round ${round}] text length: ${text.length}, tool calls: ${toolCalls.length}`);
      if (text) log.appendLine(text);

      if (toolCalls.length === 0) {
        commitMessage = text;
        break;
      }

      // Build assistant message
      const asst: ChatMsg = { role: "assistant", content: text || null };
      asst.tool_calls = toolCalls.map(tc => ({
        id: tc.id,
        type: "function" as const,
        function: { name: tc.name, arguments: tc.args },
      }));
      msgs.push(asst);

      // Dispatch tool calls
      const repoPath = repo.rootUri.fsPath;
      const results: ChatMsg[] = [];
      for (const tc of toolCalls) {
        log.appendLine(`→ tool call: ${tc.name}`);
        let input: Record<string, unknown>;
        try { input = JSON.parse(tc.args); } catch { input = {}; }
        let textContent: string;
        switch (tc.name) {
          case TOOL_STATUS:
            textContent = execStatus(repoPath);
            break;
          case TOOL_RESTORE:
            textContent = execRestore(repoPath);
            break;
          case TOOL_DIFF:
            textContent = execDiff(repoPath, input.args as string);
            break;
          case TOOL_DIFF_NC:
            textContent = execDiffNC(repoPath, input.args as string);
            break;
          case TOOL_FORMAT:
            textContent = execFormat(input as unknown as FormatMessageParams);
            break;
          default:
            textContent = `Error: unknown tool ${tc.name}`;
        }
        log.appendLine(`← result: \n${textContent.slice(0, 200)}${textContent.length > 200 ? "..." : ""}\n`);

        if (tc.name === TOOL_FORMAT) {
          const match = textContent.match(/Ready to copy-paste:\n\n([\s\S]*)/);
          if (match) formatResultCaptured = match[1].trim();
          else formatResultCaptured = textContent;
          const stopIdx = formatResultCaptured.indexOf("## CRITICAL: Final Output Rule");
          if (stopIdx !== -1) formatResultCaptured = formatResultCaptured.slice(0, stopIdx).trim();
        }

        results.push({ role: "tool", content: textContent, tool_call_id: tc.id } as ChatMsg);
      }
      msgs.push(...results);
    }

    if (ac.signal.aborted) {
      return;
    }

    const finalMsg = formatResultCaptured || commitMessage;
    if (finalMsg) {
      repo.inputBox.value = finalMsg;
      log.appendLine(`\n\n\nfinalMessage:\n\n${finalMsg}\n`);
      log.appendLine("── Commit message set in SCM input box ──");
      void vscode.window.showInformationMessage("Commit message generated!");
    } else {
      log.appendLine("── No commit message generated ──");
      log.appendLine(`commitMessage: ${commitMessage ? "(non-empty)" : "(empty)"}`);
      log.appendLine(`formatResultCaptured: ${formatResultCaptured ? "(non-empty)" : "(empty)"}`);
      void vscode.window.showWarningMessage("Failed to generate a commit message. Check the LLM configuration in the Git Tools sidebar and ensure the model returns valid tool calls.");
    }
  });
}

// ── Manual commands (command palette only) ────────────────────────────

function registerManualCommands(ctx: vscode.ExtensionContext) {
  ctx.subscriptions.push(
    vscode.commands.registerCommand("git-tools.status", () => {
      const out = execStatus();
      channel().show();
      channel().appendLine(out);
    }),
    vscode.commands.registerCommand("git-tools.restoreStaged", () => {
      const out = execRestore();
      channel().show();
      channel().appendLine(out);
    }),
    vscode.commands.registerCommand("git-tools.diff", () => {
      const out = execDiff();
      channel().show();
      channel().appendLine(out);
    }),
    vscode.commands.registerCommand("git-tools.diffNoCompact", () => {
      const out = execDiffNC();
      channel().show();
      channel().appendLine(out);
    }),
    vscode.commands.registerCommand("git-tools.formatMessage", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) return;
      const params: FormatMessageParams = {
        files: [],
        type: "chore",
        summary: "",
        body: [],
      };
      const out = execFormat(params);
      channel().show();
      channel().appendLine(out);
    }),
  );
}

// ── Activation ──────────────────────────────────────────────────────

export function activate(ctx: vscode.ExtensionContext) {
  channel().appendLine("git-tools activated");

  // Register LM tools
  ctx.subscriptions.push(
    vscode.lm.registerTool(TOOL_STATUS, new StatusTool()),
    vscode.lm.registerTool(TOOL_RESTORE, new RestoreTool()),
    vscode.lm.registerTool(TOOL_DIFF, new DiffTool()),
    vscode.lm.registerTool(TOOL_DIFF_NC, new DiffNCTool()),
    vscode.lm.registerTool(TOOL_FORMAT, new FormatTool()),
  );

  // Register local LLM provider (llama.cpp / Ollama / OpenAI-compatible)
  ctx.subscriptions.push(
    vscode.lm.registerLanguageModelChatProvider("git-tools-llama", new LlamaProvider()),
  );

  // Register sidebar config view
  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      LlamaConfigViewProvider.viewType,
      new LlamaConfigViewProvider(ctx),
      { webviewOptions: { retainContextWhenHidden: true } }
    ),
  );

  ctx.subscriptions.push(
    vscode.commands.registerCommand("git-tools.commit", handleCommit),
  );

  registerManualCommands(ctx);
}

export function deactivate() {}
