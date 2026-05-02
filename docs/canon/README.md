# docs/canon/ — Raw Canon Intake

Source material from Google Drive folder "RevisionGrade Core Canon" (~94 docs).

## Structure
- `_raw/` — Original .docx/.xlsx (gitignored; source-of-record in Drive)
- `_md/`  — markitdown-converted Markdown (committed, diffable, reviewable)

## Status: UNREGISTERED
None of this content is binding canon until it receives a Canon ID in
`docs/doctrine/DOCTRINE_REGISTRY.md` and is assigned to a Volume/Section
per Doctrine Registry v2.1 rules.

## Triage workflow
1. Review each `.md` in `_md/`
2. If it maps to existing doctrine/governance → move + register
3. If still draft → leave here
4. If obsolete → move to `archive/`

## Regenerate

`docs/canon/_raw/` is no longer in the repo (gitignored, removed 2026-05-02).
To regenerate the canon Markdown corpus from your local backup of the source
`.docx` originals (OneDrive / external disk / laptop):

```bash
# From your local backup directory containing the .docx originals:
mkdir -p docs/canon/_md
for f in /path/to/local/backup/*.docx; do
  markitdown "$f" > "docs/canon/_md/$(basename "${f%.docx}").md"
done

# Then reload Supabase
pnpm tsx scripts/load-canon.ts ./docs/canon
```

Note: `docs/canon/_raw/` is gitignored. Any local working copy of `.docx`
originals should stay outside the repo or under that gitignored path.

## Canon RAG Ingestion Policy

`docs/canon/_md/` is the **single source of truth** for the RevisionGrade RAG corpus. The ingestion loader (`scripts/load-canon.ts`) walks `docs/canon/` and embeds every `.md` file into Supabase (`canon_documents` + `canon_chunks`).

### Layout

| Path                                  | Role                                               | In RAG corpus? |
|---------------------------------------|----------------------------------------------------|:--------------:|
| `docs/canon/_md/`                     | Canonical Markdown — embedded into Supabase       | ✅            |
| `docs/canon/_raw/`                    | **Removed.** Gitignored to prevent return.        | ❌            |
| `docs/doctrine/`, `docs/governance/`  | Code-adjacent registered specs                    | ❌            |
| `docs/operations/`                    | Operational specs and runbooks                    | ❌            |
| `docs/roadmap/`, `docs/prs/`          | Planning / PR-scoped working drafts               | ❌            |
| `docs/operations/evidence/runs/**`    | Per-run pipeline evidence artifacts               | ❌            |

Original `.docx` source material lives outside the repo (OneDrive + external disk + laptop, 3-2-1 backup). To add a new document to the corpus, convert it to Markdown and place it under `docs/canon/_md/`.

### Rules

1. To make a document retrievable by the RAG layer, place its Markdown copy under `docs/canon/_md/`. Do not duplicate it elsewhere.
2. `docs/canon/_raw/` is gitignored. A future accidental import will be excluded from version control.
3. The loader uses `onConflict: 'filename'` for `canon_documents` and `(document_id, chunk_index)` UNIQUE for `canon_chunks`, so re-runs are idempotent at the document level.
4. New corpus additions must be reviewed in PR. The integrity audit (`select count(*) from canon_documents` + `where path like '%/_raw/%'` checks) should be run after any reload.

### Current state (verified 2026-05-02)

- 95 documents
- 563 chunks
- 0 `_raw/` leaks
- 0 null embeddings
- All chunks under the IVFFlat vector index for semantic retrieval via `match_canon_chunks(...)`

