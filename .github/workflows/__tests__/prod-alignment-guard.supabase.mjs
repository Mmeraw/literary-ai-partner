// Pure decision function mirroring the read-only Supabase parity logic in
// .github/workflows/prod-alignment-guard.yml (the "Verify migration parity
// (repo vs production)" step of the verify-supabase-prod-drift job). Exported
// as a pure function so the fail-closed contract can be unit-tested with
// fixtures — the workflow itself still runs the direct psql queries inline. If
// you change one, change the other; prod-alignment-guard.supabase.test.mjs
// guards the contract.
//
// Contract proven: the read-only path is strict but CLI-auth-independent — it
// never needs `supabase link` or SUPABASE_ACCESS_TOKEN, only PROD_SUPABASE_DB_URL.
// It fails closed on a missing DB URL, malformed remote schema_migrations
// versions (not exactly 14 digits), and any repo↔production migration drift.

export const PARITY = {
  OK: "OK",
  MISSING_DB_URL: "MISSING_DB_URL",
  MALFORMED_REMOTE: "MALFORMED_REMOTE",
  MISSING_MIGRATIONS: "MISSING_MIGRATIONS",
  EXTRA_MIGRATIONS: "EXTRA_MIGRATIONS",
};

const MIGRATION_ID = /^[0-9]{14}$/;

function uniqSorted(values) {
  return [...new Set(values)].sort();
}

// Local migration ids = the leading 14-digit timestamp of each *.sql basename
// (mirrors the workflow's `ls supabase/migrations/*.sql | ... | cut -d'_' -f1`).
export function deriveLocalIds(basenames) {
  const ids = basenames
    .filter((f) => f.endsWith(".sql"))
    .map((f) => String(f).split("/").pop().split("_")[0]);
  return uniqSorted(ids);
}

// Parse `psql -Atqc` output into valid ids and any malformed (non-14-digit) rows
// (mirrors the workflow's grep -Ev '^$|^[0-9]{14}$' malformed check).
export function parseRemoteVersions(remoteRowsText) {
  const rows = String(remoteRowsText ?? "")
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  const malformed = rows.filter((r) => !MIGRATION_ID.test(r));
  const ids = uniqSorted(rows.filter((r) => MIGRATION_ID.test(r)));
  return { ids, malformed };
}

// Pure parity decision. Fails closed on missing DB URL, malformed remote
// versions, and any repo↔production migration drift.
export function evaluateSupabaseParity({ dbUrl, localIds, remoteRowsText }) {
  if (!dbUrl) {
    return { ok: false, code: PARITY.MISSING_DB_URL, message: "Missing PROD_SUPABASE_DB_URL" };
  }

  const { ids: remoteIds, malformed } = parseRemoteVersions(remoteRowsText);
  if (malformed.length > 0) {
    return {
      ok: false,
      code: PARITY.MALFORMED_REMOTE,
      message:
        "Production has malformed schema_migrations.version values (expected exactly 14 digits):\n" +
        malformed.join("\n"),
      malformed,
      remoteIds,
    };
  }

  const local = uniqSorted(localIds);
  const remoteSet = new Set(remoteIds);
  const localSet = new Set(local);
  const missingRemote = local.filter((id) => !remoteSet.has(id));
  const extraRemote = remoteIds.filter((id) => !localSet.has(id));

  if (missingRemote.length > 0) {
    return {
      ok: false,
      code: PARITY.MISSING_MIGRATIONS,
      message: "Production is missing repo migrations:\n" + missingRemote.join("\n"),
      missingRemote,
      extraRemote,
      remoteIds,
    };
  }
  if (extraRemote.length > 0) {
    return {
      ok: false,
      code: PARITY.EXTRA_MIGRATIONS,
      message:
        "Production has remote-only migrations not present in repo:\n" + extraRemote.join("\n"),
      missingRemote,
      extraRemote,
      remoteIds,
    };
  }

  return {
    ok: true,
    code: PARITY.OK,
    message: "Supabase production migrations are fully aligned with repo",
    missingRemote,
    extraRemote,
    remoteIds,
  };
}
