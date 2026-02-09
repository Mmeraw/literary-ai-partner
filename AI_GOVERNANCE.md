# AI Governance Policy

**Status:** Binding

## 1. Authority

AI assistants must use only canonical identifiers defined in:

- `docs/NOMENCLATURE_CANON_v1.md`
- `lib/canon/nomenclature_canon.v1.json`

These are the sole sources of truth for identifiers used in code, storage, routing, and evaluation artifacts.

## 2. Rules (Non-Negotiable)

1. **No invention.** Do not invent, rename, or infer identifiers.
2. **No aliasing.** Do not substitute synonyms or legacy names as keys.
3. **Ask to ratify.** If a concept does not map cleanly, request formal ratification and a version bump.
4. **Fail on drift.** Any non-canonical identifier that reaches code or storage is a defect and must fail CI.

## 3. Scope of Application

This policy applies to:
- Internal assistants and automation
- Copilot-style tools used in this repository
- External AI systems integrating with RevisionGrade

## 4. Cryptographic Signing Policy

**GPG signing is NOT an approved trust mechanism for this repository.**

- Commits, tags, and releases must not require or rely on GPG keys.
- Developer GPG signatures are not part of the project's compliance or canon enforcement chain.
- If a commit appears to be "unsigned," that is expected and correct for this project.

**Enforcement:**
- `commit.gpgsign` is disabled in repository Git configuration.
- `tag.gpgsign` is disabled in repository Git configuration.
- CI pipelines enforce that no `--gpg-sign` or `-S` flags are passed to Git commands.
- Any attempt to enable GPG signing in repository config is a policy violation.

## 5. Enforcement

- Validators and CI checks must reject unknown or banned keys.
- PR templates and system prompts should reference this document.

**If uncertain, stop and ask for the canon.**
