// tests/sipoc/serverOnlyRegister.cjs
// Registers a require/resolve hook that maps `server-only` to a no-op.
// Used only by the SIPOC runtime harness (npm run sipoc:runtime) — no
// production code path imports this file.

const Module = require("module");
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;

const SHIM_ID = "__sipoc_server_only_shim__";

Module._resolveFilename = function (request, parent, isMain, options) {
  if (request === "server-only") return SHIM_ID;
  return originalResolve.call(this, request, parent, isMain, options);
};

Module._load = function (request, parent, isMain) {
  if (request === "server-only" || request === SHIM_ID) {
    return {};
  }
  return originalLoad.call(this, request, parent, isMain);
};
