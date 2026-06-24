# git-tools monorepo

## Structure

npm workspaces (`packages/*`). 4 packages:

| Package | Builder | Platform |
|---------|---------|----------|
| `@szczynk/git-tools-core` | `tsc` | Private core |
| `@szczynk/opencode-git-tools` | `tsup` | npm (OpenCode plugin) |
| `@szczynk/pi-git-tools` | `tsup` | npm (PI agent extension) |
| `@szczynk/vsce-git-tools` | `tsup` | VS Code marketplace |

Adapters depend on core as both tsconfig project reference and devDependency. Core is **bundled into adapters** at build time via `noExternal: ["@szczynk/git-tools-core"]` in tsup configs. Not a runtime dep of published adapters.

DTS generation is disabled in all adapter tsup configs (composite project conflict).

## Build

- `npm run build` — builds all workspaces (core first via `--if-present`)
- Per-package: `npm run build -w @szczynk/git-tools-<name>`
- `prepack` runs build automatically

## Lint / Typecheck

- No root lint script
- `npm run build` type-checks core (tsc), adapters run tsc via tsup (no emit for type errors)
- vsce-git-tools has `npm run lint` (`tsc --noEmit`) — use for fast type-check on that package

## Test

```
npm test              # vitest run (all)
npm run test:unit     # vitest run --exclude '**/e2e.test.ts'
npm run test:e2e      # vitest run e2e.test
npm run test:watch    # vitest interactive
```

Only core has tests (`packages/*/src/__test__/*.test.ts`). No CI configured.

## Stack

- TypeScript 6, NodeNext module/resolution, ESM (`"type": "module"`)
- Composite project references, `tsconfig.base.json` shared config, `@types/node`
- `tsup` for adapter bundles (per-package `tsup.config.ts`), `tsc` for core
- Vitest 4
- Node >= 22

## Core package (`@szczynk/git-tools-core`)

Pure git logic. Entry: `src/index.ts`. Exports:

- `gitSync` — raw git command runner
- `compactStatus`, `hasStagedChanges`, `compactDiff`, `compactDiffText` — compact output parsers
- `formatCommitMessage` — Conventional Commit assembler
- Constants: `STAGED_RE`, `FULL_DIFF_HINT`, `COMMIT_TYPES` (11 types), `FAILED_ERROR_MESSAGE`, `MAX_NUDGES`

## Adapter packages

All 3 share the same 5-tool surface (tool names prefixed `git_tools_`):
- `git_status` — compact status with staged-changes guard
- `git_restore_staged` — unstage all
- `git_diff` — compact diff (500 line cap, 100 line per-hunk), escalates to no-compact hint
- `git_diff_no_compact` — full diff (no truncation)
- `git_format_message` — assemble + validate Conventional Commit message

Schema: PI uses `typebox`, OpenCode uses `zod`, VSCE uses `vscode.git` API with `type` from `package.json` contribution point.

### vsce-git-tools quirks

Most complex adapter. Source (5 files in `src/`):

| File | Role |
|------|------|
| `extension.ts` | Activation, LM tool registration, SCM button workflow |
| `llm-service.ts` | OpenAI-compatible HTTP client (`http`/`https` modules, not `fetch`) |
| `llm-provider.ts` | LM chat provider (`git-tools-llama` vendor) |
| `llm-config-view.ts` | Sidebar webview configuration UI |
| `git.ts` | `vscode.git` API type definitions |

Key facts:
- Entry: `src/extension.ts` (NOT `src/index.ts`)
- `extensionDependencies: ["vscode.git"]` in package.json
- Activation: `onStartupFinished` + `onLanguageModelChatProvider:git-tools-llama`
- Sidebar webview uses `retainContextWhenHidden: true`
- 3 package.json files managed by `npm run package`: `package.vscode.json` for `vsce package`, `package.npm.json` for npm restore, `package.json` for dev. Script: `cp package.vscode.json package.json && vsce package && cp package.npm.json package.json`
- `streamChat()` uses Node.js `http`/`https` modules (not `fetch`) to avoid undici 5-min body timeout
- Tool call accumulation during streaming: keyed by `index`, args concatenated via `+=`
- `cwd` from tool call input is IGNORED in the commit workflow — always uses `repo.rootUri.fsPath`
- `getRepo()` resolves repo by: active editor path match → single repo use → QuickPick for multi-repo
- The SCM wand button triggers a direct LLM tool-calling loop (bypasses `vscode.lm.sendRequest`)

### README

Generated from root `README.md` into each package at build time (`cp ../../README.md`). Do not write per-package READMEs.

## Release

Uses `@changesets/cli`:
```
npm run changeset        # add a changeset
npm run version-packages # apply changesets + bump versions
npm run release          # publish
```
