// Shim for `server-only` Next.js guard — lets CLI scripts import server modules.
// This file is injected via NODE_OPTIONS="--require ./scripts/server-only-shim.cjs"
// It must run BEFORE any module that imports `server-only`.
const Module = require("node:module");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  if (request === "server-only") {
    // Return the path of this shim itself — it's a no-op CJS module.
    return __filename;
  }
  return original.call(this, request, ...args);
};
// Also register as the module itself so require('server-only') returns {}
require.cache[require.resolve(__filename)] = {
  id: "server-only",
  filename: __filename,
  loaded: true,
  exports: {},
  parent: null,
  children: [],
  paths: [],
};
