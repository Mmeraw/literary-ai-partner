import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import mammoth from 'mammoth';
import { buildShortFormEvaluationDocument } from '../../../lib/evaluation/shortFormReportDocument';
import { normalizeEvaluationReportViewModel } from '../../../lib/evaluation/evaluationReportViewModel';

const CONTRACT_ROOT = join(process.cwd(), 'tests/benchmark-authority');

type BenchmarkContract = {
  mode: 'short_form_evaluation' | 'long_form_multi_layer_evaluation';
  required_public_strings: string[];
  forbidden_public_strings: string[];
};

function loadContract(relativePath: string): BenchmarkContract {
  return JSON.parse(readFileSync(join(CONTRACT_ROOT, relativePath), 'utf8')) as BenchmarkContract;
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

function assertStableStringsRenderEverywhere(params: {
  contract: BenchmarkContract;
  stableStrings: string[];
  txt: string;
  html: string;
  docxText: string;
}) {
  const txtPlain = normalizeSurfaceText(params.txt);
  const htmlPlain = normalizeSurfaceText(stripHtmlTags(params.html));
  const docxPlain = normalizeSurfaceText(params.docxText);

  for (const expected of params.stableStrings) {
    expect(params.contract.required_public_strings).toContain(expected);
    const normalized = normalizeSurfaceText(expected);
    expect(txtPlain).toContain(normalized);
    expect(htmlPlain).toContain(normalized);
    expect(docxPlain).toContain(normalized);
  }
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

function buildGoldenDreamFixture() {
  const canonicalDoc = buildShortFormEvaluationDocument({
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

  canonicalDoc.templateMode = 'long_form_multi_layer_evaluation';

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
  const canonicalDoc = buildShortFormEvaluationDocument({
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

  canonicalDoc.templateMode = 'long_form_multi_layer_evaluation';

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

describe('benchmark authority contracts through real renderers', () => {
  test('short-form benchmark contract renders through ViewModel, TXT, HTML/PDF, and DOCX', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;
    const contract = loadContract('short-form/expected.json');
    const vm = normalizeEvaluationReportViewModel({ ued: buildGoldenShortFormDocument() as any });

    expect(vm.templateMode).toBe('short_form_evaluation');
    expect(vm.titleBlock.displayTitle).toBe('Ancient Bloodlines');

    const txt = testing.renderTxtFromViewModel(vm);
    const html = testing.renderHtmlFromViewModel(vm);
    const docxBuffer = await testing.renderDocxFromViewModel(vm);
    const docxText = (await mammoth.extractRawText({ buffer: docxBuffer })).value;

    assertStableStringsRenderEverywhere({
      contract,
      txt,
      html,
      docxText,
      stableStrings: [
        'Ancient Bloodlines',
        '68',
        'Concept & Core Premise',
        'Narrative Drive & Momentum',
        'Point of View & Voice Control',
        'Author retains ownership of manuscript content',
      ],
    });

    assertForbiddenStringsDoNotLeak({ contract, txt, html, docxText });
  });

  test('DREAM benchmark contract renders through ViewModel, TXT, HTML/PDF, and DOCX', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;
    const contract = loadContract('long-form-multi-layer/expected.json');
    const { canonicalDoc, dream } = buildGoldenDreamFixture();
    const vm = normalizeEvaluationReportViewModel({ ued: canonicalDoc as any, dreamDoc: dream });

    expect(vm.templateMode).toBe('long_form_multi_layer_evaluation');
    expect(vm.longFormMultiLayerEvaluation).not.toBeNull();

    const txt = testing.renderTxtFromViewModel(vm);
    const html = testing.renderHtmlFromViewModel(vm);
    const docxBuffer = await testing.renderDocxFromViewModel(vm);
    const docxText = (await mammoth.extractRawText({ buffer: docxBuffer })).value;

    assertStableStringsRenderEverywhere({
      contract,
      txt,
      html,
      docxText,
      stableStrings: [
        'Cartel Babies',
        'Upmarket Suspense / Literary Cartel Thriller',
        'Literary Thriller / International Crime / Borderlands Fiction',
        'Chosen family under cartel sovereignty.',
        'A generic narco shootout thriller.',
        'Immediate Survival Thriller',
        'Camp-System Anatomy',
        'Benjamin Parallel Search',
        'Healing and Chosen Family',
        'Act I',
        'Act II',
        'Act III',
        'Table Tennis',
        'Naming / Renaming',
        'Run current manuscript-integrity pass',
        'Compress 8\u201312% globally',
        'Make final protection sequence procedurally resistant',
        'Premise / hook',
        'Must detect Benjamin as dual-POV co-protagonist.',
        'Author retains ownership of manuscript content',
      ],
    });

    expect(txt).not.toContain('[LOCATION:');
    expect(html).not.toContain('[LOCATION:');
    expect(docxText).not.toContain('[LOCATION:');
    expect(txt).not.toContain('[OPERATION:');
    expect(html).not.toContain('[OPERATION:');
    expect(docxText).not.toContain('[OPERATION:');
    assertForbiddenStringsDoNotLeak({ contract, txt, html, docxText });
  });

  test('Froggin Noggin benchmark contract renders through ViewModel, TXT, HTML/PDF, and DOCX', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;
    const contract = loadContract('long-form-multi-layer/froggin-noggin.expected.json');
    const { canonicalDoc, dream } = buildGoldenFrogginFixture();
    const vm = normalizeEvaluationReportViewModel({ ued: canonicalDoc as any, dreamDoc: dream });

    expect(vm.templateMode).toBe('long_form_multi_layer_evaluation');
    expect(vm.longFormMultiLayerEvaluation).not.toBeNull();

    const txt = testing.renderTxtFromViewModel(vm);
    const html = testing.renderHtmlFromViewModel(vm);
    const docxBuffer = await testing.renderDocxFromViewModel(vm);
    const docxText = (await mammoth.extractRawText({ buffer: docxBuffer })).value;

    assertStableStringsRenderEverywhere({
      contract,
      txt,
      html,
      docxText,
      stableStrings: [
        'Froggin Noggin',
        'Literary Transgressive Fiction / Dual-POV Eco-Fable',
        'Two sovereigns hoarding chemistry, and subjects who would rather swallow the shiny thing than be free.',
        'A book edited into safety with the transgression sanded down.',
        'Human storyline\u2014Kingdom Lake meth world',
        'Frog storyline\u2014Aqua World matriarchy',
        'Cosmological / theological frame',
        'Structural mirroring spine',
        'Concept & Core Premise',
        'Narrative Drive & Momentum',
        'Mirror Brutus\u2019s meth cook against Zimeon\u2019s shard discovery on adjacent chapter beats.',
        'Stage Hyla\u2019s maiming of Arcana as a present-tense scene, not a recollection.',
        'Page-100 waypoint payoff: false-positive toadstone.',
        'Concept / premise',
        'Page-100 structural payoff',
        'Publication readiness',
        'Must detect the dual-POV human and frog storylines as parallel power structures.',
        'Author retains ownership of manuscript content',
      ],
    });

    expect(txt).not.toContain('[LOCATION:');
    expect(html).not.toContain('[LOCATION:');
    expect(docxText).not.toContain('[LOCATION:');
    expect(txt).not.toContain('[OPERATION:');
    expect(html).not.toContain('[OPERATION:');
    expect(docxText).not.toContain('[OPERATION:');
    assertForbiddenStringsDoNotLeak({ contract, txt, html, docxText });
  });
});
