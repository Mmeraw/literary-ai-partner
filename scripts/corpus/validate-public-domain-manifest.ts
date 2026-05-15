import fs from "node:fs";
import path from "node:path";

const MANIFEST_PATH = path.join(
  process.cwd(),
  "corpus/public-domain/manifest.public-domain.json",
);

const REQUIRED_WORK_FIELDS = [
  "id",
  "title",
  "author",
  "first_publication_year",
  "source_name",
  "source_url",
  "jurisdiction_basis",
  "form",
  "raw_text_path",
  "clean_text_path",
  "allowed_uses",
  "cleaning",
] as const;

const ALLOWED_FORMS = new Set([
  "short_fiction",
  "novella",
  "long_novel",
  "novel",
  "story_collection",
]);

const ALLOWED_CLEANING_STATUSES = new Set([
  "not_downloaded",
  "raw_downloaded",
  "cleaned",
  "verified",
]);

type Cleaning = {
  status: string;
  headers_removed: boolean;
  footers_removed: boolean;
  modern_editorial_material_removed: boolean;
};

type Work = {
  id: string;
  title: string;
  author: string;
  first_publication_year: number;
  source_name: string;
  source_url: string;
  jurisdiction_basis: string;
  form: string;
  raw_text_path: string;
  clean_text_path: string;
  allowed_uses: string[];
  cleaning: Cleaning;
};

type Manifest = {
  schema_version: number;
  purpose: string;
  works: Work[];
};

function fail(message: string): never {
  console.error(`public-domain manifest invalid: ${message}`);
  process.exit(1);
}

function assertString(value: unknown, field: string, workId?: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${workId ? `${workId}: ` : ""}${field} must be a non-empty string`);
  }
}

function assertBoolean(value: unknown, field: string, workId: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    fail(`${workId}: ${field} must be a boolean`);
  }
}

function validatePath(field: "raw_text_path" | "clean_text_path", value: string, workId: string) {
  if (!value.startsWith("corpus/public-domain/")) {
    fail(`${workId}: ${field} must stay under corpus/public-domain/`);
  }

  if (value.includes("..")) {
    fail(`${workId}: ${field} must not contain parent-directory traversal`);
  }

  if (!value.endsWith(".txt")) {
    fail(`${workId}: ${field} must point to a .txt file`);
  }
}

function validateManifest(manifest: Manifest) {
  if (manifest.schema_version !== 1) {
    fail("schema_version must be 1");
  }

  assertString(manifest.purpose, "purpose");

  if (!Array.isArray(manifest.works) || manifest.works.length === 0) {
    fail("works must be a non-empty array");
  }

  const ids = new Set<string>();
  const cleanPaths = new Set<string>();
  const rawPaths = new Set<string>();

  for (const work of manifest.works) {
    for (const field of REQUIRED_WORK_FIELDS) {
      if (!(field in work)) {
        fail(`work is missing required field: ${field}`);
      }
    }

    assertString(work.id, "id");

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(work.id)) {
      fail(`${work.id}: id must be lowercase kebab-case`);
    }

    if (ids.has(work.id)) {
      fail(`${work.id}: duplicate id`);
    }
    ids.add(work.id);

    assertString(work.title, "title", work.id);
    assertString(work.author, "author", work.id);

    if (
      typeof work.first_publication_year !== "number" ||
      !Number.isInteger(work.first_publication_year) ||
      work.first_publication_year < 1000 ||
      work.first_publication_year > new Date().getFullYear()
    ) {
      fail(`${work.id}: first_publication_year must be a plausible integer year`);
    }

    assertString(work.source_name, "source_name", work.id);
    assertString(work.source_url, "source_url", work.id);

    try {
      const sourceUrl = new URL(work.source_url);
      if (!/^https?:$/.test(sourceUrl.protocol)) {
        fail(`${work.id}: source_url must use http or https`);
      }
    } catch {
      fail(`${work.id}: source_url must be a valid URL`);
    }

    assertString(work.jurisdiction_basis, "jurisdiction_basis", work.id);

    if (!ALLOWED_FORMS.has(work.form)) {
      fail(`${work.id}: form must be one of ${Array.from(ALLOWED_FORMS).join(", ")}`);
    }

    assertString(work.raw_text_path, "raw_text_path", work.id);
    assertString(work.clean_text_path, "clean_text_path", work.id);
    validatePath("raw_text_path", work.raw_text_path, work.id);
    validatePath("clean_text_path", work.clean_text_path, work.id);

    if (rawPaths.has(work.raw_text_path)) {
      fail(`${work.id}: duplicate raw_text_path ${work.raw_text_path}`);
    }
    rawPaths.add(work.raw_text_path);

    if (cleanPaths.has(work.clean_text_path)) {
      fail(`${work.id}: duplicate clean_text_path ${work.clean_text_path}`);
    }
    cleanPaths.add(work.clean_text_path);

    if (!Array.isArray(work.allowed_uses) || work.allowed_uses.length === 0) {
      fail(`${work.id}: allowed_uses must be a non-empty array`);
    }

    for (const allowedUse of work.allowed_uses) {
      assertString(allowedUse, "allowed_uses[]", work.id);
    }

    if (!work.cleaning || typeof work.cleaning !== "object") {
      fail(`${work.id}: cleaning must be an object`);
    }

    if (!ALLOWED_CLEANING_STATUSES.has(work.cleaning.status)) {
      fail(
        `${work.id}: cleaning.status must be one of ${Array.from(
          ALLOWED_CLEANING_STATUSES,
        ).join(", ")}`,
      );
    }

    assertBoolean(work.cleaning.headers_removed, "cleaning.headers_removed", work.id);
    assertBoolean(work.cleaning.footers_removed, "cleaning.footers_removed", work.id);
    assertBoolean(
      work.cleaning.modern_editorial_material_removed,
      "cleaning.modern_editorial_material_removed",
      work.id,
    );

    if (work.cleaning.status === "verified") {
      if (
        !work.cleaning.headers_removed ||
        !work.cleaning.footers_removed ||
        !work.cleaning.modern_editorial_material_removed
      ) {
        fail(`${work.id}: verified works must have all cleaning booleans true`);
      }
    }
  }
}

function main() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    fail(`missing manifest at ${MANIFEST_PATH}`);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
  validateManifest(manifest);
  console.log(`public-domain manifest valid: ${manifest.works.length} works`);
}

main();
