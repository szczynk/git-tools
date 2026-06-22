import { gitSync } from "./git.js";
import { FULL_DIFF_HINT, FAILED_ERROR_MESSAGE } from "./constants.js";

function compactDiffText(
  diff: string,
  maxLines: number = 500,
  maxHunkLines: number = 100,
): string {
  const maxLinesEffective = maxLines === -1 ? Number.MAX_SAFE_INTEGER : maxLines;
  const maxHunkLinesEffective = maxHunkLines === -1 ? Number.MAX_SAFE_INTEGER : maxHunkLines;

  const result: string[] = [];
  let currentFile = "";
  let added = 0;
  let removed = 0;
  let inHunk = false;
  let hunkShown = 0;
  let hunkSkipped = 0;
  let wasTruncated = false;

  const lines = diff.split("\n");
  for (const line of lines) {
    if (line.startsWith("diff --git")) {
      if (hunkSkipped > 0) {
        result.push(` ... (${hunkSkipped} lines truncated)`);
        wasTruncated = true;
        hunkSkipped = 0;
      }
      if (currentFile && (added > 0 || removed > 0)) {
        result.push(` +${added} -${removed}`);
      }
      const parts = line.split(" b/");
      currentFile = parts.length > 1 ? parts[1] : "unknown";
      result.push(`\n${currentFile}`);
      added = 0;
      removed = 0;
      inHunk = false;
      hunkShown = 0;
    } else if (line.startsWith("@@")) {
      if (hunkSkipped > 0) {
        result.push(` ... (${hunkSkipped} lines truncated)`);
        wasTruncated = true;
        hunkSkipped = 0;
      }
      inHunk = true;
      hunkShown = 0;
      result.push(` ${line}`);
    } else if (inHunk) {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        added++;
        if (hunkShown < maxHunkLinesEffective) {
          result.push(` ${line}`);
          hunkShown++;
        } else {
          hunkSkipped++;
        }
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        removed++;
        if (hunkShown < maxHunkLinesEffective) {
          result.push(` ${line}`);
          hunkShown++;
        } else {
          hunkSkipped++;
        }
      } else if (!line.startsWith("\\")) {
        if (hunkShown > 0 && hunkShown < maxHunkLinesEffective) {
          result.push(` ${line}`);
          hunkShown++;
        } else if (hunkShown >= maxHunkLinesEffective) {
          hunkSkipped++;
        }
      }
    }

    if (result.length >= maxLinesEffective) {
      result.push("\n... (more changes truncated)");
      wasTruncated = true;
      break;
    }
  }

  if (hunkSkipped > 0) {
    result.push(` ... (${hunkSkipped} lines truncated)`);
    wasTruncated = true;
  }
  if (currentFile && (added > 0 || removed > 0)) {
    result.push(` +${added} -${removed}`);
  }

  let output = result.join("\n");
  if (wasTruncated) {
    output += `\n${FULL_DIFF_HINT}`;
  }
  return output;
}

export function compactDiff(
  args: string[] = [],
  maxLines: number = 500,
  maxHunkLines: number = 100,
  cwd = ".",
): string {
  const globalArgs: string[] = [];

  const filteredArgs = args.filter(
    (a) => !["--stat", "--numstat", "--shortstat", "--no-compact"].includes(a)
  );

  const statCmd = [...globalArgs, "diff", "--stat", ...filteredArgs];
  const statResult = gitSync(statCmd, cwd);
  if (statResult.exitCode !== 0) {
    return `git_diff --stat ${FAILED_ERROR_MESSAGE} ${statResult.stderr || "unknown error"}`;
  }

  let output = statResult.stdout.trim();

  const diffCmd = [...globalArgs, "diff", ...filteredArgs];
  const diffResult = gitSync(diffCmd, cwd);
  if (diffResult.exitCode !== 0) {
    return `git_diff ${FAILED_ERROR_MESSAGE} ${diffResult.stderr || "unknown error"}`;
  }
  if (diffResult.stdout) {
    const compacted = compactDiffText(diffResult.stdout, maxLines, maxHunkLines);
    output += `\n\nChanges:\n${compacted}`;
  }

  return output;
}

export { compactDiffText, FULL_DIFF_HINT };
