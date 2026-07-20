import path from "node:path";

import { resolveTestBrowserExecutable } from "@/lib/testing/resolveTestBrowserExecutable";

describe("resolveTestBrowserExecutable", () => {
  it("preserves an explicit executable path without second-guessing the caller", () => {
    const exists = jest.fn(() => false);

    expect(resolveTestBrowserExecutable({
      env: { PUPPETEER_EXECUTABLE_PATH: " C:\\custom\\chrome.exe " },
      exists,
      platform: "win32",
    })).toBe("C:\\custom\\chrome.exe");
    expect(exists).not.toHaveBeenCalled();
  });

  it("discovers the first installed Windows browser deterministically", () => {
    const programFiles = "C:\\Program Files";
    const edge = path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe");

    expect(resolveTestBrowserExecutable({
      env: { PROGRAMFILES: programFiles },
      exists: (candidate) => candidate === edge,
      platform: "win32",
    })).toBe(edge);
  });

  it("discovers a standard Linux browser when present", () => {
    expect(resolveTestBrowserExecutable({
      env: {},
      exists: (candidate) => candidate === "/usr/bin/chromium",
      platform: "linux",
    })).toBe("/usr/bin/chromium");
  });

  it("leaves the path unset when no system browser is installed", () => {
    expect(resolveTestBrowserExecutable({
      env: {},
      exists: () => false,
      platform: "linux",
    })).toBeUndefined();
  });
});
