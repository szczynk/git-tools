# git-tools monorepo

Multi-platform git tooling for coding agents and editors.

## Packages

| Package                       | Platform             | Published |
| ----------------------------- | -------------------- | --------- |
| `@szczynk/git-tools-core`     | Core logic (private) | —         |
| `@szczynk/opencode-git-tools` | OpenCode plugin      | npm       |
| `@szczynk/pi-git-tools`       | PI agent extension   | npm       |
| `@szczynk/vsce-git-tools`     | VS Code extension    | VS Code   |

## Tools

All adapters expose the same 5-tool surface:

- `git_status` — compact status with staged-changes guard
- `git_restore_staged` — unstage all changes
- `git_diff` — compact diff (500 line cap, 100 line per-hunk), escalates to no-compact
- `git_diff_no_compact` — full diff (no truncation)
- `git_format_message` — assemble + validate Conventional Commit message

## Usage

### @szczynk/opencode-git-tools

**Install:**

```jsonc
// opencode.json
{
  "plugin": ["@szczynk/opencode-git-tools"]
}
```

This registers all 5 tools in OpenCode. You can then call them directly via `/` commands or use a custom command for a guided commit workflow.

**Custom `/git-tools` command (recommended):**

```jsonc
// opencode.json
{
  "plugin": ["@szczynk/opencode-git-tools"],
  "command": {
    "git-tools": {
      "description": "Guide through git commit workflow: status → diff → format message",
      "template": "# Git Commit Assistant\n\n## Tools Workflow\n\n1. CALL `git_status` to see changed files.\n   If output contains \"WARNING: Staged changes detected\":\n      - 1a. CALL TOOL: `git_restore_staged` (no arguments)\n      - 1b. CALL TOOL: `git_status` again to confirm clean index\n      - 1c. Only then proceed to step 2\n2. CALL `git_diff` to see the code changes.\n   *Note: The diff output provided is complete. Do not use bash tools to read external log files.*\n3. Analyze the diff to understand the changes and draft a commit message.\n4. CALL TOOL: `git_format_message` with your draft message to get the final formatted Conventional Commit message.\n\n## CRITICAL: Final Output Rule\n\nAfter calling `git_format_message`, the tool will return the final, perfectly formatted commit message.\n**DO NOT output any text after the tool result.**\nDo not repeat the message. Do not add introductory or concluding remarks. The tool's output is the final answer and the task is complete.",
      "agent": "plan"
    }
  }
}
```

Then use `/git-tools` in any conversation to run through the full commit workflow.

### @szczynk/pi-git-tools

See [PI documentation](https://docs.pi.ai) for agent plugin setup.

### @szczynk/vsce-git-tools

VS Code extension that exposes git tools as **language model tools** (`vscode.lm`) and a one-click **SCM button** for AI-powered commit workflows.

**Requires:** VS Code 1.96+ and a language model provider (GitHub Copilot, local via Continue/Ollama, etc.).

**SCM button:** A single "AI Commit" (`$(wand)`) button in the source control title bar.

When clicked, it:

1. Launches the AI commit assistant via the built-in LM provider or any configured `vscode.lm` model
2. The AI calls git tools (status → restore if staged → diff → format message)
3. The final Conventional Commit message is placed in the SCM input box

**Multi-repo workspaces:** If no file is open in the active editor, a QuickPick appears to select which repository to commit to.

**Command palette:** 6 commands available:

- `Git Tools: AI Commit` — full workflow (also in SCM title)
- `Git Tools: Status` — show compact status
- `Git Tools: Restore Staged` — unstage all changes
- `Git Tools: Diff` — show compact diff
- `Git Tools: Diff (No Compact)` — show full diff
- `Git Tools: Format Commit Message` — assemble commit message

**Registered LM tools** (available to Copilot Chat and other `vscode.lm` consumers):

- `git_tools_git_status`
- `git_tools_git_restore_staged`
- `git_tools_git_diff`
- `git_tools_git_diff_no_compact`
- `git_tools_git_format_message`

**Built-in LM provider:** The extension includes a "Git Tools Local LLM" provider for OpenAI-compatible APIs (llama.cpp, Ollama, any OpenAI-compatible endpoint). Configuration via:

- **Activity Bar sidebar** — llama icon in the activity bar → LLM Configuration view (Base URL, API Key, Model)
- **VS Code Settings** — `git-tools.baseUrl`, `git-tools.apiKey`, `git-tools.model`
- Auto-detects available models from `{baseUrl}/models` endpoint

No GitHub Copilot required — works with local models that support tool/function calling.

Install from [VS Code Marketplace](https://marketplace.visualstudio.com/).
