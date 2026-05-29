import fs from "fs";
import path from "path";
import { STORY_LAYER_KEYS } from "@/lib/evaluation/artifacts/artifactTypes";
import { STORY_LAYER_METADATA } from "@/components/ledger/storyLayerMetadata";

describe("story layer metadata registry", () => {
  const repoRoot = path.resolve(__dirname, "../../..");
  const shellSource = fs.readFileSync(
    path.join(repoRoot, "components/ledger/StoryLedgerShell.tsx"),
    "utf8",
  );
  const layersSource = fs.readFileSync(
    path.join(repoRoot, "components/ledger/StoryLedgerLayers.tsx"),
    "utf8",
  );
  const editorialPromptSource = fs.readFileSync(
    path.join(repoRoot, "lib/evaluation/pipeline/prompts/pass2-editorial.ts"),
    "utf8",
  );
  const builderSource = fs.readFileSync(
    path.join(repoRoot, "lib/evaluation/phase1a/buildStoryLayerFromLedger.ts"),
    "utf8",
  );

  it("keeps metadata keys aligned with the canonical story layer keys", () => {
    expect(Object.keys(STORY_LAYER_METADATA)).toEqual(STORY_LAYER_KEYS);
  });

  it("provides display metadata for every canonical layer", () => {
    for (const key of STORY_LAYER_KEYS) {
      const entry = STORY_LAYER_METADATA[key];
      expect(entry.title).toEqual(expect.any(String));
      expect(entry.shortLabel).toEqual(expect.any(String));
      expect(entry.description).toEqual(expect.any(String));
      expect(entry.iconToken).toEqual(expect.any(String));
      expect(entry.title.trim()).not.toHaveLength(0);
      expect(entry.shortLabel.trim()).not.toHaveLength(0);
      expect(entry.description.trim()).not.toHaveLength(0);
      expect(entry.iconToken.trim()).not.toHaveLength(0);
    }
  });

  it("uses the shared metadata source in the UI and avoids local duplicate copy tables", () => {
    expect(shellSource).toContain("STORY_LAYER_KEYS");
    expect(shellSource).toContain("STORY_LAYER_METADATA");
    expect(shellSource).not.toContain("LAYER_LABELS");
    expect(shellSource).not.toContain("LAYER_NAV_DESC");
    expect(shellSource).not.toContain("LAYER_ICONS");
    expect(shellSource).not.toContain("LAYER_DEFINITIONS = [");

    expect(layersSource).toContain("STORY_LAYER_METADATA");
    expect(layersSource).not.toContain("LAYER_DESCRIPTIONS: Record<string, string> = {");
    expect(layersSource).not.toContain("Layer 9 — Identity & Pronoun Verification");
    expect(editorialPromptSource).toContain("STORY_LAYER_METADATA");
    expect(editorialPromptSource).not.toContain("LAYER_LABELS: Record<string, string> = {");
    expect(builderSource).not.toContain("Layer 9 — Identity & Pronoun Verification");
  });
});
