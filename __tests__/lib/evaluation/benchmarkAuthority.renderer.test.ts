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
    displayTitle: 'The Cartographer',
    result: {
      generated_at: '2026-05-27T12:00:00.000Z',
      overview: {
        overall_score_0_100: 74,
        verdict: 'revise',
        one_paragraph_summary:
          'The Cartographer builds a distinctive world through layered cartographic metaphor, but pacing falters in the second act where introspective passages overshadow forward momentum.',
        top_3_strengths: [
          'Distinctive cartographic voice with consistent metaphor integration.',
          'Strong opening chapter that grounds the reader in sensory detail.',
          'Compelling secondary characters who challenge the protagonist.',
        ],
        top_3_risks: [
          'Pacing stalls in the middle third where reflection replaces action.',
          'The antagonist motivation remains opaque past the midpoint.',
          'Dialogue tags occasionally overpower the spoken lines.',
        ],
      },
      enrichment: {
        premise: 'A retired mapmaker discovers her final commission hides a colonial secret.',
        trigger_warnings: ['colonialism', 'loss of a parent'],
        reading_grade_level: 10.2,
        dialogue_percentage: 38,
        narrative_percentage: 62,
      },
      metrics: {
        manuscript: {
          title: 'The Cartographer',
          word_count: 5200,
          genre: 'literary suspense',
          target_audience: 'Adult literary suspense readers',
        },
      },
      criteria: [
        {
          key: 'conceptAndCorePremise',
          score_0_10: 8,
          confidence_level: 'high',
          rationale: 'The cartographic conceit is fresh and well-integrated into both plot and theme.',
          recommendations: [
            {
              priority: 'medium',
              action: 'Deepen the colonial layer in the second half.',
              anchor_snippet: 'She traced the river, noticing how every bend had been renamed.',
              anchor_type: 'verbatim_quote',
              symptom: 'Colonial subtext introduced late without sufficient groundwork.',
              mechanism: 'Key thematic threads surface only in the final third.',
              specific_fix: 'Seed one colonial reference per chapter from chapter 3 onward.',
              reader_effect: 'Creates cohesive thematic throughline rather than late revelation.',
              mistake_proofing: 'Verify each chapter has at least one colonial-era reference after chapter 3.',
            },
          ],
        },
        {
          key: 'narrativeDrive',
          score_0_10: 6,
          confidence_level: 'moderate',
          rationale: 'Momentum is strong in Act I but diffuses during extended cartographic digressions.',
          recommendations: [
            {
              priority: 'high',
              action: 'Add a ticking-clock element by chapter 8.',
              anchor_snippet: 'Days passed in the archive, each map yielding less than the last.',
              anchor_type: 'paraphrased_observation',
              symptom: 'Reader engagement drops during research montage sequences.',
              mechanism: 'Repetitive scene structure without escalating stakes.',
              specific_fix: 'Insert a deadline — the archive is closing, or a rival collector emerges.',
              reader_effect: 'Restores urgency and forward momentum.',
              mistake_proofing: 'Check each research scene for at least one stakes-raising beat.',
            },
          ],
        },
        {
          key: 'povVoice',
          score_0_10: 7,
          confidence_level: 'high',
          rationale: 'The voice is controlled and image-rich, with occasional over-explanation.',
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
        act_name: 'Act I \u2014 Seizure and System Entry',
        chapter_range: '1-10',
        primary_function: 'Michael is abducted, transported into mountain camp, registered by force into hierarchy.',
        revision_priority: 'Maintain urgency and visual clarity.',
      },
      {
        act_name: 'Act II \u2014 Benjamin Before and During Michael',
        chapter_range: '11-20',
        primary_function: 'Benjamin backstory explains why Michael matters; search begins.',
        revision_priority: 'Convert repeated shame into external action.',
      },
      {
        act_name: 'Act III \u2014 Camp Adaptation and First Moral Bond',
        chapter_range: '21-35',
        primary_function: 'Table tennis becomes plot architecture; Paolito attention and trust transfer.',
        revision_priority: 'Maintain changed-condition endings for each chapter.',
      },
      {
        act_name: 'Act IV \u2014 Benjamin Search and Institutional Friction',
        chapter_range: '36-50',
        primary_function: 'Private horror of not knowing; humiliating slowness of official help.',
        revision_priority: 'Maintain propulsion in search arc.',
      },
      {
        act_name: 'Act V \u2014 Ra\u00FAl Impossible Handoff',
        chapter_range: '51-65',
        primary_function: 'Ra\u00FAl becomes legible; handoff of Paolito must flower from earlier contradictions.',
        revision_priority: 'Avoid sudden redemption.',
      },
      {
        act_name: 'Act VI \u2014 Break, Extraction, and State Handoff',
        chapter_range: '66-80',
        primary_function: 'Non-drug shipment, convoy, attack, escape, embassy, orientation, new names.',
        revision_priority: 'Add resistance to protection sequence.',
      },
      {
        act_name: 'Act VII \u2014 New Country, Old Trauma, New Family',
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

describe('benchmark authority contracts through real renderers', () => {
  test('short-form benchmark contract renders through ViewModel, TXT, HTML/PDF, and DOCX', async () => {
    const routeModule = await import('../../../app/api/reports/[jobId]/download/route');
    const testing = routeModule.__testingDownload;
    const contract = loadContract('short-form/expected.json');
    const vm = normalizeEvaluationReportViewModel({ ued: buildGoldenShortFormDocument() as any });

    expect(vm.templateMode).toBe('short_form_evaluation');
    expect(vm.titleBlock.displayTitle).toBe('The Cartographer');

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
        'The Cartographer',
        'literary suspense',
        'Adult literary suspense readers',
        'A retired mapmaker discovers her final commission hides a colonial secret.',
        'Distinctive cartographic voice with consistent metaphor integration.',
        'Pacing stalls in the middle third where reflection replaces action.',
        'Concept & Core Premise',
        'Narrative Drive & Momentum',
        'She traced the river, noticing how every bend had been renamed.',
        'Seed one colonial reference per chapter from chapter 3 onward.',
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
});
