import { spawnSync } from "node:child_process";

export function gitSync(
  args: string[],
  cwd = ".",
): { stdout: string; stderr: string; exitCode: number } {
  const r = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 100 * 1024 * 1024,
  });
  return {
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    exitCode: r.status ?? 1,
  };
}
