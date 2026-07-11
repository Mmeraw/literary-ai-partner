#!/usr/bin/env node
import { chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const hookPath = resolve(".githooks/pre-push");

try {
  chmodSync(hookPath, 0o755);
  execFileSync("git", ["config", "core.hooksPath", ".githooks"], { stdio: "inherit" });
  console.log("Installed repository-managed Git hooks from .githooks/.");
  console.log("The pre-push hook now validates the live GitHub PR body before each push.");
} catch (error) {
  console.error("Failed to install repository-managed Git hooks.");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
