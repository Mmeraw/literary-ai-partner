// CLI-only shim: the `server-only` package intentionally has no resolvable
// Node export (it exists solely as a build-time guard so server config never
// leaks into client bundles). Offline pipeline scripts run under plain tsx/Node
// and transitively import modules guarded by `import "server-only"`, which would
// otherwise crash at module-eval time. This require hook resolves that bare
// specifier to a no-op ONLY in the tsx/CLI process, leaving the real guard fully
// intact for the Next.js bundler.
const Module = require("node:module");

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === "server-only") {
    return {};
  }
  return originalLoad.apply(this, arguments);
};
