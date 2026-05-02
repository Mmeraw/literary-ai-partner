# Canon Loader

Ingests the canonical RevisionGrade canon into Supabase as embedded chunks.

## Source of truth

`docs/canon/_md/**/*.md` is the **only** ingest source. Files outside this root,
or files with extensions other than `.md`, are skipped by design.

## Run

```
pnpm tsx scripts/load-canon.ts
```

The loader hard-pins its root to `docs/canon/_md` and ignores any path argument
passed on the command line (a warning is logged if one is supplied).

## Requires

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`

## Contract

- Repo (`docs/canon/_md/**/*.md`) = source of truth
- Supabase (`canon_documents`, `canon_chunks`) = search index
- Anything under `docs/canon/` outside `_md/` (e.g. `raw/`, `legacy/`, `*.txt`,
  `*.docx`) is ignored by the loader. Do not place canonical material there.
