import { COMMIT_TYPES } from "./constants.js";
import type { FormatMessageParams, FormatMessageResult } from "./types.js";

export function formatCommitMessage(params: FormatMessageParams): FormatMessageResult {
  if (!COMMIT_TYPES.has(params.type)) {
    return {
      ok: false,
      error: `invalid type "${params.type}". ALLOWED: ${[...COMMIT_TYPES].join(", ")}.`,
    };
  }

  const isBreaking = params.breaking === true;
  if (isBreaking && !params.breaking_description?.trim()) {
    return {
      ok: false,
      error: "breaking=true requires breaking_description. Provide a one-sentence migration note.",
    };
  }

  const breakingMark = isBreaking ? "!" : "";
  const scopePart = params.scope?.trim() ? `(${params.scope.trim()})` : "";
  const header = `${params.type}${scopePart}${breakingMark}: ${params.summary.trim()}`;

  const bodyLines: string[] = [];
  if (params.body && params.body.length > 0) {
    for (const line of params.body) {
      const clean = line.replace(/^-\s*/, "").trim();
      if (clean) {
        const firstChunk = clean.trim().split(" ")[0].replace(/:$/, "");
        if (firstChunk && COMMIT_TYPES.has(firstChunk)) {
          return {
            ok: false,
            error: `invalid body format, containing "${firstChunk}" as commit type. FORBIDDEN: commit types in body.`,
          };
        }
        bodyLines.push(`- ${clean}`);
      }
    }
  }

  if (isBreaking) {
    bodyLines.push("");
    bodyLines.push(`BREAKING CHANGE: ${params.breaking_description!.trim()}`);
  }

  const commitParts = [header];
  if (bodyLines.length > 0) {
    commitParts.push("");
    commitParts.push(...bodyLines);
  }
  const message = commitParts.join("\n");

  const fileList = params.files
    .map((f) => `- ${f.path}: ${f.summary.trim()}`)
    .join("\n");

  return { ok: true, message, fileList, header };
}
