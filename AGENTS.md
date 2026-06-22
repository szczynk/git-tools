# git-tools monorepo

## Structure

npm workspaces monorepo (`packages/*`). 4 packages:

| Package | Builder | Published | Target |
|---------|---------|-----------|--------|
| `@szczynk/git-tools-core` | `tsc` | private | Core logic |
| `@szczynk/opencode-git-tools` | `tsup` | npm | OpenCode plugin |
| `@szczynk/pi-git-tools` | `tsup` | npm | Coding agent extension (PI) |
| `@szczynk/vsce-git-tools` | `tsup` | VS Code | VS Code extension (`vscode.git` dep) |

Dependency: all 3 adapter packages depend on `core` (tsconfig reference + devDependency).

## Build

- `npm run build` — builds core first, then all workspaces
- Per-package: `npm run build -w <name>` (e.g. `@szczynk/git-tools-core`)
- Core uses `tsc`, adapters use `tsup` with per-package `tsup.config.ts`
- DTS generation is disabled in adapter tsup configs (composite project conflict)
- vsce-git-tools entry: `src/extension.ts` (not `src/index.ts`)

## Test

```
npm test              # vitest run (all)
npm run test:unit     # vitest run --exclude '**/e2e.test.ts'
npm run test:e2e      # vitest run e2e.test
npm run test:watch    # vitest interactive
```

Test files: `packages/*/src/__test__/*.test.ts` (vitest include pattern).
Only core has tests currently. Adapter stub test files were removed.

No CI, no lint, no formatter configured yet.

## README

Generated from root `README.md` into each package at build time (`cp ../../README.md`). Do not write per-package READMEs; root is single source of truth.

## Release

Uses `@changesets/cli`. Template commands:
```
npm run changeset        # add a changeset
npm run version-packages # apply changesets + bump versions
npm run release          # publish
```

No `.changeset/config.json` — not set up yet. First release needs one.

## Stack

- TypeScript 6, NodeNext module/resolution, ESM (`"type": "module"`)
- Composite project references w/ `tsconfig.base.json`
- `tsup` for adapter bundles (per-package config)
- Vitest 4
- Node >= 22

## Core package

Core exports pure git logic: `gitSync`, `compactStatus`, `hasStagedChanges`, `compactDiff`, `compactDiffText`, `formatCommitMessage`, constants (`STAGED_RE`, `FULL_DIFF_HINT`, `COMMIT_TYPES`, `FAILED_ERROR_MESSAGE`, `MAX_NUDGES`), and types.

## Adapter packages

All three adapters implement the same 5-tool surface area:
- `git_status` — compact status with staged-changes guard
- `git_restore_staged` — unstage all changes
- `git_diff` — compact diff (500 line cap, 100 line per-hunk), escalates to no-compact
- `git_diff_no_compact` — full diff (no truncation)
- `git_format_message` — assemble + validate Conventional Commit message

PI adapter uses `typebox` for param schemas. OpenCode uses `zod`. VSCode uses `vscode.git` API.
