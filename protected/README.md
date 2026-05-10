# Protected Directory

## Visibility Classification

This directory is classified [PROTECTED].

Contents under this path are governed ontology artifacts. They are
read-only to all consumers and modifiable only through registry-scoped
pull requests that pass the disclosure-audit cycle.

The shape of artifacts under this path is documentable. The contents
are not.

## Boundary

- Consumers read from `protected/registry/` exclusively through the
	read-only consumer contract exported by `protected/registry/index.ts`.
- No code outside this directory may define ontology categories inline.
- Modifications to files under this path require a registry-scoped PR.
- The CI guard reads from this directory; it does not write to it.

## References

- `docs/governance/PROTECTED_REGISTRY_SCAFFOLD_GOVERNANCE_BRIEF.md` (#420)
- `docs/governance/CI_GUARD_IMPLEMENTATION_GOVERNANCE_BRIEF.md` (#421)
- `docs/governance/governance-before-implementation.md`
