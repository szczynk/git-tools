# Migration Plan: Single PI Extension → 4-Package Monorepo

## Goal

Split existing `git-tools.ts` PI extension into harness-agnostic core + 3 platform adapters.

## Architecture

```
packages/
  core/                  # Pure git logic, no harness dependency
    src/
      index.ts           # Re-exports
      git.ts             # gitSync()
      status.ts          # compactStatus() + helpers
      diff.ts            # compactDiff() + compactDiffText()
      format.ts          # formatCommitMessage() — validate + assemble
      constants.ts       # COMMIT_TYPES, STAGED_RE, FULL_DIFF_HINT, etc.
      types.ts           # Shared interfaces

  pi-git-tools/          # PI-coding-agent adapter (existing code → refactored)
    src/
      index.ts           # default export — registers tools + command + events
      constants.ts       # PI-specific prompts, tool names, descriptions
      tools/*.ts         # 5 tool handlers (import core logic)

  opencode-git-tools/    # OpenCode plugin adapter (new)
    src/
      index.ts           # Plugin export
      constants.ts       # OpenCode-specific prompts
      tools/*.ts         # 5 tool handlers

  vsce-git-tools/        # VS Code extension adapter (new)
    src/
      extension.ts       # activate/deactivate
      commands/*.ts      # 5 commands
```

## Steps

### Step 1: Core
- Extract `gitSync`, `compactStatus`, `compactDiff`, `compactDiffText`, `formatCommitMessage`, constants, types
- Pure functions only — no harness imports, no side effects beyond `spawnSync`
- Re-export everything from `index.ts`

### Step 2: PI Adapter (refactor)
- Import core functions instead of local definitions
- Keep all PI-specific prompt strings, tool registration, command, events
- Split single file into modules by concern

### Step 3: OpenCode Adapter (new)
- Same 5-tool surface area using `@opencode-ai/plugin` API
- Import core logic
- Appropriate prompt strings for OpenCode workflow

### Step 4: VSCode Adapter (new)
- Same 5 operations as VS Code commands using `vscode.git` API
- Import core logic
- Proper `package.json` extension manifest

## Build Order

Core → (pi, opencode, vsce) in parallel. `npm run build` already handles this via `core` first, then `--workspaces --if-present`.

## Verification

```
npm run build
npm test
```
