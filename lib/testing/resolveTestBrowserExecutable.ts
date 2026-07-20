import { existsSync } from "node:fs";
import path from "node:path";

type ResolveTestBrowserExecutableOptions = {
  env?: Record<string, string | undefined>;
  exists?: (candidate: string) => boolean;
  platform?: "aix" | "android" | "darwin" | "freebsd" | "haiku" | "linux" | "openbsd" | "sunos" | "win32" | "cygwin" | "netbsd";
};

function present(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

export function resolveTestBrowserExecutable(
  options: ResolveTestBrowserExecutableOptions = {},
): string | undefined {
  const env = options.env ?? process.env;
  const exists = options.exists ?? existsSync;
  const platform = options.platform ?? process.platform;
  const configured = env.PUPPETEER_EXECUTABLE_PATH?.trim();

  if (configured) {
    return configured;
  }

  const candidates = platform === "win32"
    ? present([
        env.PROGRAMFILES && path.join(env.PROGRAMFILES, "Google", "Chrome", "Application", "chrome.exe"),
        env["PROGRAMFILES(X86)"] && path.join(env["PROGRAMFILES(X86)"], "Google", "Chrome", "Application", "chrome.exe"),
        env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
        env.PROGRAMFILES && path.join(env.PROGRAMFILES, "Microsoft", "Edge", "Application", "msedge.exe"),
        env["PROGRAMFILES(X86)"] && path.join(env["PROGRAMFILES(X86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
      ])
    : platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
          "/snap/bin/chromium",
        ];

  return candidates.find((candidate) => exists(candidate));
}
