import { describe, it, expect } from "vitest";
import { formatCommitMessage, COMMIT_TYPES, STAGED_RE, FULL_DIFF_HINT } from "@szczynk/git-tools-core";

describe("COMMIT_TYPES", () => {
  it("contains standard conventional commit types", () => {
    expect(COMMIT_TYPES.has("feat")).toBe(true);
    expect(COMMIT_TYPES.has("fix")).toBe(true);
    expect(COMMIT_TYPES.has("refactor")).toBe(true);
    expect(COMMIT_TYPES.has("chore")).toBe(true);
    expect(COMMIT_TYPES.size).toBe(11);
  });
});

describe("STAGED_RE", () => {
  it("matches staged changes in porcelain output", () => {
    expect(STAGED_RE.test("M  file.ts")).toBe(true);
    expect(STAGED_RE.test("A  file.ts")).toBe(true);
    expect(STAGED_RE.test(" M file.ts")).toBe(false);
    expect(STAGED_RE.test("?? file.ts")).toBe(false);
  });
});

describe("FULL_DIFF_HINT", () => {
  it("matches expected hint string", () => {
    expect(FULL_DIFF_HINT).toBe("[full diff: rtk git diff --no-compact]");
  });
});

describe("formatCommitMessage", () => {
  it("formats a basic commit message", () => {
    const result = formatCommitMessage({
      files: [{ path: "src/index.ts", summary: "add main export" }],
      type: "feat",
      summary: "add main entry point",
      body: ["Exports all public API functions"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toContain("feat: add main entry point");
    expect(result.message).toContain("- Exports all public API functions");
    expect(result.fileList).toContain("src/index.ts");
  });

  it("formats with scope and breaking change", () => {
    const result = formatCommitMessage({
      files: [{ path: "src/api.ts", summary: "redesign auth flow" }],
      type: "feat",
      scope: "auth",
      summary: "redesign authentication flow",
      body: ["Replace OAuth1 with OAuth2"],
      breaking: true,
      breaking_description: "OAuth1 tokens no longer accepted",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.message).toContain("feat(auth)!: redesign authentication flow");
    expect(result.message).toContain("BREAKING CHANGE: OAuth1 tokens no longer accepted");
  });

  it("rejects invalid commit type", () => {
    const result = formatCommitMessage({
      files: [{ path: "x.ts", summary: "change" }],
      type: "invalid",
      summary: "test",
      body: ["test"],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("invalid type");
  });

  it("rejects header-format types in body lines", () => {
    const result = formatCommitMessage({
      files: [{ path: "x.ts", summary: "change" }],
      type: "fix",
      summary: "fix some stuff",
      body: ["fix: this looks like a header"],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("invalid body format");
  });

  it("requires breaking_description when breaking is true", () => {
    const result = formatCommitMessage({
      files: [{ path: "x.ts", summary: "change" }],
      type: "feat",
      summary: "test",
      body: ["test"],
      breaking: true,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("breaking_description");
  });
});
