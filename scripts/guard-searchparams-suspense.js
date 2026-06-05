#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const PAGE_FILE_PATTERN = /(?:^|\/)page\.(?:ts|tsx|js|jsx)$/;

function collectPageFiles(rootDir) {
  const output = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (PAGE_FILE_PATTERN.test(fullPath)) {
        output.push(fullPath);
      }
    }
  }

  if (fs.existsSync(rootDir)) walk(rootDir);
  return output;
}

function getScriptKind(filePath) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".ts")) return ts.ScriptKind.TS;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function nodeContainsUseSearchParamsCall(node) {
  let found = false;
  function visit(current) {
    if (found) return;
    if (
      ts.isCallExpression(current) &&
      ts.isIdentifier(current.expression) &&
      current.expression.text === "useSearchParams"
    ) {
      found = true;
      return;
    }
    ts.forEachChild(current, visit);
  }
  visit(node);
  return found;
}

function sourceHasSuspenseJsx(sourceFile) {
  let found = false;

  function isSuspenseTagName(tagName) {
    if (ts.isIdentifier(tagName)) return tagName.text === "Suspense";
    if (ts.isPropertyAccessExpression(tagName)) return tagName.name.text === "Suspense";
    return false;
  }

  function visit(node) {
    if (found) return;
    if (ts.isJsxSelfClosingElement(node) && isSuspenseTagName(node.tagName)) {
      found = true;
      return;
    }
    if (ts.isJsxOpeningElement(node) && isSuspenseTagName(node.tagName)) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function sourceDefaultExportContainsUseSearchParams(sourceFile) {
  let found = false;

  function hasExportDefaultModifiers(modifiers) {
    if (!modifiers || modifiers.length === 0) return false;
    let hasExport = false;
    let hasDefault = false;
    for (const modifier of modifiers) {
      if (modifier.kind === ts.SyntaxKind.ExportKeyword) hasExport = true;
      if (modifier.kind === ts.SyntaxKind.DefaultKeyword) hasDefault = true;
    }
    return hasExport && hasDefault;
  }

  function visit(node) {
    if (found) return;

    if (ts.isFunctionDeclaration(node) && hasExportDefaultModifiers(node.modifiers)) {
      if (nodeContainsUseSearchParamsCall(node)) {
        found = true;
        return;
      }
    }

    if (ts.isExportAssignment(node)) {
      if (nodeContainsUseSearchParamsCall(node.expression)) {
        found = true;
        return;
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return found;
}

function analyzeSource(filePath, sourceText) {
  const failures = [];
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    getScriptKind(filePath),
  );

  const sourceHasUseSearchParams = nodeContainsUseSearchParamsCall(sourceFile);
  if (!sourceHasUseSearchParams) return failures;

  if (!sourceHasSuspenseJsx(sourceFile)) {
    failures.push(`${filePath}: uses useSearchParams() but does not render a <Suspense> boundary in the page file.`);
  }

  if (sourceDefaultExportContainsUseSearchParams(sourceFile)) {
    failures.push(`${filePath}: default export directly calls useSearchParams(); move the hook into a child component and wrap it with <Suspense>.`);
  }

  return failures;
}

function runGuard(repoRoot = process.cwd()) {
  const appDir = path.join(repoRoot, "app");
  const pageFiles = collectPageFiles(appDir);
  const failures = [];

  for (const filePath of pageFiles) {
    const sourceText = fs.readFileSync(filePath, "utf8");
    failures.push(...analyzeSource(filePath, sourceText));
  }

  return { failures, pageCount: pageFiles.length };
}

if (require.main === module) {
  const { failures, pageCount } = runGuard();

  if (failures.length > 0) {
    console.error("useSearchParams/Suspense guard failed:\n");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`useSearchParams/Suspense guard passed (${pageCount} page files checked).`);
}

module.exports = {
  analyzeSource,
  collectPageFiles,
  runGuard,
};
