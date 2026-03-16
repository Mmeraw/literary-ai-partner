import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/**
 * Loads local environment files for script execution without requiring
 * manual `source .env` in the shell.
 */
export function loadLocalEnv() {
  const cwd = process.cwd();
  const candidates = [".env.local", ".env"];

  for (const fileName of candidates) {
    const filePath = path.join(cwd, fileName);
    if (!fs.existsSync(filePath)) continue;
    dotenv.config({ path: filePath, override: false });
  }
}
