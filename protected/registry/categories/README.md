# Registry Categories

## Visibility Classification

This directory is classified [PROTECTED].

Each file under this directory declares a [PROTECTED] category of
boundary-crossing references. Files in this directory are governed
ontology artifacts; their contents are not documentable outside this
directory.

At scaffold time, this directory contains no category files. Categories
are added through registry-scoped pull requests that pass the
disclosure-audit cycle.

## File Contract

Each category file:

1. Carries a `[PROTECTED]` header comment
2. Exports an array conforming to `RegistryEntry[]` from `../types`
3. Records its audit origin via `RegistryAuditOrigin`
4. Contains no comments, examples, or documentation disclosing its contents

## Aggregation

Category files are aggregated by `protected/registry/index.ts`. The
aggregation is internal; consumers do not reference category files
directly.
