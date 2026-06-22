import { gitSync } from "./git.js";
import { STAGED_RE, FAILED_ERROR_MESSAGE } from "./constants.js";

function usesCompactStatusPath(args: string[]): boolean {
  if (args.length === 0) return true;
  let sawBranch = false;
  for (const arg of args) {
    switch (arg) {
      case "-b":
      case "--branch":
        sawBranch = true;
        break;
      case "-sb":
      case "-bs":
        return true;
      case "-s":
      case "--short":
        break;
      default:
        return false;
    }
  }
  return sawBranch;
}

function buildStatusCommand(
  args: string[],
  globalArgs: string[] = [],
): string[] {
  const cmd = [...globalArgs, "status"];
  if (usesCompactStatusPath(args)) {
    cmd.push("--porcelain", "-b");
  } else {
    cmd.push(...args);
  }
  return cmd;
}

function filterStatusWithArgs(output: string): string {
  const lines = output.split("\n");
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (
      trimmed.startsWith('(use "git') ||
      trimmed.startsWith("(create/copy files") ||
      trimmed.includes('(use "git add') ||
      trimmed.includes('(use "git restore')
    ) continue;
    if (
      trimmed.includes("nothing to commit") &&
      trimmed.includes("working tree clean")
    ) {
      result.push(trimmed);
      break;
    }
    result.push(line);
  }
  return result.length ? result.join("\n") : "ok";
}

function detectStatusState(line: string): string | null {
  const lower = line.toLowerCase();
  if (lower.includes("rebase")) return "rebase in progress";
  if (lower.includes("merge") && lower.includes("conflict")) return "merge in progress. unresolved conflicts";
  if (lower.includes("merge") && !lower.includes("conflict")) return "merge in progress. no conflicts";
  if (lower.includes("cherry-pick")) return "cherry-pick in progress";
  if (lower.includes("revert")) return "revert in progress";
  if (lower.includes("bisect")) return "bisect in progress";
  if (lower.includes("am session")) return "am session in progress";
  if (lower.includes("sparse checkout")) return "sparse checkout enabled";
  return null;
}

function extractStateHeader(raw: string): string | null {
  const stoppers = [
    "Changes to be committed:",
    "Changes not staged for commit:",
    "Untracked files:",
    "Unmerged paths:",
    "no changes added to commit",
    "nothing to commit",
    "nothing added to commit",
  ];
  for (const line of raw.split("\n")) {
    const stripped = line.trim();
    if (stoppers.some((s) => stripped.startsWith(s))) break;
    const state = detectStatusState(stripped);
    if (state) return state;
  }
  return null;
}

function extractDetachedHead(raw: string): string | null {
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("HEAD detached ")) return trimmed;
  }
  return null;
}

function formatStatusInner(porcelain: string, detached: string | null): string {
  const lines = porcelain.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) return "Clean working tree";

  const output: string[] = [];
  const first = lines[0];
  if (first.startsWith("##")) {
    const branch = first.replace(/^## /, "").trim();
    output.push(`* ${detached ?? branch}`);
  } else {
    output.push(first);
  }

  for (let i = 1; i < lines.length; i++) output.push(lines[i]);

  if (lines.length === 1 && lines[0].startsWith("##")) {
    output.push("clean — nothing to commit");
  }

  return output.join("\n");
}

export function hasStagedChanges(cwd = "."): boolean {
  const result = gitSync(["status", "--porcelain", "-b"], cwd);
  if (result.exitCode !== 0) return false;
  return STAGED_RE.test(result.stdout);
}

export function compactStatus(args: string[] = [], cwd = "."): string {
  const globalArgs: string[] = [];

  if (usesCompactStatusPath(args)) {
    const rawCmd = [...globalArgs, "status", ...args];
    const rawResult = gitSync(rawCmd, cwd);
    const rawOutput = rawResult.stdout;

    const cmd = buildStatusCommand(args, globalArgs);
    const result = gitSync(cmd, cwd);

    if (result.exitCode !== 0) {
      return `git_status ${FAILED_ERROR_MESSAGE} ${result.stderr || "unknown error"}`;
    }

    let formatted: string;
    const detached = extractDetachedHead(rawOutput);
    formatted = formatStatusInner(result.stdout, detached);

    const state = extractStateHeader(rawOutput);
    return state ? `${state}\n${formatted}` : formatted;
  } else {
    const cmd = [...globalArgs, "status", ...args];
    const result = gitSync(cmd, cwd);
    if (result.exitCode !== 0) {
      return `git_status ${FAILED_ERROR_MESSAGE} ${result.stderr || "unknown error"}`;
    }
    if (result.stderr) console.error(result.stderr);
    return filterStatusWithArgs(result.stdout);
  }
}
