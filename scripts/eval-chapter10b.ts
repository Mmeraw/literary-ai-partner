// @ts-nocheck
/**
 * DEPRECATED: This script uses an outdated PipelineResult API
 *
 * PipelineResult is now a discriminated union:
 *  { ok: false; error: string; ... } | { ok: true; synthesis: ...; ... }
 *
 * This script directly accesses properties that only exist on the success branch.
 * It is kept for reference only and will not be fixed unless explicitly requested.
 *
 * To update: wrap all property access in if (result.ok) { / * access success branch * / }
 */

import { runPipeline } from "../lib/evaluation/pipeline/runPipeline";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env" });

const CHAPTER_TEXT = `
Chapter 10b – Council Members and Minutes

Over two days, I moved through the Tłekeh Dene Council site the way one follows a river — clicking from link to link, letting each current pull me deeper. I hadn't expected much from a remote settlement's online presence, but what surfaced was startling: a public archive dense with attendance rosters, recorded motions, votes cast and carried. Tłekeh Dene First Nation. Band Number 799. Treaty 11. It was governance written out in plain sight, for anyone with the patience to look.

The site was a clean channel — simple, well-kept, like a long-used trail maintained without flash. I followed it into their history page and felt the cadence of the words in my chest. Those who Walk Upriver. Never surrendered our ways. They rose like stones breaking a current. An entire section was given over to the caribou routes they'd fought to protect, lines of migration stretching across maps like veins, and a dam upriver that had already silted one spawning channel into the realm of memory.

This wasn't just land. It was memory layered over resistance, a living map inked in rivers — carrying both pain and power.

One line in the minutes caught and held me:

"Chief Tallfeather requests additional time before ratifying the Mackenzie Sovereign Corridor proposal. Concerns include migratory disruption, cultural site access, and intergenerational trust."

Behind me, Cliff leaned in. "So Robert is holding the line," he murmured.

Below the minutes, a scanned petition waited — twenty-three names written in careful, varied hands. Youth signatures, the kind made by people who had been taught to write slowly and mean it. At the top: Let the River Decide.

The cultural section held me longest. A single entry on language preservation struck with precision. I'd spent a decade in Quebec, witness to the ferocity with which a people can guard their inheritance: language, art, history, archives, cuisine, the unspoken rules that give shape to daily life. They'd built fortresses out of words. The Tłekeh Dene were fighting for the same.

TŁEKEH DENE COUNCIL MEETING MINUTES — November 8, 2024

Agenda Item #2 – Curriculum Shift Proposal: Language & History vs. Modern Education
Motion Introduced by: Councillor Ryan Netana
Subject: Proposal to shift education time away from language instruction toward STEM-oriented programming.

Cllr. Netana: "Our kids are falling behind in applied sciences. We need engineers, coders, ecologists — not just storytellers. Language and history matter, but they won't keep the lights on."
Cllr. Shaw: "We've poured thousands into cultural revitalization. But what have we gained? Fluency is down. Job readiness is down."
Cllr. Moss: "Language isn't a luxury. If we abandon it now, we may not get it back."
Cllr. Tsu: "Maybe a hybrid model works. But I'm not ready to cut Dene time yet."
Chief Tallfeather: "This is betrayal dressed as progress. Our words are science. Our songs are ecology. The Creator gave us stories so we could live — not so we could forget. Cut the past from the child, and you cut the roots from the tree."

Elder Doreen Kai: "When the river floods, do we forget how it flows? Or do we remember the path? That's what our language does. It remembers for us."
Elder Walter Shin: "I worked at a dam site once. Science was useful. But my language got me home."
Elder Alayna Fox: [Silent. Later seen weeping outside the hall.]

Youth Observer Ella T., Age 16: "Can't we have both? My mom speaks Dene. I want to be a water engineer. I don't think those cancel each other out."

MOTION RESULT: Defeated. Votes For: 2 (Netana, Shaw). Votes Against: 1 (Tallfeather). Abstain: 2 (Moss, Tsu).

"Dad, I've got it! Five elders. A natural, elemental number — often tied to the five senses, five elements, five directions. Balance without clutter."
"And the odd number allows for vote splitting, 3–2, where Robert is the likely tiebreaker."

Three days later, I had a synopsis. It joined the growing pile on the kitchen table — maps curled at the edges, printouts streaked with highlighter. We'd stopped eating here weeks ago; the table was more archive than furniture. Meals happened at the counter, or in the living room with plates balanced on knees.

I read aloud the profiles I'd built:
Chief Robert — lineage, continuity, final say. Torn. Raised his daughter to hunt, trap, fish, lead. Raised her as a boy. Regrets her path.
Niska, the healer — spirit and land health. Opposes dam: "Rivers are veins. You cannot clot them."
Malcolm 'Bones' Littleknife — survivalist. Split: sees hardship, but also the cost of ease.
Irene Whitefeather — keeper of language and stories. Fearful of losing them forever.
Frankie Bearhead — government liaison. Pro-dam: "We negotiate now or get nothing later."

"These aren't résumés," I said. "They're fault lines."

Robert had signed early support letters for the One Canada Act. Said he'd been pressured. Backed out when he saw the cost.
Niska swore the river was alive — had felt it take a life once. Never told a soul. She'd sensed Leanna's death too, the way you sense a storm: the taste of metal, the pressure in the air.
Bones had scouted hydro corridors for BC Hydro in his twenties, cash in hand. Voted for the Mackenzie dam, maybe from the same guilt.
Irene had a grandchild in Calgary working for Leanna's energy company. Torn clean down the middle.
Frankie took a consulting retainer from the conglomerate. Called it "just advice." Federal records showed his name.

"When they built Three Gorges, they didn't just flood farmland," I said to Cliff on the boat, water dark around us, cold and tannic. "They drowned whole fishing cultures. You lose the fish, you lose the knowledge. You lose the knowledge, the river forgets you."

Cliff didn't answer right away, his grip tightening on the tiller.

"They say sturgeon used to run the Yangtze in schools you could see from shore. White sturgeon — biggest freshwater fish in the world. Now they're functionally extinct. It wasn't just the dam. It was everything that came with it — ports, factories, ship traffic, silt choking the beds. You can't turn a river into a staircase and expect the old tenants to stick around."

By the time we tied off at the Minto dock, the wind had fallen. The cove lay flat and dark, the water's surface like oiled leather. Somewhere beneath, the old river still moved — the real one, that didn't care about BC Hydro or Robert's council meetings. It carried silt from places no white man had stood. It carried bones.

Robert's council could debate for years — five voices, split on dam or no dam. But the river didn't need a vote to enforce its truth: once you sever a vein, the whole body changes.

Cliff came down the dock with the jerrycan, diesel smell trailing him. "We good?" he asked.
"Yeah," I said — but I wasn't answering the question he'd asked.

In the dying light, the water looked almost still. Almost harmless. You could believe, if you wanted, that it forgave everything.

But if you listened — really listened — you could hear it keeping score.
`;

async function main() {
  const apiKey = process.env.OPENAI_API_KEY;
  const perplexityKey = process.env.PERPLEXITY_API_KEY ?? "";
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  console.log("\n=== RevisionGrade Evaluation Pipeline ===");
  console.log("Chapter: 10b – Council Members and Minutes");
  console.log("Work type: literary-fiction");
  console.log("Running all 3 passes (craft → editorial → synthesis)...\n");

  const startTime = Date.now();

  const result = await runPipeline({
    manuscriptText: CHAPTER_TEXT,
    workType: "literary-fiction",
    title: "Chapter 10b – Council Members and Minutes",
    executionMode: "TRUSTED_PATH",
    openaiApiKey: apiKey,
    model: "o3",
    perplexityApiKey: perplexityKey || undefined,
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Evaluation complete in ${elapsed}s\n`);

  // --- Pretty-print the 13 criteria scores ---
  const criteriaLabels: Record<string, string> = {
    concept:          "Concept & Premise",
    narrativeDrive:   "Narrative Drive",
    character:        "Character",
    voice:            "Voice",
    sceneConstruction:"Scene Construction",
    dialogue:         "Dialogue",
    theme:            "Theme",
    worldbuilding:    "Worldbuilding",
    pacing:           "Pacing",
    proseControl:     "Prose Control",
    tone:             "Tonal Authority",
    narrativeClosure: "Narrative Closure",
    marketability:    "Marketability",
  };

  console.log("=====================================");
  console.log("   13-CRITERION SCORES (out of 10)  ");
  console.log("=====================================");

  const criteria = result.criteria ?? {};
  for (const [key, label] of Object.entries(criteriaLabels)) {
    const c = criteria[key];
    const score = c?.score ?? "N/A";
    const bar = typeof score === "number" ? "█".repeat(Math.round(score)) + "░".repeat(10 - Math.round(score)) : "";
    console.log(`  ${label.padEnd(24)} ${String(score).padStart(3)}/10  ${bar}`);
  }

  const scores = Object.values(criteria)
    .map((c: any) => c?.score)
    .filter((s): s is number => typeof s === "number");
  const avg = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : "N/A";
  console.log("─────────────────────────────────────");
  console.log(`  COMPOSITE AVERAGE            ${avg}/10`);
  console.log("=====================================");

  // --- Top 3 risks ---
  if (result.top_3_risks?.length) {
    console.log("\n⚠  TOP RISKS FLAGGED BY PIPELINE:");
    result.top_3_risks.forEach((r: any, i: number) => {
      console.log(`  ${i + 1}. [${r.criterionKey}] ${r.summary}`);
    });
  }

  // --- Synthesis / editorial summary ---
  if (result.synthesis) {
    console.log("\n── SYNTHESIS VERDICT ─────────────────");
    console.log(result.synthesis);
  }

  // --- Governance / EG gate result ---
  const gov = result.governance;
  if (gov) {
    console.log("\n── EVALUATION GATE ───────────────────");
    console.log(`  Confidence : ${gov.confidence}`);
    if (gov.warnings?.length) gov.warnings.forEach((w: string) => console.log(`  ⚠ ${w}`));
    if (gov.limitations?.length) gov.limitations.forEach((l: string) => console.log(`  ℹ ${l}`));
  }

  // --- Recommendations ---
  if (result.recommendations?.length) {
    console.log("\n── RECOMMENDATIONS ───────────────────");
    result.recommendations.slice(0, 5).forEach((r: any, i: number) => {
      console.log(`  ${i + 1}. ${r}`);
    });
  }

  // --- Cross-check (Pass 4) ---
  const cc = (result as any).crossCheck;
  if (cc) {
    console.log("\n── PERPLEXITY CROSS-CHECK (sonar-reasoning-pro) ──");
    console.log(`  Agreement : ${cc.overallAgreement}`);
    if (cc.disputedCriteria?.length) {
      console.log(`  Disputed  : ${cc.disputedCriteria.join(", ")}`);
    } else {
      console.log("  Disputed  : none — both models agree");
    }
    console.log("\n  CRITERION COMPARISON (OpenAI o3 vs Perplexity sonar-reasoning-pro):");
    const labels: Record<string,string> = { concept:"Concept",narrativeDrive:"Narrative Drive",character:"Character",voice:"Voice",sceneConstruction:"Scene Const.",dialogue:"Dialogue",theme:"Theme",worldbuilding:"Worldbuilding",pacing:"Pacing",proseControl:"Prose Control",tone:"Tone",narrativeClosure:"Closure",marketability:"Marketability" };
    for (const [k, v] of Object.entries(cc.criteria as Record<string,any>)) {
      const flag = v.disputed ? " ⚠ DISPUTE" : "";
      console.log(`  ${(labels[k]??k).padEnd(18)}  o3:${String(v.openaiScore).padStart(2)}  pplx:${String(v.perplexityScore).padStart(2)}  Δ${v.delta}${flag}`);
    }
    if (cc.perplexitySynthesisNote) {
      console.log("\n  Perplexity note:", cc.perplexitySynthesisNote);
    }
  } else {
    console.log("\n(Pass 4 skipped — no PERPLEXITY_API_KEY set)");
  }

  // Save full output to JSON
  const outPath = path.join("scripts", "eval-chapter10b-result.json");
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`\nFull result saved → ${outPath}`);
}

main().catch((err) => {
  console.error("\n❌ Evaluation failed:", err.message);
  process.exit(1);
});
