/**
 * Generates DOCX, TXT, and HTML downloads from the Sister evaluation fixture
 * so the palette/structure changes can be visually verified.
 *
 * Run: npm run qa:sister:generate
 */
import fs from 'fs';
import path from 'path';
import { buildShortFormEvaluationDocument } from '@/lib/evaluation/shortFormReportDocument';
import { __testingDownload } from '@/app/api/reports/[jobId]/download/route';

const OUT_DIR = path.resolve('docs/qa/sister-renderer-comparison-2026-06-08/evidence/generated-sample-2026-06-08');
fs.mkdirSync(OUT_DIR, { recursive: true });

const canonicalDoc = buildShortFormEvaluationDocument({
  displayTitle: 'Sister',
  result: {
    generated_at: '2026-06-08T00:00:00.000Z',
    overview: {
      overall_score_0_100: 64,
      verdict: 'revise',
      one_paragraph_summary:
        "A Canadian narrator interweaves an exploration of Vancouver's INSITE safe injection site and the broader HIV/HCV and addiction landscape with raw stories of his sister Christine's struggling son Nicolas and his former partner Israel, confronting how far families can and should go in enabling those they love.",
      top_3_strengths: [
        'Complex, empathetic character portraits of Christine, Nicolas, and Israel that anchor abstract debates in lived experience.',
        'Clear thematic integration of addiction as disease, harm reduction, and family enabling within a Canadian policy context.',
        'Specific and credible worldbuilding around INSITE in Vancouver and Canadian healthcare.',
      ],
      top_3_risks: [
        'Exposition-heavy, policy-focused opening that delays emotional engagement with Christine\'s family and Israel.',
        'Reliance on summary over fully dramatized scenes and sparse dialogue, blunting emotional intensity.',
        'Line-level mechanical errors that may undermine professional polish in a crowded market.',
      ],
    },
    enrichment: {
      premise:
        "A Canadian narrator confronts how far families can and should go in enabling those they love, weaving personal stories of Christine, Nicolas, and Israel through the lens of Vancouver's harm reduction landscape.",
      trigger_warnings: ['substance abuse', 'suicidal ideation', 'self-harm', 'domestic abuse'],
      reading_grade_level: 8.4,
      dialogue_percentage: 5.1,
      narrative_percentage: 94.9,
    },
    metrics: {
      manuscript: {
        title: 'Sister',
        word_count: 4903,
        genre: 'memoir',
        target_audience:
          'Readers of socially engaged memoir and creative nonfiction interested in addiction, harm reduction policy, HIV/HCV, and complex family dynamics, similar to audiences for books by Gabor Maté or David Sheff.',
      },
    },
    criteria: [
      { key: 'concept',           score_0_10: 7, confidence_level: 'high',     rationale: 'Strong, socially engaged premise with clear stakes.',                recommendations: [{ action: 'Sharpen the conceptual bridge between INSITE policy and Christine\'s household.', priority: 'high' }] },
      { key: 'narrativeDrive',    score_0_10: 6, confidence_level: 'high',     rationale: 'Pacing is uneven; policy opening delays personal stakes.',           recommendations: [{ action: 'Cut one reflective sentence, insert one external action trigger.', priority: 'high' }] },
      { key: 'character',         score_0_10: 8, confidence_level: 'high',     rationale: 'Christine, Nicolas, and Israel are vivid and coherent.',             recommendations: [] },
      { key: 'voice',             score_0_10: 7, confidence_level: 'high',     rationale: 'Narrator voice is consistent and credible.',                         recommendations: [{ action: 'Foreground narrator\'s own stake in the enabling debate during Israel\'s hospital scene.', priority: 'medium' }] },
      { key: 'sceneConstruction', score_0_10: 6, confidence_level: 'moderate', rationale: 'Scene endings lack closure; abrupt transitions weaken momentum.',    recommendations: [{ action: 'Add a bridging beat before each scene cut.', priority: 'medium' }] },
      { key: 'dialogue',          score_0_10: 5, confidence_level: 'moderate', rationale: 'Sparse dialogue reduces immediacy of key confrontations.',           recommendations: [{ action: 'Convert one summarized exchange into a direct dialogue beat.', priority: 'medium' }] },
      { key: 'theme',             score_0_10: 8, confidence_level: 'high',     rationale: 'Addiction-as-disease and family enabling themes are well-woven.',    recommendations: [] },
      { key: 'worldbuilding',     score_0_10: 7, confidence_level: 'high',     rationale: 'Strong sense of Vancouver and INSITE; Mexico scenes need grounding.', recommendations: [] },
      { key: 'pacing',            score_0_10: 6, confidence_level: 'high',     rationale: 'Structure needs rebalancing between policy exposition and scene.',   recommendations: [{ action: 'Compress repetitive INSITE statistics to reach Christine and Israel more swiftly.', priority: 'medium' }] },
      { key: 'proseControl',      score_0_10: 6, confidence_level: 'high',     rationale: 'Scattered mechanical errors in the INSITE opening undermine authority.', recommendations: [{ action: 'Proofread the INSITE opening and correct word-choice issues.', priority: 'high' }] },
      { key: 'tone',              score_0_10: 7, confidence_level: 'high',     rationale: 'Emotionally grounded when close to characters; thinner in policy sections.', recommendations: [] },
      { key: 'narrativeClosure',  score_0_10: 5, confidence_level: 'moderate', rationale: 'Scene endings and chapter close lack resolution.',                  recommendations: [] },
      { key: 'marketability',     score_0_10: 7, confidence_level: 'moderate', rationale: 'Niche but clearly defined audience with comparable titles.',         recommendations: [] },
    ],
  },
});

console.log(`Building downloads for: ${canonicalDoc.title}`);
console.log(`  overallScoreLabel: ${canonicalDoc.titleBlock.overallScoreLabel}`);
console.log(`  marketReadiness:   ${canonicalDoc.titleBlock.marketReadiness}`);
console.log(`  criteriaRows:      ${canonicalDoc.criteriaScoreGrid.length}`);

// TXT
const txt = __testingDownload.buildCanonicalTemplateTxt(canonicalDoc);
fs.writeFileSync(path.join(OUT_DIR, 'sister-generated.txt'), txt, 'utf8');
console.log(`\nWrote: sister-generated.txt (${txt.length} chars)`);

// HTML
const html = __testingDownload.renderCanonicalTemplateHtml(canonicalDoc);
fs.writeFileSync(path.join(OUT_DIR, 'sister-generated.html'), html, 'utf8');
console.log(`Wrote: sister-generated.html (${html.length} chars)`);

// DOCX
__testingDownload.buildCanonicalTemplateDocx(canonicalDoc).then((docxBuffer) => {
  fs.writeFileSync(path.join(OUT_DIR, 'sister-generated.docx'), docxBuffer);
  console.log(`Wrote: sister-generated.docx (${docxBuffer.length} bytes)`);
  console.log(`\nAll outputs in: ${OUT_DIR}`);
});
