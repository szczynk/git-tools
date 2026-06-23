import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  sourcemap: true,
  external: ["@opencode-ai/plugin", "@opencode-ai/sdk"],
  noExternal: ["@szczynk/git-tools-core"],
});
