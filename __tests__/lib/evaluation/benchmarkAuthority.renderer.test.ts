import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mammoth from 'mammoth';
import { buildShortFormEvaluationDocument } from '../../../lib/evaluation/shortFormReportDocument';
import { normalizeEvaluationReportViewModel } from '../../../lib/evaluation/evaluationReportViewModel';

const CONTRACT_ROOT = join(process.cwd(), 'tests/benchmark-authority');

// Public-facing report-type label for long-form multi-layer (DREAM) benchmarks.
// "DREAM" here is a product label, not an internal artifact.
const LONG_FORM_REPORT_TYPE = 'DREAM Long-Form Multi-Layer Evaluation';

type SurfaceRequiredStrings = {
  txt?: string[];
  html?: string[];
  docx?: string[];
};

type BenchmarkContract = {
  mode: 'short_form_evaluation' | 'long_form_multi_layer_evaluation';
  required_public_strings: string[];
  surface_required_strings?: SurfaceRequiredStrings;
  forbidden_public_strings: string[];
};

type ManifestEntry = {
  id: string;
  mode: 'short_form_evaluation' | 'long_form_multi_layer_evaluation';
  dir: string;
  contract_file?: string;
  contract_only?: boolean;
};

type BenchmarkManifest = {
  contracts: ManifestEntry[];
};

function loadContract(relativePath: string): BenchmarkContract {
  return JSON.parse(readFileSync(join(CONTRACT_ROOT, relativePath), 'utf8')) as BenchmarkContract;
}

function loadManifest(): BenchmarkManifest {
  return JSON.parse(readFileSync(join(CONTRACT_ROOT, 'manifest.json'), 'utf8')) as BenchmarkManifest;
}

function contractPathForEntry(entry: ManifestEntry): string {
  return `${entry.dir}/${entry.contract_file ?? 'expected.json'}`;
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeSurfaceText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function assertStringsInSurface(surfacePlain: string, surfaceName: string, expectedStrings: string[]) {
  for (const expected of expectedStrings) {
    const normalized = normalizeSurfaceText(expected);
    if (!surfacePlain.includes(normalized)) {
      throw new Error(`Expected ${surfaceName} surface to contain ${JSON.stringify(expected)} but it was missing.`);
    }
  }
}

function assertContractRendersAcrossSurfaces(params: {
  contract: BenchmarkContract;
  txt: string;
  html: string;
  docxText: string;
}) {
  const txtPlain = normalizeSurfaceText(params.txt);
  const htmlPlain = normalizeSurfaceText(stripHtmlTags(params.html));
  const docxPlain = normalizeSurfaceText(params.docxText);

  const universal = params.contract.required_public_strings ?? [];
  const surface = params.contract.surface_required_strings ?? {};

  // Universal strings must render on every public surface.
  assertStringsInSurface(txtPlain, 'TXT', universal);
  assertStringsInSurface(htmlPlain, 'HTML/PDF', universal);
  assertStringsInSurface(docxPlain, 'DOCX', universal);

  // Surface-specific strings must render on their declared surface only.
  assertStringsInSurface(txtPlain, 'TXT', surface.txt ?? []);
  assertStringsInSurface(htmlPlain, 'HTML/PDF', surface.html ?? []);
  assertStringsInSurface(docxPlain, 'DOCX', surface.docx ?? []);
}

function assertForbiddenStringsDoNotLeak(params: {
  contract: BenchmarkContract;
  txt: string;
  html: string;
  docxText: string;
}) {
  for (const forbidden of params.contract.forbidden_public_strings) {
    expect(params.txt).not.toContain(forbidden);
    expect(params.html).not.toContain(forbidden);
    expect(params.docxText).not.toContain(forbidden);
  }
}

function buildGoldenShortFormDocument() {
  return buildShortFormEvaluationDocument({
    displayTitle: 'Ancient Bloodlines',
    result: {
      generated_at: '2026-06-27T12:00:00.000Z',
      overview: {
        overall_score_0_100: 68,
        verdict: 'revise',
        one_paragraph_summary:
          'Ancient Bloodlines demonstrates strong conceptual ambition and genuine emotional intelligence in its handling of bullying, disability, grief, and interspecies cooperation, but struggles with pacing inconsistency, tonal register instability, and structural imbalance in the final third.',
        top_3_strengths: [
          'Cross-species relationship engine built through action rather than exposition.',
          'Ecological authenticity grounding the fantasy in observable natural systems.',
          'Anti-bullying narrative without didacticism.',
        ],
        top_3_risks: [
          'Tonal instability between gentle middle-grade fable and graphic violence.',
          'Mythology overload without grounding.',
          'Pacing collapse in Chapter 5.',
        ],
      },
      enrichment: {
        premise: 'Newton, a young rough-skinned newt with a damaged leg, must survive bullying, predation, and species prejudice to forge an unprecedented cross-species alliance.',
        trigger_warnings: ['animal-on-animal violence', 'parental death', 'environmental degradation', 'emotional abuse'],
        reading_grade_level: 5.8,
        dialogue_percentage: 35,
        narrative_percentage: 65,
      },
      metrics: {
        manuscript: {
          title: 'Ancient Bloodlines',
          word_count: 12200,
          genre: 'Middle-Grade Fantasy / Ecological Fable',
          target_audience: 'Middle-grade readers (ages 8\u201312) interested in animal fantasy, environmental themes, and anti-bullying narratives',
        },
      },
      criteria: [
        {
          key: 'concept',
          score_0_10: 8,
          confidence_level: 'high',
          rationale: 'The premise of a disabled newt forging cross-species alliance to save dying populations is original, commercially viable in the middle-grade animal fantasy space, and structurally sound.',
          recommendations: [],
        },
        {
          key: 'narrativeDrive',
          score_0_10: 6,
          confidence_level: 'high',
          rationale: 'The first three chapters maintain strong forward momentum through immediate physical danger. Chapters 5\u20136 lose propulsive energy as exposition replaces action.',
          recommendations: [
            {
              priority: 'high',
              action: 'Restructure Chapter 5 creation myth as interrupted storytelling.',
              anchor_snippet: 'Thorander\'s creation myth monologue (~2,000 words of uninterrupted backstory).',
              anchor_type: 'paraphrased_observation',
              symptom: 'Narrative momentum halts completely during a static lecture scene.',
              mechanism: 'The mythology is delivered as exposition rather than embedded in dramatic action.',
              specific_fix: 'Restructure as interrupted storytelling with counterpoint tension.',
              reader_effect: 'Maintains engagement through the middle third while still delivering essential world-building.',
              mistake_proofing: 'Do not cut the creation myth entirely; it establishes the thematic foundation for cross-species cooperation.',
            },
          ],
        },
        {
          key: 'voice',
          score_0_10: 6,
          confidence_level: 'moderate',
          rationale: 'The narrative voice oscillates between close third-person perspective and an omniscient narrator who comments philosophically.',
          recommendations: [],
        },
      ],
    },
  });
}

// Long-form multi-layer (DREAM) fixtures are born as long-form documents:
// the canonical UED is mode-tagged long_form_multi_layer_evaluation and the
// public report type defaults to the DREAM long-form label. The DREAM document
// itself is supplied separately to the ViewModel as dreamDoc.
function buildLongFormMultiLayerDocument(input: {
  result: Parameters<typeof buildShortFormEvaluationDocument>[0]['result'];
  displayTitle: string;
  reportType?: string;
}) {
  const doc = buildShortFormEvaluationDocument({
    displayTitle: input.displayTitle,
    reportType: input.reportType ?? LONG_FORM_REPORT_TYPE,
    result: input.result,
  });
  doc.templateMode = 'long_form_multi_layer_evaluation';
  return doc;
}

function buildGoldenDreamFixture() {
  const canonicalDoc = buildLongFormMultiLayerDocument({
    displayTitle: 'Cartel Babies',
    result: {
      generated_at: '2026-06-22T12:00:00.000Z',
      overview: {
        overall_score_0_100: 76,
        verdict: 'revise',
        one_paragraph_summary:
          'Cartel Babies is a powerful long-form thriller-drama about abduction, captivity, queer partnership, chosen family, cartel infrastructure, and the moral systems that grow inside failed states and informal power structures.',
        top_3_strengths: [
          'High-concept hook with literary depth.',
          'Embodied cartel-camp architecture.',
          'Central emotional triad.',
        ],
        top_3_risks: [
          'Procedural smoothness in the final third.',
          'Benjamin repetition.',
          'Upper-cartel differentiation.',
        ],
      },
      enrichment: {
        premise: 'A Canadian expatriate abducted by cartel operatives in Sinaloa is pulled into a hidden camp where survival depends on tactical observation, emotional discipline, and dangerous usefulness.',
        trigger_warnings: ['cartel abduction', 'child endangerment', 'physical assault', 'homophobic bullying'],
        reading_grade_level: 9.5,
        dialogue_percentage: 40,
        narrative_percentage: 60,
      },
      metrics: {
        manuscript: {
          title: 'Cartel Babies',
          word_count: 125004,
          genre: 'Upmarket Suspense / Literary Cartel Thriller',
          target_audience: 'Adult readers of literary suspense, borderlands crime fiction, character-driven thrillers, and morally complex family dramas',
        },
      },
      criteria: [
        {
          key: 'concept',
          score_0_10: 9,
          confidence_level: 'high',
          rationale: 'Distinctive cartel-captivity premise deepened by queer partnership, chosen family, and child-rescue stakes.',
          recommendations: [
            {
              priority: 'medium',
              action: 'Define the public-facing premise around chosen family under cartel sovereignty.',
              anchor_snippet: 'The novel contains a cartel-captivity hook, Benjamin search lane, and Paolito/Paul chosen-family payoff.',
              anchor_type: 'paraphrased_observation',
              symptom: 'Market framing can scatter across cartel, social issue, rescue, queer relationship, and witness-protection shelves.',
              mechanism: 'The manuscript contains several powerful operating frames without one dominant pitch hierarchy.',
              specific_fix: 'Define the public-facing premise around chosen family under cartel sovereignty, with cartel survival as the engine and Paolito/Paul as the emotional hinge.',
              reader_effect: 'Readers and agents understand the book\'s unique promise quickly.',
              mistake_proofing: 'Do not flatten the novel into child-rescue sentiment or generic cartel action.',
            },
          ],
        },
        {
          key: 'narrativeDrive',
          score_0_10: 8,
          confidence_level: 'high',
          rationale: 'Strong abduction, camp adaptation, Ra\u00FAl/Paolito bond, and extraction; some repetition and final administrative smoothness soften drive.',
          recommendations: [],
        },
      ],
    },
  });

  const dream = {
    dream_scores: { quality: 76, readiness: 70, commercial: null, literary: null },
    executive_verdict:
      'The manuscript has a real novel inside it and much of that novel is already on the page. Its release risk is not lack of story, but uneven governance across length, legal plausibility, packaging, and final-third causal friction.',
    market_shelf: {
      best_shelf: 'Literary Thriller / International Crime / Borderlands Fiction',
      marketable_hook: 'Chosen family under cartel sovereignty.',
      shelf_neighbors: ['Literary thriller with social realism', 'Borderlands crime fiction', 'Survival captivity drama'],
      comparison_space: ['Cartel-system fiction', 'Queer international family drama'],
      market_danger: 'The book can be misread as cartel procedural, autobiographical rescue fantasy, issue novel, queer romance, or witness-protection thriller.',
    },
    what_not_to_become: [
      'A generic narco shootout thriller.',
      'A tactical cartel manual disguised as fiction.',
    ],
    structural_stack: [
      {
        layer_name: 'Immediate Survival Thriller',
        status: 'strong',
        function: 'Establish kinetic abduction line: ordinary road, staged breakdown, armed seizure, transport, mountain camp, hierarchy.',
        revision_note: 'Maintain lived pattern without overexplaining pattern.',
      },
      {
        layer_name: 'Camp-System Anatomy',
        status: 'strong',
        function: 'The camp is the antagonist body: vehicles, lab, generator, cookshack, guards, roads, inner and outer rings.',
        revision_note: 'Continue to treat camp as social machine, not backdrop.',
      },
      {
        layer_name: 'Benjamin Parallel Search',
        status: 'strong but repetitive',
        function: 'Widen emotional frame with grief, shame, family pressure, money, and search agency.',
        revision_note: 'Each Benjamin chapter should produce irreversible new action.',
      },
      {
        layer_name: 'Ra\u00FAl / Paolito / Michael Triangulation',
        status: 'excellent',
        function: 'Heart of the book: paternal transfer, identity transformation, and moral ambiguity.',
        revision_note: 'Protect child-specific unpredictability.',
      },
      {
        layer_name: 'Higher-Order Cartel Politics',
        status: 'moderate',
        function: 'Navarro, Pedroza, Cobra widen scale beyond one camp.',
        revision_note: 'Seed pressure earlier; differentiate methods.',
      },
      {
        layer_name: 'State / Diplomatic / Protection Machinery',
        status: 'emotionally satisfying, procedurally thin',
        function: 'Final act shifts into consular, embassy, relocation, and protection terrain.',
        revision_note: 'Add jurisdiction, custody, and relocation friction.',
      },
      {
        layer_name: 'Healing and Chosen Family',
        status: 'strong',
        function: 'Epilogue and Vancouver material give the emotional thesis.',
        revision_note: 'The family is not cured; they are safe enough to begin.',
      },
    ],
    arc_map: [
      {
        act_name: 'Act I\u2014Seizure and System Entry',
        chapter_range: '1-10',
        primary_function: 'Michael is abducted, transported into mountain camp, registered by force into hierarchy.',
        revision_priority: 'Maintain urgency and visual clarity.',
      },
      {
        act_name: 'Act II\u2014Benjamin Before and During Michael',
        chapter_range: '11-20',
        primary_function: 'Benjamin backstory explains why Michael matters; search begins.',
        revision_priority: 'Convert repeated shame into external action.',
      },
      {
        act_name: 'Act III\u2014Camp Adaptation and First Moral Bond',
        chapter_range: '21-35',
        primary_function: 'Table tennis becomes plot architecture; Paolito attention and trust transfer.',
        revision_priority: 'Maintain changed-condition endings for each chapter.',
      },
      {
        act_name: 'Act IV\u2014Benjamin Search and Institutional Friction',
        chapter_range: '36-50',
        primary_function: 'Private horror of not knowing; humiliating slowness of official help.',
        revision_priority: 'Maintain propulsion in search arc.',
      },
      {
        act_name: 'Act V\u2014Ra\u00FAl Impossible Handoff',
        chapter_range: '51-65',
        primary_function: 'Ra\u00FAl becomes legible; handoff of Paolito must flower from earlier contradictions.',
        revision_priority: 'Avoid sudden redemption.',
      },
      {
        act_name: 'Act VI\u2014Break, Extraction, and State Handoff',
        chapter_range: '66-80',
        primary_function: 'Non-drug shipment, convoy, attack, escape, embassy, orientation, new names.',
        revision_priority: 'Add resistance to protection sequence.',
      },
      {
        act_name: 'Act VII\u2014New Country, Old Trauma, New Family',
        chapter_range: '81-87 + Epilogue',
        primary_function: 'Prove survival is not healing; table-tennis coda.',
        revision_priority: 'Nonviolent play after captivity as correct final image.',
      },
    ],
    criterion_analyses: [
      {
        key: 'concept',
        score: 9,
        confidence: 'high',
        fit_evidence: ['Distinctive cartel-captivity premise deepened by queer partnership and chosen family.'],
        gap_evidence: ['Market framing can scatter without one dominant pitch hierarchy.'],
        revision_queue: [
          'Define public-facing premise around chosen family under cartel sovereignty.',
        ],
      },
      {
        key: 'narrativeDrive',
        score: 8,
        confidence: 'high',
        fit_evidence: ['Strong abduction, camp adaptation, and extraction momentum.'],
        gap_evidence: ['Benjamin repetition and final administrative smoothness soften drive.'],
        revision_queue: [
          'Convert Benjamin repeated shame into irreversible external actions.',
          'Add procedural friction to final protection sequence.',
        ],
      },
    ],
    layer_analyses: [
      {
        layer_name: 'Survival / Captivity Layer',
        status: 'strong',
        needed_revision: 'Maintain lived pattern without overexplaining pattern.',
      },
      {
        layer_name: 'Love / Search Layer',
        status: 'strong but repetitive',
        needed_revision: 'Each Benjamin chapter should answer: what did he do today that cannot be undone?',
      },
      {
        layer_name: 'Child / Fatherhood Layer',
        status: 'excellent',
        needed_revision: 'Protect Paolito from becoming only a symbol; preserve child-specific unpredictability.',
      },
    ],
    cross_layer_integration: [
      {
        motif: 'Table Tennis',
        description: 'Begins as survival activity and becomes trust, discipline, observation, permission, attachment, and recovery.',
        integration_quality: 'strong',
        revision_note: 'Treat as plot architecture from play to family future.',
      },
      {
        motif: 'Naming / Renaming',
        description: 'Paolito-to-Paul is identity transformation, legal risk, family legitimacy, grief, and continuity.',
        integration_quality: 'strong',
        revision_note: 'Full payoff requires Michael, Benjamin, Ra\u00FAl, and Paul present in identity logic.',
      },
      {
        motif: 'Roads',
        description: 'Abduction road, mountain road, search road, embassy road, airport road, Vancouver road.',
        integration_quality: 'strong',
        revision_note: 'Should not become overused interpretive shorthand.',
      },
    ],
    symbolic_audit: {
      preserved_symbols: [
        {
          symbol: 'Table tennis equipment',
          current_function: 'Relational bridge activity mediating trust, authority, recovery, and family future.',
          revision_instruction: 'Treat as required benchmark detection: play, rules, permission, observation, trust transfer, and social temperature change.',
        },
        {
          symbol: 'Naming / renaming',
          current_function: 'Identity instability into Paul payoff.',
          revision_instruction: 'Trace identity instability through Paolito/Paul transformation.',
        },
      ],
      doctrine_strengths: ['Camp ecology reinforces social-machine atmosphere.', 'Table tennis motif carries strong cross-layer weight.'],
      doctrine_risks: ['Roads and atmospheric abstractions may become overused interpretive shorthand.'],
      audit_conclusion: 'Symbolic architecture is sound; primary risk is repetition of road/silence/system motifs.',
    },
    reader_experience: {
      first_act: {
        reader_question: 'Will Michael survive the first days of captivity?',
        emotional_state: 'Urgent fear and tactical attention.',
        risk: 'Risk of over-exposition in camp orientation.',
      },
      middle: {
        reader_question: 'Can the Paolito bond create an exit, or does it deepen the trap?',
        emotional_state: 'Growing attachment amid sustained danger.',
        risk: 'Benjamin chapters may feel circular without escalation.',
      },
      final_act: {
        reader_question: 'Is safety real, and at what cost?',
        emotional_state: 'Relief mixed with trauma awareness and ongoing threat.',
        risk: 'Protection sequence may feel too administratively smooth.',
      },
      aftertaste: 'The family is not cured; they are safe enough to begin.',
    },
    revision_plan: [
      {
        priority: 'P1',
        title: 'Run current manuscript-integrity pass',
        goal: 'Verify no current duplicate bodies, broken anchors, or TOC artifacts remain.',
        actions: [
          'Run duplicate-body, TOC, anchor, chapter-title, and front/back matter hygiene checks.',
        ],
        acceptance_check: 'No stale benchmark defects repeated as current fact.',
      },
      {
        priority: 'P2',
        title: 'Compress 8\u201312% globally',
        goal: 'Cut repeated emotional diagnosis, interpretive overlays, and procedural explanation.',
        actions: [
          'Cut repeated Benjamin emotional diagnosis.',
          'Reduce repeated atmospheric abstractions.',
          'Remove companion material better suited to author notes.',
        ],
        acceptance_check: 'Manuscript reduced to approximately 110,000\u2013115,000 words without damaging voice.',
      },
      {
        priority: 'P3',
        title: 'Make final protection sequence procedurally resistant',
        goal: 'Add jurisdiction, custody, identity, relocation, and bureaucratic friction.',
        actions: [
          'Add credible legal, jurisdictional, and custody friction.',
          'Dramatize friction through urgent scene pressure, not bureaucratic lecture.',
        ],
        acceptance_check: 'Final third feels as credible as the camp.',
      },
    ],
    releasability: [
      {
        dimension: 'Premise / hook',
        current_status: 'Very strong',
        verdict: 'Ready',
      },
      {
        dimension: 'Central relationship engine',
        current_status: 'Strong',
        verdict: 'Ready with trimming',
      },
      {
        dimension: 'Benjamin search arc',
        current_status: 'Necessary but repetitive',
        verdict: 'Revise',
      },
      {
        dimension: 'Final rescue plausibility',
        current_status: 'Emotionally strong, procedurally thin',
        verdict: 'Revise',
      },
      {
        dimension: 'Publication readiness',
        current_status: 'Not yet',
        verdict: 'Revise before release',
      },
    ],
    acceptance_checks: {
      required_detection: [
        'Must detect Benjamin as dual-POV co-protagonist.',
        'Must detect Paolito-to-Paul identity transformation.',
        'Must detect table tennis as relational bridge activity.',
      ],
      failure_conditions: [
        'Fails if treated as generic cartel thriller.',
        'Fails if Benjamin is ignored.',
        'Fails if Paolito/Paul is ignored.',
      ],
    },
    calibration_notes: [
      'Scoring calibrated for upmarket literary suspense expectations at 125,000 words.',
    ],
    manuscript_integrity_issues: [],
  } as any;

  return { canonicalDoc, dream };
}

function buildGoldenFrogginFixture() {
  const canonicalDoc = buildLongFormMultiLayerDocument({
    displayTitle: 'Froggin Noggin',
    result: {
      generated_at: '2026-06-27T12:00:00.000Z',
      overview: {
        overall_score_0_100: 58,
        verdict: 'revise',
        one_paragraph_summary:
          'Froggin Noggin runs two parallel power structures against each other for 100 pages and dares the reader to admit they are looking in a mirror: a human meth-cook storyline on one bank of Kingdom Lake and a matriarchal frog colony beneath it, braided by a shared doctrine of sovereigns hoarding chemistry.',
        top_3_strengths: [
          'Toadstone, meth cook, and matriarchal frog politburo form a genuinely original premise.',
          'Aqua World cosmology is textured and consistent across Gorf, hibernation, and council systems.',
          'The transgression is the asset: street register is authentic and character-coded.',
        ],
        top_3_risks: [
          'Three-refrain chant and extended Brutus monologues delay the first concrete turn.',
          'No promise made on page 1 has been kept by page 100.',
          'Council scenes arrive as position-paper rotations.',
        ],
      },
      enrichment: {
        premise:
          'On one bank of Kingdom Lake, two men marinate in stoner-noir self-destruction while one cooks methamphetamine; beneath the lake, a matriarchal frog colony rules through doctrine, surveillance, and the toadstone.',
        trigger_warnings: ['crystal methamphetamine manufacture', 'addiction', 'matriarchal cruelty'],
        reading_grade_level: 10.5,
        dialogue_percentage: 45,
        narrative_percentage: 55,
      },
      metrics: {
        manuscript: {
          title: 'Froggin Noggin',
          word_count: 51252,
          genre: 'Literary Transgressive Fiction / Dual-POV Eco-Fable',
          target_audience:
            'Adult literary readers of transgressive fiction and dual-POV dark fantasy; indie literary / horror-adjacent press audience',
        },
      },
      criteria: [
        {
          key: 'concept',
          score_0_10: 8,
          confidence_level: 'high',
          rationale:
            'Toadstone plus meth cook plus matriarchal frog politburo is a genuine original; two sovereigns hoard chemistry while their subjects would rather swallow the shiny thing than be free.',
          recommendations: [
            {
              priority: 'high',
              action: 'Mirror Brutus\u2019s meth cook against Zimeon\u2019s shard discovery on adjacent chapter beats.',
              anchor_snippet:
                'The novel runs a deliberate parallel between Brutus manufacturing chemical authority in a mineshaft and Zimeon ingesting chemical authority in the Dead Zone.',
              anchor_type: 'paraphrased_observation',
              symptom: 'The two chemical-authority chapters are not yet placed to make a reader feel the rhyme.',
              mechanism: 'The thematic parallel is stated as doctrine rather than felt through sequence.',
              specific_fix:
                'Re-sequence so the meth cook and the first shard lick sit adjacent; end one on inhaled fumes and open the next on the falling cascade.',
              reader_effect: 'Converts addiction-as-sovereign-authority from author-claim to felt experience.',
              mistake_proofing: 'Do not flatten the dual-POV cosmology into a single quest line.',
            },
          ],
        },
        {
          key: 'narrativeDrive',
          score_0_10: 4,
          confidence_level: 'high',
          rationale:
            'No promise made on page 1 has been kept by page 100: the toadstone is unfound, no frog has died on-page, no human has paid a real cost.',
          recommendations: [],
        },
      ],
    },
  });

  const dream = {
    dream_scores: { quality: 58, readiness: null, commercial: null, literary: null },
    executive_verdict:
      'The transgression is the asset, not the liability. The craft problem is that the narrator currently rides at Brutus\u2019s eye level instead of above it, and the manuscript has not yet kept a single promise it made on page 1. Fix the un-narrated cruelty and the missing Page-100 waypoint without sanding down the transgression.',
    market_shelf: {
      best_shelf: 'Literary Transgressive Fiction / Dual-POV Eco-Fable',
      marketable_hook: 'Two sovereigns hoarding chemistry, and subjects who would rather swallow the shiny thing than be free.',
      shelf_neighbors: ['Transgressive literary fiction', 'Dark literary fantasy', 'Horror-adjacent eco-fable'],
      comparison_space: ['Trainspotting meets Watership Down meets early Chuck Palahniuk'],
      market_danger: 'The book is mis-shelved if pitched as YA, cozy fantasy, or commercial fantasy quest.',
    },
    what_not_to_become: [
      'A book edited into safety with the transgression sanded down.',
      'A simplified frog-adventure story that erases the adult eco-satirical myth, amphibian polity, grotesque human thread, toadstone/shard/Gorf system, and cross-species tenderness.',
    ],
    structural_stack: [
      {
        layer_name: 'Human storyline\u2014Kingdom Lake meth world',
        status: 'strong but eye-level',
        function: 'Chey and Brutus marinate in stoner-noir self-destruction while Brutus cooks methamphetamine and fantasizes about the toadstone.',
        revision_note: 'Let the narrator be smarter than Brutus while Brutus performs his own damage.',
      },
      {
        layer_name: 'Frog storyline\u2014Aqua World matriarchy',
        status: 'excellent',
        function: 'Crown Hyla rules a Columbian spotted frog colony through doctrine, surveillance, and pre-hibernation maiming of dissenters.',
        revision_note: 'Stage Hyla\u2019s maiming of Arcana as present-tense scene, not recollection.',
      },
      {
        layer_name: 'Cosmological / theological frame',
        status: 'strong',
        function: 'Gorf, toadstone, shard, and the Genesis/Dominatus pastiche position Hyla as a feminine-divine echo.',
        revision_note: 'Earn one more move with a Dominatus 2 fragment that reframes the toadstone as Her test.',
      },
      {
        layer_name: 'Structural mirroring spine',
        status: 'present but invisible',
        function: 'Chemical authority over the body links Hyla\u2019s rule, Brutus\u2019s meth, the colony\u2019s toadstone, and the meth\u2019s control of Brutus.',
        revision_note: 'Make the mirroring visible; it is the spine.',
      },
    ],
    arc_map: [
      {
        act_name: 'Opening Movement\u2014Dual-System Setup',
        chapter_range: '1-14',
        primary_function: 'Establish the human meth world and the frog matriarchy as parallel power structures sharing one doctrine.',
        revision_priority: 'Lock the slang register and escalate the council scenes.',
      },
      {
        act_name: 'Page-100 Waypoint',
        chapter_range: 'excerpt close',
        primary_function: 'Deliver a false-positive toadstone payoff that keeps one page-1 promise and arms Act II.',
        revision_priority: 'Close the opening arc with a kept promise.',
      },
    ],
    criterion_analyses: [
      {
        key: 'concept',
        score: 8,
        confidence: 'high',
        fit_evidence: ['Toadstone, meth cook, and matriarchal frog politburo is a genuine original.'],
        gap_evidence: ['The thematic rhyme between human and frog chemical authority is not yet felt through sequence.'],
        revision_queue: [
          'Mirror Brutus\u2019s meth cook against Zimeon\u2019s shard discovery on adjacent chapter beats.',
        ],
      },
      {
        key: 'narrativeDrive',
        score: 4,
        confidence: 'high',
        fit_evidence: ['Multiple strong engines: meth cook, shard discovery, matriarchal surveillance.'],
        gap_evidence: ['No promise made on page 1 has been kept by page 100.'],
        revision_queue: [
          'Stage Hyla\u2019s maiming of Arcana as a present-tense scene.',
          'Deliver a Page-100 waypoint payoff.',
        ],
      },
    ],
    layer_analyses: [
      {
        layer_name: 'Human meth layer',
        status: 'strong but eye-level',
        needed_revision: 'Add one sentence of somatic narration per rant so the body indicts the mouth.',
      },
      {
        layer_name: 'Frog matriarchy layer',
        status: 'excellent',
        needed_revision: 'Escalate the council political scenes rather than defending them.',
      },
      {
        layer_name: 'Theological frame layer',
        status: 'open but unwalked',
        needed_revision: 'Walk through the Genesis/Dominatus door with one retroactive reframe.',
      },
    ],
    cross_layer_integration: [
      {
        motif: 'Chemical authority over the body',
        description: 'Brutus\u2019s meth, Zimeon\u2019s shard, Hyla\u2019s rule, and the colony\u2019s toadstone all enact control of the body.',
        integration_quality: 'strong but invisible',
        revision_note: 'Make the mirroring visible as the structural spine.',
      },
      {
        motif: 'Addiction-as-religion',
        description: 'Addiction and matriarchy-as-surveillance braid into one doctrine across both storylines.',
        integration_quality: 'strong',
        revision_note: 'Keep the braid; convert doctrine into felt sequence.',
      },
    ],
    symbolic_audit: {
      preserved_symbols: [
        {
          symbol: 'Toadstone / shard',
          current_function: 'Parallel addictive authorities mirroring human meth and frog amulet.',
          revision_instruction: 'Treat as required detection: the shard is the narrative mirror of Brutus\u2019s meth.',
        },
        {
          symbol: 'Mother-Earth-as-aging-diva voice',
          current_function: 'The strongest sustained prose in the excerpt; the book\u2019s North Star voice.',
          revision_instruction: 'Use the signature voice deliberately, not accidentally; write six more.',
        },
      ],
      doctrine_strengths: ['Aqua World cosmology is textured and consistent.', 'Transgression is character-coded, not gratuitous.'],
      doctrine_risks: ['Register drift between street and mythic voices taxes the reader every page.'],
      audit_conclusion: 'Symbolic architecture is sound; primary risk is register drift and un-narrated cruelty.',
    },
    reader_experience: {
      first_act: {
        reader_question: 'Will these two hoarded chemistries collide?',
        emotional_state: 'Dark-comic complicity and unease.',
        risk: 'Setup-heavy first 100 pages with no concrete turn.',
      },
      middle: {
        reader_question: 'Which sovereign is more dangerous, the human or the frog?',
        emotional_state: 'Growing recognition that the frogs are the morally darker storyline.',
        risk: 'Council scenes may read as position-paper rotations.',
      },
      final_act: {
        reader_question: 'Has any page-1 promise been kept?',
        emotional_state: 'Anticipation pending a Page-100 payoff.',
        risk: 'No interim payoff by Page 100.',
      },
      aftertaste: 'A literary-transgressive novel that should be edited into precision, not safety.',
    },
    revision_plan: [
      {
        priority: 'P1',
        title: 'Mirror Brutus\u2019s meth cook against Zimeon\u2019s shard discovery on adjacent chapter beats.',
        goal: 'Convert thematic doctrine into felt experience through sequence.',
        actions: [
          'Re-sequence the meth cook and first shard lick to sit adjacent.',
          'End one chapter on inhaled fumes and open the next on the falling cascade.',
        ],
        acceptance_check: 'The reader feels the rhyme between human and frog chemical authority.',
      },
      {
        priority: 'P2',
        title: 'Stage Hyla\u2019s maiming of Arcana as a present-tense scene, not a recollection.',
        goal: 'Establish the frog plot as the morally darker storyline.',
        actions: [
          'Move the maiming into present tense.',
          'Show the webbed mud, the single tooth, and the minimal bleeding.',
        ],
        acceptance_check: 'The reader is implicated in both the human and frog cruelties.',
      },
      {
        priority: 'P3',
        title: 'Page-100 waypoint payoff: false-positive toadstone.',
        goal: 'Keep one page-1 promise and arm Act II.',
        actions: [
          'In the closing scene, Brutus finds a calcified nodule and pockets it.',
          'Leave both Brutus and the reader unsure whether it is a real toadstone.',
        ],
        acceptance_check: 'The opening arc closes with a kept promise.',
      },
    ],
    releasability: [
      {
        dimension: 'Concept / premise',
        current_status: 'Distinctive and original',
        verdict: 'Ready after positioning',
      },
      {
        dimension: 'Frog-council political layer',
        current_status: 'Literary-fantasy register',
        verdict: 'Ready with escalation',
      },
      {
        dimension: 'Page-100 structural payoff',
        current_status: 'Missing',
        verdict: 'Revise',
      },
      {
        dimension: 'Line-level register control',
        current_status: 'Contraction drift across registers',
        verdict: 'Revise',
      },
      {
        dimension: 'Publication readiness',
        current_status: 'Not yet',
        verdict: 'Revise before release',
      },
    ],
    acceptance_checks: {
      required_detection: [
        'Must detect the dual-POV human and frog storylines as parallel power structures.',
        'Must detect the structural mirroring of chemical authority over the body.',
        'Must detect the missing Page-100 waypoint payoff.',
      ],
      failure_conditions: [
        'Fails if treated as YA or cozy fantasy.',
        'Fails if the transgression is read as authorial endorsement rather than indictment.',
        'Fails if the frog matriarchy is ignored.',
      ],
    },
    calibration_notes: [
      'Scoring calibrated for Transgressive-mode literary fiction across the first 100 pages (Chapters 1-14, 51,252 words).',
    ],
    manuscript_integrity_issues: [],
  } as any;

  return { canonicalDoc, dream };
}

function buildGoldenRiverFixture() {
  const canonicalDoc = buildLongFormMultiLayerDocument({
    displayTitle: 'Let the River Decide',
    result: {
      generated_at: '2026-06-27T19:00:00.000Z',
      overview: {
        overall_score_0_100: 72,
        verdict: 'revise',
        one_paragraph_summary:
          'Let the River Decide is a serious, atmospheric, adult literary eco-thriller / eco-spiritual road novel built around a memorable central proposition: water is not inert background, but witness, archive, nervous system, and judge. The manuscript\u2019s greatest assets are atmosphere, voice, thematic seriousness, environmental imagination, the Mike/Cliff relationship, the animal-sensory layer, and the repeated transformation of ordinary travel detail into moral pressure.',
        top_3_strengths: [
          'River-as-memory/judge premise is distinctive and powerful.',
          'Smokehouse Camp atmospheric and ceremonial material.',
          'Mike/Cliff relationship engine and animal-sensory layer.',
        ],
        top_3_risks: [
          'Over-evidence: manuscript repeatedly proves what scenes already show.',
          'Cultural/protocol uncertainty requires external sensitivity review.',
          'NV115/Plunkett threads need sharper payoff integration.',
        ],
      },
      enrichment: {
        trigger_warnings: ['violence', 'disappearances', 'environmental destruction', 'grief'],
        premise:
          'A man, his aging stepfather, and two dogs encounter a northern First Nation whose river may be remembering, judging, and removing those who profit from desecration.',
      },
      metrics: {
        manuscript: {
          title: 'Let the River Decide',
          word_count: 83_779,
          genre: 'Adult Literary Eco-Thriller / Eco-Spiritual Road Novel',
          target_audience:
            'Adult readers of literary eco-thriller, climate fiction, spiritual realism, road novels, family-inheritance fiction, and ethically complex environmental suspense',
        },
      },
      criteria: [
        {
          key: 'concept',
          score_0_10: 9,
          confidence_level: 'high',
          rationale:
            'The river-as-memory/judge premise, filtered through road-trip witness, Indigenous protocol, and corporate extraction, is distinctive and powerful.',
          recommendations: [],
        },
        {
          key: 'narrativeDrive',
          score_0_10: 7,
          confidence_level: 'high',
          rationale:
            'Strong opening, return-to-camp arc, and ending; middle research/ledger sections slow pressure.',
          recommendations: [],
        },
      ],
    },
  });

  const dream = {
    dream_scores: { quality: 72, readiness: 65, commercial: null, literary: null },
    executive_verdict:
      'Let the River Decide is a serious, atmospheric, adult literary eco-thriller / eco-spiritual road novel. The book begins with road-trip unease, missing-person posters, a black truck marked NV115, a remote river camp, and the vulnerability of two travelers with dogs at the edge of the Liard. The manuscript\u2019s greatest assets are atmosphere, voice, thematic seriousness, environmental imagination, the Mike/Cliff relationship, and the animal-sensory layer. The principal drag is over-evidence: the manuscript repeatedly tries to prove what the scenes already make the reader feel.',
    market_shelf: {
      best_shelf: 'Literary Eco-Thriller / Climate Fiction / Spiritual Realism / Road Novel',
      marketable_hook: 'A northern river may be remembering, judging, and removing those who profit from desecration.',
      shelf_neighbors: ['Literary eco-thriller', 'Climate fiction', 'Spiritual realism', 'Road novel'],
      comparison_space: ['Eco-spiritual suspense', 'First Nation sovereignty fiction'],
      market_danger: 'The book can be misread as generic eco-thriller, nature documentary, Indigenous exploitation narrative, or conspiracy procedural.',
    },
    what_not_to_become: [
      'A documentary eco-mystery where the narrator supplies the governing theory instead of letting the river remain exact but not fully legible.',
      'A research-file novel where evidence ledgers replace narrative tension and the river\u2019s ambiguity is over-explained.',
    ],
    structural_stack: [
      {
        layer_name: 'Road-trip witness layer',
        status: 'strong',
        function: 'Gives the reader an outsider entry point and mobile investigation frame.',
        revision_note: 'Maintain lived pattern without overexplaining pattern.',
      },
      {
        layer_name: 'Smokehouse Camp / T\u0142ekeh Dene layer',
        status: 'strong',
        function: 'Provides moral center, cultural ground, and living alternative to extraction logic.',
        revision_note: 'Treat as story custody and cultural authority, not exposition.',
      },
      {
        layer_name: 'River agency layer',
        status: 'strong',
        function: 'Converts environmental damage into active consequence and unifies disparate events.',
        revision_note: 'Remain exact but not fully overexplained.',
      },
      {
        layer_name: 'Investigation / ledger layer',
        status: 'moderate',
        function: 'Gives the spiritual premise documentary scaffolding.',
        revision_note: 'Compress strongest cases; convert rest to tighter dossier pattern.',
      },
      {
        layer_name: 'Corporate / infrastructure layer',
        status: 'moderate',
        function: 'Supplies external antagonist system and reconciliation-capitalism pressure.',
        revision_note: 'Promote Leanna / Verdant earlier for causal integration.',
      },
      {
        layer_name: 'Family / aging / labor layer',
        status: 'strong',
        function: 'Grounds ecological argument in care, inheritance, labor, and mortality.',
        revision_note: 'The family is not cured; they are safe enough to begin.',
      },
      {
        layer_name: 'Animal-sensory layer',
        status: 'strong',
        function: 'Tests spaces before humans can interpret them; gives river danger physical immediacy.',
        revision_note: 'Read as embodied evidence, not atmosphere.',
      },
    ],
    arc_map: [
      {
        act_name: 'Opening unease / road vulnerability',
        chapter_range: '1\u20133',
        primary_function: 'Strong hook, atmosphere, immediate dread.',
        revision_priority: 'NV115 must pay off or be framed as first symptom.',
      },
      {
        act_name: 'Research expansion / river pattern',
        chapter_range: '4\u20138',
        primary_function: 'Broadens stakes and scale.',
        revision_priority: 'Can become essayistic; reduce uncertainty less early.',
      },
      {
        act_name: 'Family and witness grounding',
        chapter_range: '9\u201316',
        primary_function: 'Deepens human texture and moral vocabulary.',
        revision_priority: 'Tie back to river agency.',
      },
      {
        act_name: 'Return to Smokehouse Camp / protocol',
        chapter_range: '26\u201331',
        primary_function: 'Best atmospheric and ceremonial material; strong emotional center.',
        revision_priority: 'High risk of outsider over-access; requires cultural review.',
      },
      {
        act_name: 'River verdict / witness charge',
        chapter_range: '36\u201337',
        primary_function: 'Strong thematic closure; memorable final summons.',
        revision_priority: 'Ending risks over-declaring meaning unless some final mystery remains intact.',
      },
    ],
    criterion_analyses: [
      {
        key: 'concept',
        score: 8.5,
        confidence: 'high',
        finding: 'The river-as-memory/judge premise, filtered through road-trip witness, Indigenous protocol, and corporate extraction, is distinctive and powerful.',
        evidence_anchors: ['river witness frame', 'road-trip structure', 'corporate extraction antagonist'],
      },
      {
        key: 'narrativeDrive',
        score: 7.0,
        confidence: 'high',
        finding: 'Strong opening, return-to-camp arc, and ending; middle research/ledger sections slow pressure.',
        evidence_anchors: ['opening dread', 'Smokehouse return', 'research drag in middle'],
      },
    ],
    layer_analyses: [
      {
        layer_name: 'Road-trip witness layer',
        strength: 'strong',
        needed_revision: 'Maintain outsider vulnerability without over-interpreting scenes.',
      },
      {
        layer_name: 'Smokehouse Camp layer',
        strength: 'excellent',
        needed_revision: 'Cultural review required before treating representation as final.',
      },
      {
        layer_name: 'River agency layer',
        strength: 'strong',
        needed_revision: 'Keep exact but not fully legible.',
      },
    ],
    cross_layer_integration: [
      {
        motif: 'Water as memory and judgment',
        layers_connected: ['River agency', 'Smokehouse Camp', 'Investigation ledger'],
        strength: 'strong',
      },
      {
        motif: 'Dogs as sensory sentinels',
        layers_connected: ['Animal-sensory', 'Road-trip witness', 'River agency'],
        strength: 'strong',
      },
    ],
    symbolic_audit: {
      systems: [
        { symbol: 'River', status: 'central', function: 'Witness, archive, nervous system, judge.' },
        { symbol: 'NV115 / black truck', status: 'needs payoff', function: 'Dread, pursuit, pattern recognition.' },
        { symbol: 'Dogs\u2019 refusals', status: 'strong', function: 'Embodied evidence of danger.' },
        { symbol: 'Smoke / fish / bannock', status: 'strong', function: 'Living social texture and story custody.' },
      ],
    },
    reader_experience: {
      opening: {
        reader_question: 'Why are these travelers anxious, and what is the black truck?',
        emotional_state: 'Road-trip unease, atmospheric dread.',
        risk: 'NV115 thread must pay off or be reframed.',
      },
      midpoint: {
        reader_question: 'Is the river really doing this, or is this paranoia?',
        emotional_state: 'Growing uncertainty between documentary evidence and spiritual possibility.',
        risk: 'Research sections may reduce mystery too early.',
      },
      final_act: {
        reader_question: 'Will Mike accept the witness charge, and at what cost?',
        emotional_state: 'Gravity, ceremony, restraint.',
        risk: 'Ending risks over-declaring meaning.',
      },
      aftertaste: 'The river remains exact but not fully legible.',
    },
    revision_plan: [
      {
        priority: 'P1',
        title: 'Compress the evidence ledger by 15\u201325%.',
        goal: 'Keep strongest case studies; convert rest into tighter dossier pattern.',
        actions: [
          'Identify and remove the weakest 25% of documentary evidence inserts.',
          'Convert remaining inserts into compressed dossier entries.',
        ],
        acceptance_check: 'Pacing improves without losing sense of scale.',
      },
      {
        priority: 'P2',
        title: 'Promote Leanna / Verdant earlier.',
        goal: 'Leanna is too structurally important to arrive late.',
        actions: [
          'Seed Leanna/Verdant pressure in first third.',
          'Connect corporate language to river/community stakes earlier.',
        ],
        acceptance_check: 'External antagonist system has causal presence from midpoint.',
      },
      {
        priority: 'P3',
        title: 'Run witness/ownership revision pass.',
        goal: 'Dramatize narrator restraint more and explain it less.',
        actions: [
          'Ask whether each scene can dramatize refusal, correction, silence, or consequence instead of explanation.',
        ],
        acceptance_check: 'Witness boundary is felt, not lectured.',
      },
    ],
    releasability: [
      {
        dimension: 'Concept',
        current_status: 'Strong, distinctive, marketable',
        verdict: 'Close',
      },
      {
        dimension: 'Central relationship engine',
        current_status: 'Strong Mike/Cliff',
        verdict: 'Ready with trimming',
      },
      {
        dimension: 'Pacing',
        current_status: 'Middle drag from over-evidence',
        verdict: 'Revise',
      },
      {
        dimension: 'Publication readiness',
        current_status: 'Close but not ready',
        verdict: 'Revise before release',
      },
    ],
    acceptance_checks: {
      required_detection: [
        'Mike / Cliff / dogs as travel-family unit',
        'Dogs as animal-sensory detection layer',
        'River agency as symbolic and sensory system',
        'Smokehouse Camp as living social/protocol center',
      ],
      failure_conditions: [
        'Fails if treated as generic eco-thriller.',
        'Fails if dogs treated as decorative pet material.',
        'Fails if river agency over-explained into documentary certainty.',
      ],
    },
    calibration_notes: [
      'Scoring calibrated for literary eco-thriller at 83,779 words.',
      'Cultural/protocol sensitivity review required before treating representation as final.',
    ],
    manuscript_integrity_issues: [],
  } as any;

  return { canonicalDoc, dream };
}

function buildGoldenMythoamphibiaFixture() {
  const criteriaSpine: Array<{ key: string; score: number; confidence: string; finding: string; anchors: string[] }> = [
    { key: 'concept', score: 9.0, confidence: 'high', finding: 'Multi-species civilizational eco-mythology distributing consciousness across humans, amphibians, objects, environments, deities, and collective entities.', anchors: ['distributed consciousness', 'multi-species civilization', 'object memory'] },
    { key: 'narrativeDrive', score: 6.5, confidence: 'moderate-high', finding: 'Multiple powerful engines (Brutus degradation, extinction timer, succession crisis, cross-species contact, Mine possession), but architecture density creates pacing pressure.', anchors: ['Brutus degradation', 'extinction timer', 'Mine possession'] },
    { key: 'character', score: 8.0, confidence: 'high', finding: 'Brutus, Billy, Crown Hyla, Thorander, Zimeon, and Rana form a strong multi-species ensemble with distinct psychological logics.', anchors: ['Brutus', 'Billy', 'Crown Hyla'] },
    { key: 'voice', score: 8.5, confidence: 'high', finding: 'Polyphonic architecture across human, amphibian, object, environmental, divine, and collective POV domains.', anchors: ['polyphonic POV', 'distributed truth', 'object voice'] },
    { key: 'sceneConstruction', score: 7.0, confidence: 'moderate-high', finding: 'Best scenes embody doctrine through action: council debates, human-amphibian contact events, object-consciousness revelations, Mine possession episodes.', anchors: ['council debates', 'contact events', 'object revelations'] },
    { key: 'dialogue', score: 7.0, confidence: 'moderate', finding: 'Dialogue serves political, doctrinal, and ecological functions across species; council debates and Gorf-language exchanges are structurally rich.', anchors: ['council debate', 'Gorf-language', 'Brutus/Billy contrast'] },
    { key: 'theme', score: 9.0, confidence: 'high', finding: 'Dominion versus domination, survival versus purity, extinction, contamination, faith, transformation, kinship, and stewardship are enacted through bodies, water, eggs, glyphs, objects, rituals, and predation.', anchors: ['dominion vs domination', 'contamination', 'stewardship'] },
    { key: 'worldbuilding', score: 9.0, confidence: 'high', finding: 'Aqua World governance, Gorf theology, amphibian metamorphosis biology, object-consciousness memory systems, Mine consciousness, and verse-code infrastructure form the most richly governed world in the native benchmark corpus.', anchors: ['Aqua World', 'Gorf theology', 'verse-code'] },
    { key: 'pacing', score: 6.0, confidence: 'moderate-high', finding: 'The multi-layer architecture and six consciousness domains create legitimate pacing challenge; the ecological timer provides macro-pacing urgency.', anchors: ['layer density', 'verse-code rhythm', 'ecological timer'] },
    { key: 'proseControl', score: 7.5, confidence: 'moderate', finding: 'Grotesque comedy, sacred register, ecological dread, amphibian embodiment, and object-consciousness voice coexist; prose is vivid and distinctive.', anchors: ['grotesque-sacred register', 'amphibian embodiment', 'object voice'] },
    { key: 'tone', score: 7.5, confidence: 'moderate-high', finding: 'Comedy, grotesquerie, horror, sacred language, ecological grief, and political satire operate simultaneously and are mostly governed.', anchors: ['tonal collision', 'sacred-grotesque', 'eco-grief'] },
    { key: 'narrativeClosure', score: 6.5, confidence: 'moderate', finding: 'Succession arc (Zimeon/Rana), extinction timer, Mine possession, and cross-species contact carry forward-facing structural promises; closure is partially open by design.', anchors: ['succession arc', 'extinction timer', 'open by design'] },
    { key: 'marketability', score: 6.0, confidence: 'moderate-high', finding: 'Object-consciousness rules, Triune boundaries, and architecture density need sharper reader-legibility; transmedia/codex hooks must reinforce narrative meaning, not replace it.', anchors: ['reader-legibility', 'transmedia hooks', 'genre-defying scope'] },
  ];

  const canonicalDoc = buildLongFormMultiLayerDocument({
    displayTitle: 'The Lost World of MythOAmphibia / DOMINATUS I',
    result: {
      generated_at: '2026-06-27T20:00:00.000Z',
      overview: {
        overall_score_0_100: 76,
        verdict: 'revise',
        one_paragraph_summary:
          'The Lost World of MythOAmphibia / DOMINATUS I is the most architecturally complex native benchmark: a multi-species civilizational eco-mythology distributing consciousness across humans, amphibians, objects, environments, deities, and collective entities. Concept, literary ambition, and worldbuilding are exceptional; readiness and commercial reach are moderated by the demands the multi-layer architecture places on reader accessibility.',
        top_3_strengths: [
          'Distributed multi-species consciousness across six domains.',
          'The most richly governed world in the native benchmark corpus.',
          'Extraordinary thematic integration of dominion, contamination, and stewardship.',
        ],
        top_3_risks: [
          'Architecture density creates legitimate pacing pressure.',
          'Object-consciousness rules and Triune boundaries need reader-legibility.',
          'Genre-defying scope challenges conventional shelving.',
        ],
      },
      enrichment: {
        trigger_warnings: ['body horror', 'addiction', 'violence', 'ecological collapse', 'possession'],
        premise:
          'A poisoned frog civilization and a degrading human vessel collide as consciousness itself is distributed across bodies, objects, relics, and the dying Realm.',
      },
      metrics: {
        manuscript: {
          title: 'The Lost World of MythOAmphibia / DOMINATUS I',
          word_count: 0,
          genre: 'Mythic Eco-Fantasy / Multi-Species Civilizational Saga / Literary Eco-Horror',
          target_audience:
            'Adult readers of literary fantasy, ecological speculative fiction, multi-species worldbuilding, body-horror-inflected mythic fiction, and transmedia/codex-ready mythos storytelling',
        },
      },
      criteria: criteriaSpine.map((c) => ({
        key: c.key,
        score_0_10: c.score,
        confidence_level: c.confidence.startsWith('high') ? 'high' : 'moderate',
        rationale: c.finding,
        recommendations: [],
      })),
    },
  });

  const dream = {
    dream_scores: { quality: 80, readiness: 62, commercial: 60, literary: 86 },
    executive_verdict:
      'The Lost World of MythOAmphibia / DOMINATUS I distributes consciousness across biological characters, nonhuman societies, objects, environmental systems, sacred artifacts, and divine voices. It must not be flattened into single-species frog fantasy, gross-out horror, environmental allegory, or animal adventure. Its principal challenge is reader-legibility: the architecture is exceptional, but object-consciousness rules and Triune boundaries must register on the page without taxonomic explanation.',
    market_shelf: {
      best_shelf: 'Literary Fantasy / Ecological Speculative Fiction / Mythic Multi-Species Saga',
      marketable_hook: 'A poisoned frog civilization and a degrading human vessel collide as consciousness itself is distributed across bodies, objects, relics, and the dying Realm.',
      shelf_neighbors: ['Mythic eco-fantasy', 'Dark ecological fantasy', 'Literary eco-horror', 'Animal-civilization myth'],
      comparison_space: ['Distributed-consciousness speculative fiction', 'Grotesque-sacred mythos'],
      market_danger: 'The book can be misread as frog fantasy, gross-out horror, environmental allegory, or animal adventure.',
    },
    what_not_to_become: [
      'A single-species frog fantasy that erases the human degradation thread, object consciousness, and distributed Realm awareness.',
      'A genre eco-allegory where the multi-layer architecture is flattened to imaginative worldbuilding without testing institutional, ecological, and consciousness logic.',
    ],
    structural_stack: [
      { layer_name: 'Multi-species consciousness distribution', status: 'strong', function: 'Distributes consciousness across human, amphibian, object, environmental, divine, and collective domains.', revision_note: 'Keep the six domains distinguishable without taxonomic explanation.' },
      { layer_name: 'Object consciousness / relic memory', status: 'strong', function: 'Objects are memory containers, witness devices, shame archives, and ritual vessels.', revision_note: 'Show one limit and one power within each object\u2019s first consciousness scene.' },
      { layer_name: 'Frog civilization / amphibian governance', status: 'strong', function: 'Frog civilization as governed culture with institutions, not novelty or costume.', revision_note: 'Dramatize council and doctrine through action.' },
      { layer_name: 'Ecological collapse / extinction pressure', status: 'moderate', function: 'Contamination-as-causality drives the macro-pacing extinction timer.', revision_note: 'Foreground egg-failure, blight, and habitat-collapse as felt urgency.' },
      { layer_name: 'Mine consciousness / Triune distributed entity', status: 'moderate', function: 'Darkness, Dampness, and Silence operate as coordinated entity forces.', revision_note: 'Keep the Triune internally differentiated and legible.' },
      { layer_name: 'Brutus degradation / possession architecture', status: 'strong', function: 'Tracks possession and bodily transformation across ecological, mythic, and bodily systems.', revision_note: 'Position Billy as the human-scale witness to the degradation architecture.' },
      { layer_name: 'Divine / Gorf / religious authority architecture', status: 'moderate', function: 'Religious authority and doctrinal drift govern the mythos.', revision_note: 'Keep divine ambiguity exact but not over-explained.' },
    ],
    arc_map: [
      { act_name: 'Contact pressure / human entry', chapter_range: '1\u20133', primary_function: 'Establishes human-amphibian contact and Brutus/Billy vulnerability.', revision_priority: 'Billy witness-POV must be structurally legible.' },
      { act_name: 'Civilization and doctrine', chapter_range: '4\u201310', primary_function: 'Expands frog governance, Gorf theology, and object memory.', revision_priority: 'Avoid exposition; dramatize institutions.' },
      { act_name: 'Degradation and possession', chapter_range: '11\u201320', primary_function: 'Brutus possession deepens; Mine/Triune pressure rises.', revision_priority: 'Keep Triune differentiation legible.' },
      { act_name: 'Extinction timer / succession', chapter_range: '21\u201330', primary_function: 'Ecological collapse and Zimeon/Rana succession converge.', revision_priority: 'Foreground contamination-as-causality.' },
    ],
    criterion_analyses: criteriaSpine.map((c) => ({
      key: c.key,
      score: c.score,
      confidence: c.confidence,
      finding: c.finding,
      evidence_anchors: c.anchors,
    })),
    layer_analyses: [
      { layer_name: 'Multi-species consciousness distribution', strength: 'excellent', needed_revision: 'Keep all six domains distinguishable without taxonomic explanation.' },
      { layer_name: 'Object consciousness / relic memory', strength: 'strong', needed_revision: 'Establish object rules early (one limit, one power).' },
      { layer_name: 'Brutus degradation / possession architecture', strength: 'strong', needed_revision: 'Anchor Billy as human-scale reader access.' },
    ],
    cross_layer_integration: [
      { motif: 'Contamination as causality', layers_connected: ['Ecological collapse', 'Brutus degradation', 'Mine consciousness'], strength: 'strong' },
      { motif: 'Distributed memory and witness', layers_connected: ['Object consciousness', 'Frog civilization', 'Divine authority'], strength: 'strong' },
    ],
    symbolic_audit: {
      systems: [
        { symbol: 'Toadstone', status: 'central', function: 'Authority, memory, and doctrinal power.' },
        { symbol: 'Boot / McDiaper', status: 'strong', function: 'Object consciousness and shame archive.' },
        { symbol: 'The Mine', status: 'needs legibility', function: 'Environmental possession vector via the Triune.' },
        { symbol: 'Eggs / water', status: 'strong', function: 'Ecological continuity and extinction pressure.' },
      ],
    },
    reader_experience: {
      opening: {
        reader_question: 'Whose consciousness governs this world, and how many kinds are there?',
        emotional_state: 'Estranged wonder and ecological dread.',
        risk: 'Object-consciousness rules must register early.',
      },
      midpoint: {
        reader_question: 'Is Brutus a villain, a vessel, or a victim of possession?',
        emotional_state: 'Mounting body-horror and moral ambiguity.',
        risk: 'Triune boundaries may blur without internal differentiation.',
      },
      final_act: {
        reader_question: 'Can the civilization survive contamination and succession?',
        emotional_state: 'Mythic gravity and ecological grief.',
        risk: 'Closure is open by design; promises must still feel kept.',
      },
      aftertaste: 'The truth of the manuscript is distributed; no single narrator owns truth.',
    },
    revision_plan: [
      {
        priority: 'P1',
        title: 'Clarify object-consciousness rules.',
        goal: 'Each object with POV shows one limit and one power within its first consciousness scene.',
        actions: ['Establish object rules on first appearance.', 'Avoid over-rationalizing governed strangeness.'],
        acceptance_check: 'Readers accept object consciousness without exposition.',
      },
      {
        priority: 'P1',
        title: 'Strengthen Billy witness-POV structural function.',
        goal: 'Position Billy as the human-scale reader access point to the degradation architecture.',
        actions: ['Frame Billy\u2019s perception of Brutus\u2019s transformation as structural access, not only friendship.'],
        acceptance_check: 'Billy reads as witness POV, not sidekick.',
      },
      {
        priority: 'P2',
        title: 'Foreground the ecological extinction timer.',
        goal: 'Contamination-as-causality must drive pacing, not merely theme.',
        actions: ['Make egg-failure, blight, and habitat-collapse create felt urgency.'],
        acceptance_check: 'Ecological timer produces structural urgency.',
      },
      {
        priority: 'P2',
        title: 'Clarify Triune consciousness boundaries.',
        goal: 'Darkness, Dampness, and Silence read as coordinated forces with different functions.',
        actions: ['Differentiate the Triune internally without taxonomic explanation.'],
        acceptance_check: 'Distributed consciousness shows internal differentiation.',
      },
    ],
    releasability: [
      { dimension: 'Concept', current_status: 'Exceptional, genre-defining scope', verdict: 'Strong' },
      { dimension: 'Distributed multi-species consciousness', current_status: 'Bold and distinctive', verdict: 'Strong' },
      { dimension: 'Reader accessibility', current_status: 'Architecture density challenges legibility', verdict: 'Revise' },
      { dimension: 'Publication readiness', current_status: 'Ambition exceeds current accessibility', verdict: 'Revise before release' },
    ],
    acceptance_checks: {
      required_detection: [
        'Multi-species consciousness across all six domains',
        'Object consciousness as memory and witness, not props',
        'Frog civilization as governed culture with institutions',
        'Brutus possession/degradation architecture',
      ],
      failure_conditions: [
        'Fails if flattened to single-species frog fantasy.',
        'Fails if objects treated as props.',
        'Fails if fewer than four of six consciousness domains are detected.',
      ],
    },
    calibration_notes: [
      'Scores derived from the MythOAmphibia canon-corrected truth target.',
      'Benchmark tier is required-gold candidate pending full-manuscript grounding.',
    ],
    manuscript_integrity_issues: [],
  } as any;

  return { canonicalDoc, dream };
}

function buildGoldenDraculaFixture() {
  const canonicalDoc = buildLongFormMultiLayerDocument({
    displayTitle: 'Dracula',
    result: {
      generated_at: '2026-07-05T10:00:00.000Z',
      overview: {
        overall_score_0_100: 87,
        verdict: 'publish',
        one_paragraph_summary:
          'Dracula is a benchmark long-form Gothic novel because its terror is not carried by plot alone, but by document architecture. The novel is built as a curated dossier: journals, letters, newspaper cuttings, diaries, phonograph records, memoranda, travel notes, and medical/legal evidence are arranged to make an impossible supernatural event feel procedurally verified.',
        top_3_strengths: [
          'Epistolary evidence-assembly architecture.',
          'Multi-document, multi-voice form.',
          'Castle opening and Lucy/Mina escalation.',
        ],
        top_3_risks: [
          'Middle-act procedural drag after the central threat is understood.',
          'Some late teamwork dialogue becomes explanatory.',
          'Dracula remains more symbolic predator than psychologically developed antagonist.',
        ],
      },
      enrichment: {
        premise:
          'A foreign aristocratic predator enters modern England and is defeated by a coalition of lovers, doctors, lawyers, investigators, religious knowledge, and documentary evidence.',
        trigger_warnings: ['violence', 'blood', 'death', 'predation', 'possession'],
      },
      metrics: {
        manuscript: {
          title: 'Dracula',
          word_count: 160000,
          genre: 'Adult Gothic Horror / Epistolary Supernatural Thriller',
          target_audience: 'Adult readers of Gothic horror, epistolary supernatural thriller, Victorian literature, and documentary terror',
        },
      },
      criteria: [
        {
          key: 'concept',
          score_0_10: 9.5,
          confidence_level: 'high',
          rationale: 'One of the strongest genre premises in Gothic fiction: ancient predation enters modern bureaucratic, medical, legal, and technological England.',
          recommendations: [],
        },
        {
          key: 'narrativeDrive',
          score_0_10: 8,
          confidence_level: 'high',
          rationale: 'Castle opening and Lucy/Mina escalation are superb; middle evidence-gathering has purposeful but real drag.',
          recommendations: [],
        },
      ],
    },
  });

  const dream = {
    dream_scores: { quality: 87, readiness: 94, commercial: null, literary: null },
    executive_verdict:
      'Dracula is a benchmark long-form Gothic novel because its terror is not carried by plot alone, but by document architecture. The novel fuses ancient contamination myth with modern evidence systems: shorthand, trains, maps, phonographs, typewriting, legal documents, medical diagnosis, blood transfusion logic, newspaper evidence, shipping logs, and property records all become tools in a fight against a premodern predator.',
    market_shelf: {
      best_shelf: 'Gothic Horror / Epistolary Supernatural Thriller / Victorian Literature',
      marketable_hook: 'One of the strongest genre premises in Gothic fiction: ancient predation enters modern bureaucratic, medical, legal, and technological England.',
      shelf_neighbors: ['Gothic horror', 'Epistolary novel', 'Victorian supernatural thriller'],
      comparison_space: ['Documentary terror', 'Vampire literature'],
      market_danger: 'The book can be misread as simple vampire adventure; its true architecture is documentary terror.',
    },
    what_not_to_become: [
      'It should not be evaluated as a simple vampire adventure; its true architecture is documentary terror.',
      'A generic supernatural action novel that ignores the epistolary evidence-assembly form.',
    ],
    structural_stack: [
      {
        layer_name: 'Epistolary evidence-assembly architecture',
        status: 'exceptional',
        function: 'The novel is built as a curated dossier: journals, letters, newspaper cuttings, diaries, phonograph records, memoranda.',
        revision_note: 'The form is the engine, not decoration.',
      },
      {
        layer_name: 'Multi-document, multi-voice form',
        status: 'exceptional',
        function: 'Multiple narrators create triangulated evidence of impossible events.',
        revision_note: 'Each document adds a distinct voice and evidentiary weight.',
      },
      {
        layer_name: 'Castle opening and Lucy/Mina escalation',
        status: 'strong',
        function: 'Gothic dread, domestic invasion, and contamination arc.',
        revision_note: 'Maintains urgency through personal danger.',
      },
      {
        layer_name: 'Middle-act procedural pursuit',
        status: 'purposeful but drag-prone',
        function: 'Evidence-gathering and team-coordination after threat is identified.',
        revision_note: 'Middle dossier/pursuit mechanics are occasionally over-extended.',
      },
    ],
    arc_map: [
      {
        act_name: 'Act I\u2014Castle and Journey',
        chapter_range: '1-4',
        primary_function: 'Jonathan Harker enters Dracula\u2019s domain; escalating dread and imprisonment.',
        revision_priority: 'Maintain atmospheric tension.',
      },
      {
        act_name: 'Act II\u2014Lucy and Domestic Invasion',
        chapter_range: '5-14',
        primary_function: 'Dracula arrives in England; Lucy\u2019s contamination and decline.',
        revision_priority: 'Sustain dread through medical/romantic frame.',
      },
      {
        act_name: 'Act III\u2014Pursuit and Evidence Assembly',
        chapter_range: '15-27',
        primary_function: 'Team assembles evidence, tracks earth boxes, pursues Dracula back to Transylvania.',
        revision_priority: 'Maintain propulsion despite procedural detail.',
      },
    ],
    criterion_analyses: [
      { key: 'concept', score: 9.5, confidence: 'high', fit_evidence: ['Ancient predation meets modern bureaucratic/medical/legal England.'], gap_evidence: [], revision_queue: [] },
      { key: 'narrativeDrive', score: 8, confidence: 'high', fit_evidence: ['Castle opening and Lucy/Mina escalation are superb.'], gap_evidence: ['Middle evidence-gathering has purposeful but real drag.'], revision_queue: [] },
      { key: 'character', score: 8, confidence: 'high', fit_evidence: ['Mina, Jonathan, Seward, Lucy, Van Helsing, Renfield, Dracula perform distinct roles.'], gap_evidence: ['Some men become functionally grouped in pursuit phase.'], revision_queue: [] },
      { key: 'voice', score: 9.5, confidence: 'high', fit_evidence: ['Multi-document, multi-voice form is the novel\u2019s defining craft triumph.'], gap_evidence: [], revision_queue: [] },
      { key: 'sceneConstruction', score: 8.5, confidence: 'high', fit_evidence: ['Major scenes carry dread, evidence, symbolic escalation, and plot movement.'], gap_evidence: ['Some procedural scenes are thinner as drama.'], revision_queue: [] },
      { key: 'dialogue', score: 7.5, confidence: 'moderate-high', fit_evidence: ['Dracula, Van Helsing, Renfield, and the social voices are distinct.'], gap_evidence: ['Some late teamwork dialogue becomes explanatory.'], revision_queue: [] },
      { key: 'theme', score: 9, confidence: 'high', fit_evidence: ['Blood, purity, contagion, empire, gender, faith, science, foreignness, technology, and appetite interlock.'], gap_evidence: [], revision_queue: [] },
      { key: 'worldbuilding', score: 8.5, confidence: 'high', fit_evidence: ['Vampire rules, thresholds, earth boxes, garlic, crucifix, host, daylight, wolves, fog, and blood logic remain coherent.'], gap_evidence: [], revision_queue: [] },
      { key: 'pacing', score: 7.5, confidence: 'high', fit_evidence: ['Opening and ending are powerful.'], gap_evidence: ['Middle dossier/pursuit mechanics are occasionally over-extended.'], revision_queue: [] },
      { key: 'proseControl', score: 8.5, confidence: 'high', fit_evidence: ['Strong Gothic atmospherics, especially landscape, animal sound, blood/body horror, and dread escalation.'], gap_evidence: [], revision_queue: [] },
      { key: 'tone', score: 9, confidence: 'high', fit_evidence: ['Sustains dread, moral seriousness, scientific urgency, and religious terror with remarkable control.'], gap_evidence: [], revision_queue: [] },
      { key: 'narrativeClosure', score: 8.5, confidence: 'high', fit_evidence: ['The pursuit resolves the central threat and Mina\u2019s contamination ledger.'], gap_evidence: ['Dracula himself remains more symbolic predator than psychologically developed antagonist.'], revision_queue: [] },
      { key: 'marketability', score: 10, confidence: 'high', fit_evidence: ['Genre-defining, culturally durable, structurally teachable benchmark text.'], gap_evidence: [], revision_queue: [] },
    ],
    layer_analyses: [
      { layer_name: 'Documentary evidence layer', status: 'exceptional', needed_revision: 'None needed; this is the defining structural achievement.' },
      { layer_name: 'Gothic contamination layer', status: 'strong', needed_revision: 'Maintain balance between symbolic terror and procedural pursuit.' },
      { layer_name: 'Pursuit/team layer', status: 'purposeful but drag-prone', needed_revision: 'Middle pursuit could be compressed without losing evidentiary weight.' },
    ],
    cross_layer_integration: [
      { motif: 'Blood/transfusion', description: 'Medical intervention carries symbolic, romantic, and contamination weight.', integration_quality: 'strong', revision_note: 'Blood is never merely physical.' },
      { motif: 'Document/evidence', description: 'Every document type carries different evidentiary and emotional authority.', integration_quality: 'exceptional', revision_note: 'Form is plot.' },
    ],
    symbolic_audit: {
      preserved_symbols: [
        { symbol: 'Earth boxes', current_function: 'Tactical constraint and spatial governance of the vampire.', revision_instruction: 'Maintain as plot-functional, not decorative.' },
        { symbol: 'Mina\u2019s typewriter', current_function: 'Modern evidence technology opposing ancient predation.', revision_instruction: 'Technology as weapon and witness.' },
      ],
      doctrine_strengths: ['Documentary form as terror engine.', 'Multi-voice evidence assembly.'],
      doctrine_risks: ['Middle procedural detail can dilute dread.'],
      audit_conclusion: 'Symbolic architecture is genre-defining; primary risk is procedural expansion in middle act.',
    },
    reader_experience: {
      first_act: { reader_question: 'Can Jonathan escape the castle?', emotional_state: 'Escalating Gothic dread.', risk: 'None\u2014this is among the strongest openings in Gothic fiction.' },
      middle: { reader_question: 'Can the team assemble enough evidence to stop Dracula?', emotional_state: 'Procedural urgency mixed with contamination anxiety.', risk: 'Evidence-gathering may slow dread.' },
      final_act: { reader_question: 'Can they reach Dracula before Mina\u2019s contamination is irreversible?', emotional_state: 'Chase urgency and spiritual danger.', risk: 'Pursuit is well-governed but Dracula\u2019s interiority remains symbolic.' },
      aftertaste: 'Form can be plot: the dossier is not packaging; it is the engine.',
    },
    revision_plan: [
      { priority: 'P1', title: 'Maintain documentary form integrity', goal: 'Preserve the epistolary evidence-assembly architecture.', actions: ['No revision needed\u2014calibration benchmark.'], acceptance_check: 'Documentary form remains the primary engine.' },
    ],
    releasability: [
      { dimension: 'Concept', current_status: 'Genre-defining', verdict: 'Strong' },
      { dimension: 'Epistolary evidence-assembly architecture', current_status: 'Exceptional and structurally teachable', verdict: 'Strong' },
      { dimension: 'Publication readiness', current_status: 'Canonical benchmark text', verdict: 'Strong' },
    ],
    acceptance_checks: {
      required_detection: [
        'Epistolary evidence-assembly architecture',
        'Multi-document, multi-voice form',
        'Castle opening and Lucy/Mina escalation',
        'Gothic contamination and blood logic',
      ],
      failure_conditions: [
        'Fails if evaluated as simple vampire adventure.',
        'Fails if documentary form is treated as decoration.',
      ],
    },
    calibration_notes: [
      'Scores derived from the Dracula DREAM public-domain calibration benchmark.',
      'Benchmark tier is calibration-only; does not govern production runtime.',
    ],
    manuscript_integrity_issues: [],
  } as any;

  return { canonicalDoc, dream };
}

function buildGoldenGreatExpectationsFixture() {
  const canonicalDoc = buildLongFormMultiLayerDocument({
    displayTitle: 'Great Expectations',
    result: {
      generated_at: '2026-07-05T10:00:00.000Z',
      overview: {
        overall_score_0_100: 89,
        verdict: 'publish',
        one_paragraph_summary:
          'Great Expectations is a benchmark bildungsroman because its architecture converts class aspiration into moral revelation and repair. An orphan\u2019s sudden rise into gentlemanly expectations exposes the cruelty of class shame, the false glamour of status, and the saving force of loyalty, remorse, and chosen kinship.',
        top_3_strengths: [
          'Shame/class/moral-education architecture.',
          'Retrospective first-person voice fuses adult irony with child perception.',
          'Magwitch reveal and final pursuit.',
        ],
        top_3_risks: [
          'Serial-middle expansion occasionally slows the central shame/revelation engine.',
          'Estella ending remains softened/ambiguous depending on edition.',
          'Some serial breadth exceeds core pressure.',
        ],
      },
      enrichment: {
        premise:
          'An orphan\u2019s social ascent reveals the corruption of shame and the hidden nobility of loyalty, labor, and remorse.',
        trigger_warnings: ['violence', 'child abuse', 'class shame', 'grief'],
      },
      metrics: {
        manuscript: {
          title: 'Great Expectations',
          word_count: 183000,
          genre: 'Adult Literary Bildungsroman / Social-Moral Novel',
          target_audience: 'Adult readers of literary bildungsroman, social-moral novel, classic coming-of-age, class/identity novel, and moral psychological fiction',
        },
      },
      criteria: [
        {
          key: 'concept',
          score_0_10: 9.5,
          confidence_level: 'high',
          rationale: 'A powerful moral premise: an orphan\u2019s social ascent reveals the corruption of shame and the hidden nobility of loyalty, labor, and remorse.',
          recommendations: [],
        },
        {
          key: 'narrativeDrive',
          score_0_10: 8,
          confidence_level: 'high',
          rationale: 'The opening, Satis House initiation, expectations announcement, Magwitch reveal, and final pursuit provide strong propulsion; some serial middle material dilates.',
          recommendations: [],
        },
      ],
    },
  });

  const dream = {
    dream_scores: { quality: 89, readiness: 95, commercial: null, literary: null },
    executive_verdict:
      'Great Expectations is a benchmark bildungsroman because its architecture converts class aspiration into moral revelation and repair. Pip\u2019s shame, self-deception, guilt, tenderness, vanity, fear, remorse, and moral recovery are deeply coherent. The retrospective first-person voice fuses adult irony with child perception and moral self-indictment.',
    market_shelf: {
      best_shelf: 'Literary Bildungsroman / Social-Moral Novel / Class/Identity Fiction',
      marketable_hook: 'A powerful moral premise: an orphan\u2019s social ascent reveals the corruption of shame and the hidden nobility of loyalty, labor, and remorse.',
      shelf_neighbors: ['Literary bildungsroman', 'Social-moral novel', 'Classic coming-of-age'],
      comparison_space: ['Class/identity novel', 'Moral psychological fiction'],
      market_danger: 'The book can be misread as simple rise-and-fall social mobility plot.',
    },
    what_not_to_become: [
      'It should not be evaluated as a simple rise-and-fall social mobility plot; its real engine is shame, misrecognition, and moral education.',
      'It should not reduce Miss Havisham to Gothic eccentricity; she is a wound-system that manufactures Estella and miseducates Pip.',
    ],
    structural_stack: [
      {
        layer_name: 'Shame/class/moral-education architecture',
        status: 'exceptional',
        function: 'The novel converts class aspiration into moral revelation and repair.',
        revision_note: 'This is the defining structural achievement.',
      },
      {
        layer_name: 'Retrospective first-person voice fuses adult irony with child perception',
        status: 'exceptional',
        function: 'Voice carries moral self-indictment, comedy, and compassion simultaneously.',
        revision_note: 'Voice is never merely stylistic; it is moral architecture.',
      },
      {
        layer_name: 'Magwitch reveal and final pursuit',
        status: 'strong',
        function: 'Transforms the expectation plot into moral reversal and recognition.',
        revision_note: 'The reveal restructures every prior event.',
      },
      {
        layer_name: 'Serial-middle expansion',
        status: 'purposeful but occasionally dilating',
        function: 'Social breadth and London life build class texture.',
        revision_note: 'Some serial breadth exceeds core pressure.',
      },
    ],
    arc_map: [
      {
        act_name: 'Act I\u2014Forge, Marsh, and Satis House',
        chapter_range: '1-19',
        primary_function: 'Pip\u2019s childhood: convict encounter, class shame initiation, Satis House miseducation.',
        revision_priority: 'Maintain moral injury and comic precision.',
      },
      {
        act_name: 'Act II\u2014London Expectations',
        chapter_range: '20-39',
        primary_function: 'Gentlemanly London life: shame denial, spending, social performance, growing moral vacancy.',
        revision_priority: 'Compress serial expansion without losing class texture.',
      },
      {
        act_name: 'Act III\u2014Magwitch, Revelation, and Moral Recovery',
        chapter_range: '40-59',
        primary_function: 'The true benefactor revealed; shame becomes gratitude; moral education completes.',
        revision_priority: 'Sustain moral pressure through pursuit and trial.',
      },
    ],
    criterion_analyses: [
      { key: 'concept', score: 9.5, confidence: 'high', fit_evidence: ['Powerful moral premise converting class aspiration into moral revelation.'], gap_evidence: [], revision_queue: [] },
      { key: 'narrativeDrive', score: 8, confidence: 'high', fit_evidence: ['Opening, Satis House, expectations announcement, Magwitch reveal provide strong propulsion.'], gap_evidence: ['Serial middle material dilates.'], revision_queue: [] },
      { key: 'character', score: 9.5, confidence: 'high', fit_evidence: ['Pip\u2019s shame, self-deception, guilt, tenderness, vanity, fear, remorse, and moral recovery are deeply coherent.'], gap_evidence: [], revision_queue: [] },
      { key: 'voice', score: 9.5, confidence: 'high', fit_evidence: ['Retrospective first-person voice fuses adult irony with child perception and moral self-indictment.'], gap_evidence: [], revision_queue: [] },
      { key: 'sceneConstruction', score: 9, confidence: 'high', fit_evidence: ['Major scenes perform multiple functions: plot, class pressure, symbolic setup, voice, moral injury.'], gap_evidence: [], revision_queue: [] },
      { key: 'dialogue', score: 9, confidence: 'high', fit_evidence: ['Joe, Jaggers, Wemmick, Miss Havisham, Estella, Magwitch, and Pip all speak from distinct pressures.'], gap_evidence: [], revision_queue: [] },
      { key: 'theme', score: 9.5, confidence: 'high', fit_evidence: ['Shame, gratitude, class, justice, money, gentility, guilt, love, labor, and moral education interlock.'], gap_evidence: [], revision_queue: [] },
      { key: 'worldbuilding', score: 8.5, confidence: 'high', fit_evidence: ['Marsh, forge, Satis House, London law offices, Barnard\u2019s Inn, Newgate, river pursuit form coherent social geography.'], gap_evidence: [], revision_queue: [] },
      { key: 'pacing', score: 8, confidence: 'moderate-high', fit_evidence: ['Serial breadth is a strength and a drag.'], gap_evidence: ['The novel\u2019s middle occasionally expands beyond core pressure.'], revision_queue: [] },
      { key: 'proseControl', score: 9.5, confidence: 'high', fit_evidence: ['Extraordinary comic, tactile, visual, and moral prose control; the opening marsh sequence is a masterclass.'], gap_evidence: [], revision_queue: [] },
      { key: 'tone', score: 9, confidence: 'high', fit_evidence: ['Satire, terror, comedy, sentiment, legal coldness, social shame, and moral tenderness remain governed.'], gap_evidence: [], revision_queue: [] },
      { key: 'narrativeClosure', score: 8.5, confidence: 'high', fit_evidence: ['Pip\u2019s moral ledger closes strongly.'], gap_evidence: ['Estella ending remains softened/ambiguous depending on edition.'], revision_queue: [] },
      { key: 'marketability', score: 10, confidence: 'high', fit_evidence: ['Canonical, culturally durable, structurally teachable novel of moral education and class illusion.'], gap_evidence: [], revision_queue: [] },
    ],
    layer_analyses: [
      { layer_name: 'Shame/moral-education layer', status: 'exceptional', needed_revision: 'None\u2014this is the defining structural achievement.' },
      { layer_name: 'Class/money/aspiration layer', status: 'strong', needed_revision: 'Some serial expansion could be compressed.' },
      { layer_name: 'Criminal/legal/justice layer', status: 'strong', needed_revision: 'Magwitch and Newgate material is powerful.' },
    ],
    cross_layer_integration: [
      { motif: 'Hands', description: 'Pip\u2019s shame about his hands carries class, labor, guilt, and moral recognition.', integration_quality: 'exceptional', revision_note: 'Hands are never merely descriptive.' },
      { motif: 'Fire/forge', description: 'The forge represents honest labor, Joe\u2019s love, and the life Pip rejects then recovers.', integration_quality: 'strong', revision_note: 'Fire carries class dignity.' },
    ],
    symbolic_audit: {
      preserved_symbols: [
        { symbol: 'Satis House', current_function: 'Wound-system that manufactures Estella and miseducates Pip.', revision_instruction: 'Never reduce to Gothic eccentricity.' },
        { symbol: 'The convict leg-iron', current_function: 'Hidden connection between shame, gratitude, crime, and gentility.', revision_instruction: 'The iron links childhood to revelation.' },
      ],
      doctrine_strengths: ['Moral psychology as plot architecture.', 'Class shame as causal engine.'],
      doctrine_risks: ['Serial middle can dilute shame pressure.'],
      audit_conclusion: 'Symbolic architecture is exceptional; primary cost is serial-middle expansion.',
    },
    reader_experience: {
      first_act: { reader_question: 'What will the expectations do to Pip?', emotional_state: 'Excitement poisoned by class shame.', risk: 'None\u2014opening is among the strongest in English fiction.' },
      middle: { reader_question: 'Will Pip recognize his moral vacancy before it\u2019s too late?', emotional_state: 'Growing unease under London performance.', risk: 'Serial breadth may slow core pressure.' },
      final_act: { reader_question: 'Can Pip recover moral clarity and repay what he owes?', emotional_state: 'Gratitude, remorse, and recognition.', risk: 'Estella ending softens consequence.' },
      aftertaste: 'A DREAM evaluator must detect moral psychology as plot architecture, not merely character description.',
    },
    revision_plan: [
      { priority: 'P1', title: 'Maintain shame/moral-education architecture', goal: 'Preserve the class-aspiration-to-moral-revelation structure.', actions: ['No revision needed\u2014calibration benchmark.'], acceptance_check: 'Moral education remains the plot engine.' },
    ],
    releasability: [
      { dimension: 'Concept', current_status: 'Powerful moral premise', verdict: 'Strong' },
      { dimension: 'Shame/class/moral-education architecture', current_status: 'Exceptional and structurally teachable', verdict: 'Strong' },
      { dimension: 'Publication readiness', current_status: 'Canonical benchmark text', verdict: 'Strong' },
    ],
    acceptance_checks: {
      required_detection: [
        'Shame/class/moral-education architecture',
        'Retrospective first-person voice fuses adult irony with child perception',
        'Magwitch reveal and final pursuit',
        'Class aspiration converting into moral revelation',
      ],
      failure_conditions: [
        'Fails if evaluated as simple social mobility plot.',
        'Fails if Miss Havisham reduced to Gothic eccentricity.',
      ],
    },
    calibration_notes: [
      'Scores derived from the Great Expectations DREAM public-domain calibration benchmark.',
      'Benchmark tier is calibration-only; does not govern production runtime.',
    ],
    manuscript_integrity_issues: [],
  } as any;

  return { canonicalDoc, dream };
}

function buildGoldenPrideAndPrejudiceFixture() {
  const canonicalDoc = buildLongFormMultiLayerDocument({
    displayTitle: 'Pride and Prejudice',
    result: {
      generated_at: '2026-07-05T10:00:00.000Z',
      overview: {
        overall_score_0_100: 92,
        verdict: 'publish',
        one_paragraph_summary:
          'Pride and Prejudice is a benchmark social comedy / courtship novel in which an intelligent young woman and a proud aristocratic man must revise their judgments of each other while marriage economics, inheritance law, family reputation, class performance, and social gossip determine the stakes of every private feeling.',
        top_3_strengths: [
          'Social-perception architecture.',
          'Free indirect discourse and ironic narration.',
          'Elizabeth/Darcy reciprocal correction.',
        ],
        top_3_risks: [
          'Late remediation of the Lydia/Wickham crisis is partly offstage.',
          'Comic closure contains consequences more neatly than harsher realist treatment would.',
          'Some repeated visit/report rhythms.',
        ],
      },
      enrichment: {
        premise:
          'Marriage, money, rank, and misjudgment force moral education inside a comic courtship structure.',
        trigger_warnings: ['social shame', 'elopement scandal', 'class pressure'],
      },
      metrics: {
        manuscript: {
          title: 'Pride and Prejudice',
          word_count: 121762,
          genre: 'Adult Literary Social Comedy / Courtship Novel',
          target_audience: 'Adult readers of literary social comedy, courtship novel, Regency fiction, and moral/satirical novels of manners',
        },
      },
      criteria: [
        {
          key: 'concept',
          score_0_10: 9,
          confidence_level: 'high',
          rationale: 'A brilliantly durable social premise: marriage, money, rank, and misjudgment force moral education inside a comic courtship structure.',
          recommendations: [],
        },
        {
          key: 'narrativeDrive',
          score_0_10: 8.5,
          confidence_level: 'high',
          rationale: 'The novel generates propulsion through visits, proposals, letters, journeys, scandal, and social reversals.',
          recommendations: [],
        },
      ],
    },
  });

  const dream = {
    dream_scores: { quality: 92, readiness: 96, commercial: null, literary: null },
    executive_verdict:
      'Pride and Prejudice is a benchmark social comedy because social perception can be plot, and dialogue, manners, letters, visits, houses, and reputation can carry full narrative causality. Elizabeth and Darcy undergo precise reciprocal correction while marriage economics, inheritance law, family reputation, and class performance determine the stakes of every private feeling.',
    market_shelf: {
      best_shelf: 'Literary Social Comedy / Courtship Novel / Novel of Manners',
      marketable_hook: 'A brilliantly durable social premise: marriage, money, rank, and misjudgment force moral education inside a comic courtship structure.',
      shelf_neighbors: ['Literary social comedy', 'Courtship novel', 'Regency fiction'],
      comparison_space: ['Novel of manners', 'Moral/satirical social fiction'],
      market_danger: 'The book can be misread as generic enemies-to-lovers romance.',
    },
    what_not_to_become: [
      'It should not be evaluated as a generic enemies-to-lovers romance; the romance is inseparable from social intelligence, money, family exposure, and self-correction.',
      'It should not treat marriage as decorative reward; marriage is the period\u2019s economic, social, and reputational pressure system.',
    ],
    structural_stack: [
      {
        layer_name: 'Social-perception architecture',
        status: 'exceptional',
        function: 'The novel converts seeing, judging, misreading, and revising judgment into the plot engine.',
        revision_note: 'Perception is plot.',
      },
      {
        layer_name: 'Free indirect discourse and ironic narration',
        status: 'exceptional',
        function: 'Narration carries Elizabeth-aligned misperception and authorial irony simultaneously.',
        revision_note: 'Voice is controlled at master level.',
      },
      {
        layer_name: 'Elizabeth/Darcy reciprocal correction',
        status: 'exceptional',
        function: 'Both protagonists must revise their social judgments through evidence, humiliation, and self-knowledge.',
        revision_note: 'Correction is mutual, not one-directional.',
      },
      {
        layer_name: 'Marriage-economy integration',
        status: 'strong',
        function: 'Every major relationship is shaped by economic and reputational constraints.',
        revision_note: 'Marriage is never merely romantic.',
      },
    ],
    arc_map: [
      {
        act_name: 'Act I\u2014First Impressions and Misjudgments',
        chapter_range: '1-23',
        primary_function: 'Balls, visits, proposals, and letters establish social geography and initial judgments.',
        revision_priority: 'Maintain comic precision and social pressure.',
      },
      {
        act_name: 'Act II\u2014Evidence Revision and Pemberley',
        chapter_range: '24-42',
        primary_function: 'Darcy\u2019s letter, Pemberley visit, and Wickham\u2019s exposure revise Elizabeth\u2019s judgment.',
        revision_priority: 'Maintain revelation momentum.',
      },
      {
        act_name: 'Act III\u2014Crisis, Remediation, and Resolution',
        chapter_range: '43-61',
        primary_function: 'Lydia/Wickham scandal, Darcy\u2019s intervention, and dual marriage resolution.',
        revision_priority: 'Maintain stakes through comic closure.',
      },
    ],
    criterion_analyses: [
      { key: 'concept', score: 9, confidence: 'high', fit_evidence: ['Brilliantly durable social premise with marriage, money, rank, and misjudgment.'], gap_evidence: [], revision_queue: [] },
      { key: 'narrativeDrive', score: 8.5, confidence: 'high', fit_evidence: ['Propulsion through visits, proposals, letters, journeys, scandal, and social reversals.'], gap_evidence: ['Some early visit/ball economy may feel low-action until consequences clarify.'], revision_queue: [] },
      { key: 'character', score: 9.5, confidence: 'high', fit_evidence: ['Elizabeth and Darcy undergo precise reciprocal correction; each secondary character exposes a different pressure.'], gap_evidence: [], revision_queue: [] },
      { key: 'voice', score: 10, confidence: 'high', fit_evidence: ['Free indirect discourse, ironic narration, and Elizabeth-aligned misperception controlled at master level.'], gap_evidence: [], revision_queue: [] },
      { key: 'sceneConstruction', score: 9.5, confidence: 'high', fit_evidence: ['Major scenes perform courtship, class exposure, comic pressure, misdirection, evidence revision simultaneously.'], gap_evidence: [], revision_queue: [] },
      { key: 'dialogue', score: 10, confidence: 'high', fit_evidence: ['Dialogue is the novel\u2019s combat system: self-revelation, class assertion, flirtation, evasion, coercion, and moral correction.'], gap_evidence: [], revision_queue: [] },
      { key: 'theme', score: 9.5, confidence: 'high', fit_evidence: ['Pride, prejudice, rank, money, marriage, family failure, self-knowledge, reputation, and moral generosity are inseparable from plot.'], gap_evidence: [], revision_queue: [] },
      { key: 'worldbuilding', score: 8.5, confidence: 'high', fit_evidence: ['Longbourn, Netherfield, Meryton, Rosings, Pemberley, London, Brighton form coherent social geography.'], gap_evidence: [], revision_queue: [] },
      { key: 'pacing', score: 8.5, confidence: 'high', fit_evidence: ['Social-comedy pacing is tightly governed overall.'], gap_evidence: ['Late offstage remediation and some repeated visit/report rhythms.'], revision_queue: [] },
      { key: 'proseControl', score: 9.5, confidence: 'high', fit_evidence: ['Exceptional compression, irony, sentence balance, comic timing, and psychological precision.'], gap_evidence: [], revision_queue: [] },
      { key: 'tone', score: 9.5, confidence: 'high', fit_evidence: ['Sustains wit, moral seriousness, romance, satire, embarrassment, and social danger without tonal fracture.'], gap_evidence: [], revision_queue: [] },
      { key: 'narrativeClosure', score: 9, confidence: 'high', fit_evidence: ['Elizabeth/Darcy, Jane/Bingley, Lydia/Wickham, Charlotte/Collins ledgers receive satisfying payoff.'], gap_evidence: ['Closure is intentionally harmonizing rather than punitive realism.'], revision_queue: [] },
      { key: 'marketability', score: 10, confidence: 'high', fit_evidence: ['Canonical, culturally durable, structurally teachable social comedy / romance / moral education benchmark.'], gap_evidence: [], revision_queue: [] },
    ],
    layer_analyses: [
      { layer_name: 'Social-perception layer', status: 'exceptional', needed_revision: 'None\u2014this is the defining structural achievement.' },
      { layer_name: 'Marriage-economy layer', status: 'strong', needed_revision: 'Every relationship shaped by economic and reputational constraints.' },
      { layer_name: 'Letter/reputation/revelation layer', status: 'strong', needed_revision: 'Letters, reports, rumors, and delayed disclosures revise the evidence field.' },
    ],
    cross_layer_integration: [
      { motif: 'Letters', description: 'Darcy\u2019s letter is the pivot: it restructures Elizabeth\u2019s entire judgment field.', integration_quality: 'exceptional', revision_note: 'Letters carry evidentiary and moral weight.' },
      { motif: 'Estates/houses', description: 'Pemberley, Rosings, Longbourn disclose character, class, and danger.', integration_quality: 'strong', revision_note: 'Place is moral geography.' },
    ],
    symbolic_audit: {
      preserved_symbols: [
        { symbol: 'Pemberley', current_function: 'Reveals Darcy\u2019s true character through domestic architecture and taste.', revision_instruction: 'Estate is evidence, not decoration.' },
        { symbol: 'Darcy\u2019s letter', current_function: 'The structural pivot that forces Elizabeth\u2019s self-revision.', revision_instruction: 'Letter is revelation architecture.' },
      ],
      doctrine_strengths: ['Social perception as plot engine.', 'Dialogue as combat system.'],
      doctrine_risks: ['Comic closure may soften consequence.'],
      audit_conclusion: 'Symbolic architecture is exceptional; primary cost is harmonizing resolution.',
    },
    reader_experience: {
      first_act: { reader_question: 'Who is right about whom?', emotional_state: 'Comic engagement with social misjudgment.', risk: 'Early visit economy may feel low-action.' },
      middle: { reader_question: 'Will Elizabeth revise her judgment in time?', emotional_state: 'Growing recognition and humility.', risk: 'None\u2014Pemberley sequence is masterful.' },
      final_act: { reader_question: 'Can the Lydia crisis be resolved without destroying the family?', emotional_state: 'Scandal anxiety resolved by generosity.', risk: 'Offstage remediation may feel convenient.' },
      aftertaste: 'Social perception can be plot, and dialogue, manners, letters, visits, houses, and reputation can carry full narrative causality.',
    },
    revision_plan: [
      { priority: 'P1', title: 'Maintain social-perception architecture', goal: 'Preserve the judgment-revision structure.', actions: ['No revision needed\u2014calibration benchmark.'], acceptance_check: 'Perception remains the plot engine.' },
    ],
    releasability: [
      { dimension: 'Concept', current_status: 'Brilliantly durable social premise', verdict: 'Strong' },
      { dimension: 'Social-perception architecture', current_status: 'Exceptional and structurally teachable', verdict: 'Strong' },
      { dimension: 'Publication readiness', current_status: 'Canonical benchmark text', verdict: 'Strong' },
    ],
    acceptance_checks: {
      required_detection: [
        'Social-perception architecture',
        'Free indirect discourse and ironic narration',
        'Elizabeth/Darcy reciprocal correction',
        'Marriage-economy integration',
      ],
      failure_conditions: [
        'Fails if evaluated as generic enemies-to-lovers romance.',
        'Fails if marriage treated as decorative reward.',
      ],
    },
    calibration_notes: [
      'Scores derived from the Pride and Prejudice DREAM public-domain calibration benchmark.',
      'Benchmark tier is calibration-only; does not govern production runtime.',
    ],
    manuscript_integrity_issues: [],
  } as any;

  return { canonicalDoc, dream };
}

function buildGoldenWizardOfOzFixture() {
  const canonicalDoc = buildLongFormMultiLayerDocument({
    displayTitle: 'The Wonderful Wizard of Oz',
    result: {
      generated_at: '2026-07-05T10:00:00.000Z',
      overview: {
        overall_score_0_100: 86,
        verdict: 'publish',
        one_paragraph_summary:
          'The Wonderful Wizard of Oz is a benchmark quest novel because it demonstrates that simplicity and accessibility can be structurally sound. A displaced child seeks home through a strange land with symbolic companions, confronts deceptive power, and discovers that home, courage, heart, and intelligence are validated through action rather than external gifts.',
        top_3_strengths: [
          'Portal-quest architecture.',
          'Companion-recruitment structure.',
          'Dorothy\u2019s homeward quest.',
        ],
        top_3_risks: [
          'Episodic looseness and archetypal simplicity limit adult psychological complexity.',
          'Some episodes are thin or repetitive.',
          'Dialogue is plain and functional rather than subtextually complex.',
        ],
      },
      enrichment: {
        premise:
          'A displaced child seeks home through a strange land with symbolic companions.',
        trigger_warnings: ['danger', 'captivity', 'violence against fantastical creatures'],
      },
      metrics: {
        manuscript: {
          title: 'The Wonderful Wizard of Oz',
          word_count: 40000,
          genre: "Children's Portal Fantasy / Quest Novel",
          target_audience: "Readers of children's portal fantasy, quest novel, fairy tale, and archetypal adventure",
        },
      },
      criteria: [
        {
          key: 'concept',
          score_0_10: 9,
          confidence_level: 'high',
          rationale: 'A highly durable portal quest: a displaced child seeks home through a strange land with symbolic companions.',
          recommendations: [],
        },
        {
          key: 'narrativeDrive',
          score_0_10: 8.5,
          confidence_level: 'high',
          rationale: 'The road quest, companion recruitment, obstacles, Emerald City goal, witch conflict, and return-home promise create clear propulsion.',
          recommendations: [],
        },
      ],
    },
  });

  const dream = {
    dream_scores: { quality: 86, readiness: 94, commercial: null, literary: null },
    executive_verdict:
      'The Wonderful Wizard of Oz is a benchmark quest novel demonstrating that simplicity, accessibility, archetype, and wonder can be excellent when structurally coherent. The novel\u2019s portal-quest architecture, companion-recruitment structure, and Dorothy\u2019s homeward quest create durable narrative propulsion within a children\u2019s fantasy register.',
    market_shelf: {
      best_shelf: "Children's Fantasy / Quest Novel / Fairy Tale / Archetypal Adventure",
      marketable_hook: 'A highly durable portal quest: a displaced child seeks home through a strange land with symbolic companions.',
      shelf_neighbors: ["Children's portal fantasy", 'Quest novel', 'Fairy tale', 'Archetypal adventure'],
      comparison_space: ["Children's fantasy benchmark", 'Portal-quest literature'],
      market_danger: 'The book can be misread as failed adult psychological realism.',
    },
    what_not_to_become: [
      'It should not be evaluated as failed adult psychological realism.',
      'It should not treat archetypal companions as automatically flat or defective.',
    ],
    structural_stack: [
      {
        layer_name: 'Portal-quest architecture',
        status: 'strong',
        function: 'Kansas displacement, Oz arrival, road quest, goal, return. Clean portal-quest skeleton.',
        revision_note: 'Simplicity is intentional and structurally sound.',
      },
      {
        layer_name: 'Companion-recruitment structure',
        status: 'strong',
        function: 'Scarecrow, Tin Woodman, Cowardly Lion each represent a perceived lack validated through action.',
        revision_note: 'Archetypal companions are structurally functional.',
      },
      {
        layer_name: "Dorothy's homeward quest",
        status: 'strong',
        function: 'The return-home promise is the governing emotional engine.',
        revision_note: 'Home is never merely geographic; it is belonging and agency.',
      },
      {
        layer_name: 'Episodic obstacle structure',
        status: 'effective but occasionally loose',
        function: 'Road episodes test companion qualities and extend world logic.',
        revision_note: 'Some episodes are thin or repetitive.',
      },
    ],
    arc_map: [
      {
        act_name: 'Act I\u2014Displacement and Road',
        chapter_range: '1-8',
        primary_function: 'Kansas, cyclone, Munchkin Country, road, companion recruitment.',
        revision_priority: 'Maintain wonder and clarity.',
      },
      {
        act_name: 'Act II\u2014Emerald City and Witch',
        chapter_range: '9-16',
        primary_function: 'Emerald City deception, Wicked Witch conflict, Dorothy\u2019s agency.',
        revision_priority: 'Maintain danger within children\u2019s register.',
      },
      {
        act_name: 'Act III\u2014Return and Recognition',
        chapter_range: '17-24',
        primary_function: 'Oz unmasked, companions validated, Dorothy\u2019s return home.',
        revision_priority: 'Maintain emotional payoff.',
      },
    ],
    criterion_analyses: [
      { key: 'concept', score: 9, confidence: 'high', fit_evidence: ['Highly durable portal quest with symbolic companions.'], gap_evidence: [], revision_queue: [] },
      { key: 'narrativeDrive', score: 8.5, confidence: 'high', fit_evidence: ['Road quest, companion recruitment, obstacles, Emerald City goal, witch conflict, and return-home promise.'], gap_evidence: [], revision_queue: [] },
      { key: 'character', score: 7.5, confidence: 'high', fit_evidence: ['Characters are archetypal rather than psychologically deep, but each performs a coherent symbolic and emotional function.'], gap_evidence: ['Archetypal simplicity limits adult psychological complexity.'], revision_queue: [] },
      { key: 'voice', score: 8.5, confidence: 'high', fit_evidence: ['Simple, steady, child-accessible narration supports wonder, danger, and clarity without tonal confusion.'], gap_evidence: [], revision_queue: [] },
      { key: 'sceneConstruction', score: 8, confidence: 'high', fit_evidence: ['Episodes usually test companion qualities, extend world logic, or advance homeward quest.'], gap_evidence: ['Some episodes are thin or repetitive.'], revision_queue: [] },
      { key: 'dialogue', score: 7.5, confidence: 'moderate-high', fit_evidence: ['Dialogue is plain and functional, calibrated for children\u2019s fantasy.'], gap_evidence: ['Not designed for adult subtext complexity.'], revision_queue: [] },
      { key: 'theme', score: 8.5, confidence: 'high', fit_evidence: ['Home, self-trust, courage, intelligence, compassion, friendship, and illusion-versus-power are integrated through quest action.'], gap_evidence: [], revision_queue: [] },
      { key: 'worldbuilding', score: 9, confidence: 'high', fit_evidence: ['Oz is vivid, accessible, color-coded, route-driven, and obstacle-rich without requiring heavy exposition.'], gap_evidence: [], revision_queue: [] },
      { key: 'pacing', score: 8, confidence: 'high', fit_evidence: ['Strong quest momentum with episodic looseness.'], gap_evidence: ['Structure is simple but effective.'], revision_queue: [] },
      { key: 'proseControl', score: 8, confidence: 'high', fit_evidence: ['Clear, direct, memorable children\u2019s prose; appropriately controlled.'], gap_evidence: ['Not ornate.'], revision_queue: [] },
      { key: 'tone', score: 9, confidence: 'high', fit_evidence: ['Maintains wonder, danger, humor, tenderness, and moral clarity within a stable children\u2019s-register frame.'], gap_evidence: [], revision_queue: [] },
      { key: 'narrativeClosure', score: 8.5, confidence: 'high', fit_evidence: ['Dorothy\u2019s return-home promise is paid off; companions\u2019 perceived lacks are resolved through recognition.'], gap_evidence: [], revision_queue: [] },
      { key: 'marketability', score: 10, confidence: 'high', fit_evidence: ['Canonical children\u2019s fantasy / quest benchmark with durable cultural and structural value.'], gap_evidence: [], revision_queue: [] },
    ],
    layer_analyses: [
      { layer_name: 'Portal-quest layer', status: 'strong', needed_revision: 'None\u2014clean structural skeleton.' },
      { layer_name: 'Companion/archetype layer', status: 'strong', needed_revision: 'Archetypal companions are structurally functional.' },
      { layer_name: 'Episodic obstacle layer', status: 'effective but occasionally loose', needed_revision: 'Some episodes could be tightened.' },
    ],
    cross_layer_integration: [
      { motif: 'Silver shoes / ruby slippers', description: 'The means of return are present from the beginning; recognition is the real journey.', integration_quality: 'strong', revision_note: 'Power-you-already-have is thematic architecture.' },
      { motif: 'Color-coded geography', description: 'Blue Munchkin, Yellow road, Green city, Red Quadling: world is navigable by color logic.', integration_quality: 'strong', revision_note: 'Color is spatial governance for children.' },
    ],
    symbolic_audit: {
      preserved_symbols: [
        { symbol: 'Silver shoes', current_function: 'The power to return home was always present; recognition is the real achievement.', revision_instruction: 'Never reduce to arbitrary magic.' },
        { symbol: 'Emerald City spectacles', current_function: 'Perception can be manufactured; authority can be illusion.', revision_instruction: 'Deception-as-governance.' },
      ],
      doctrine_strengths: ['Simplicity as structural strength.', 'Archetype as function.'],
      doctrine_risks: ['Episodic looseness.', 'Archetypal simplicity may be misread as deficiency.'],
      audit_conclusion: 'Symbolic architecture is sound for its register; primary risk is adult-complexity bias in evaluation.',
    },
    reader_experience: {
      first_act: { reader_question: 'How will Dorothy get home?', emotional_state: 'Wonder and displacement.', risk: 'None\u2014opening is iconic.' },
      middle: { reader_question: 'Can Dorothy and her companions defeat the Witch?', emotional_state: 'Danger within safety of genre.', risk: 'Some episodes are thin.' },
      final_act: { reader_question: 'Will Dorothy return home?', emotional_state: 'Satisfaction through recognition.', risk: 'None\u2014payoff is clean.' },
      aftertaste: 'Simplicity, accessibility, archetype, and wonder can be excellent when structurally coherent.',
    },
    revision_plan: [
      { priority: 'P1', title: 'Maintain portal-quest architecture', goal: 'Preserve the clean quest skeleton.', actions: ['No revision needed\u2014calibration benchmark.'], acceptance_check: 'Quest structure remains coherent.' },
    ],
    releasability: [
      { dimension: 'Concept', current_status: 'Highly durable portal quest', verdict: 'Strong' },
      { dimension: 'Portal-quest architecture', current_status: 'Clean and structurally teachable', verdict: 'Strong' },
      { dimension: 'Publication readiness', current_status: 'Canonical benchmark text', verdict: 'Strong' },
    ],
    acceptance_checks: {
      required_detection: [
        'Portal-quest architecture',
        'Companion-recruitment structure',
        "Dorothy's homeward quest",
        'Archetypal validation through action',
      ],
      failure_conditions: [
        'Fails if evaluated as failed adult psychological realism.',
        'Fails if archetypal companions treated as automatically defective.',
      ],
    },
    calibration_notes: [
      'Scores derived from The Wonderful Wizard of Oz DREAM public-domain calibration benchmark.',
      'Benchmark tier is calibration-only; does not govern production runtime.',
    ],
    manuscript_integrity_issues: [],
  } as any;

  return { canonicalDoc, dream };
}

type FixtureResult = { canonicalDoc: unknown; dream?: unknown };

/**
 * Contract-aware fixture builders, keyed by manifest contract id. Each builder
 * produces a representative UED (and DREAM document for multi-layer mode) for
 * its benchmark. The renderer parity harness is generic: adding a new benchmark
 * means dropping in an expected.json, a manifest entry, and one builder here.
 *
 * No blind injection of contract strings -- every asserted string must come from
 * real document fields placed by these builders and survive ViewModel
 * normalization plus rendering across TXT, HTML/PDF, and DOCX.
 */
const FIXTURE_BUILDERS: Record<string, () => FixtureResult> = {
  'short-form-ancient-bloodlines': () => ({ canonicalDoc: buildGoldenShortFormDocument() }),
  'cartel-babies-required-gold': () => buildGoldenDreamFixture(),
  'long-form-multi-layer-froggin-noggin': () => buildGoldenFrogginFixture(),
  'long-form-multi-layer-let-the-river-decide': () => buildGoldenRiverFixture(),
  'long-form-multi-layer-mythoamphibia': () => buildGoldenMythoamphibiaFixture(),
  'long-form-multi-layer-dracula': () => buildGoldenDraculaFixture(),
  'long-form-multi-layer-great-expectations': () => buildGoldenGreatExpectationsFixture(),
  'long-form-multi-layer-pride-and-prejudice': () => buildGoldenPrideAndPrejudiceFixture(),
  'long-form-multi-layer-wizard-of-oz': () => buildGoldenWizardOfOzFixture(),
};

describe('benchmark authority library manifest', () => {
  test('every non-contract_only manifest entry has a registered fixture builder', () => {
    const manifest = loadManifest();
    for (const entry of manifest.contracts) {
      if (entry.contract_only) continue;
      expect(FIXTURE_BUILDERS[entry.id]).toBeDefined();
    }
  });
});

describe('benchmark authority contracts through real renderers', () => {
  const manifest = loadManifest();
  const renderableEntries = manifest.contracts.filter((entry) => !entry.contract_only);

  test.each(renderableEntries.map((entry) => [entry.id, entry] as const))(
    '%s contract renders through ViewModel, TXT, HTML/PDF, and DOCX',
    async (_id, entry) => {
      const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
      const testing = routeModule.__testingDownload;

      const contract = loadContract(contractPathForEntry(entry));
      const builder = FIXTURE_BUILDERS[entry.id];
      expect(builder).toBeDefined();

      const { canonicalDoc, dream } = builder();

      // Lock-in: long-form fixtures are born as long-form/DREAM documents and
      // must never silently regress to a Short-Form-labelled report.
      if (entry.mode === 'long_form_multi_layer_evaluation') {
        const doc = canonicalDoc as { templateMode?: string; titleBlock?: { reportType?: string } };
        expect(doc.templateMode).toBe('long_form_multi_layer_evaluation');
        expect(doc.titleBlock?.reportType).toBe(LONG_FORM_REPORT_TYPE);
      }

      const vm = normalizeEvaluationReportViewModel(
        dream
          ? { ued: canonicalDoc as any, dreamDoc: dream as any }
          : { ued: canonicalDoc as any },
      );

      expect(vm.templateMode).toBe(entry.mode);
      if (entry.mode === 'long_form_multi_layer_evaluation') {
        expect(vm.longFormMultiLayerEvaluation).not.toBeNull();
      }

      const txt = testing.renderTxtFromViewModel(vm);
      const html = testing.renderHtmlFromViewModel(vm);
      const docxBuffer = await testing.renderDocxFromViewModel(vm);
      const docxText = (await mammoth.extractRawText({ buffer: docxBuffer })).value;

      assertContractRendersAcrossSurfaces({ contract, txt, html, docxText });

      // Revision-queue display rule: raw placement tokens must never leak.
      for (const surface of [txt, html, docxText]) {
        expect(surface).not.toContain('[LOCATION:');
        expect(surface).not.toContain('[OPERATION:');
      }

      assertForbiddenStringsDoNotLeak({ contract, txt, html, docxText });
    },
  );
});
