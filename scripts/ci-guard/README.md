# CI Guard Implementation

This module implements procedural boundary enforcement that **consumes** ontology from `protected/registry/`.

Principles:
- No inline ontology definitions.
- No local category authority.
- Scanner handles structural tokenization only.
- Registry consumer provides semantic classification.
- Reporter handles merge-time enforcement outputs.
