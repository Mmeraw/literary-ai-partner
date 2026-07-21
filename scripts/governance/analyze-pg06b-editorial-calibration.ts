import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
  analyzeGovernedOpportunityCoverage,
  isGovernedRecommendationStatus,
  type OpportunityCoverageIssue,
  type RecommendationStatus,
} from '../../lib/evaluation/policy/opportunityDiscoveryPolicy';

export type Pg06bCriterionClassification =
  | 'recommendation_present'
  | 'valid_governed_suppression_requires_editorial_adjudication'
  | 'propagation_gap_missing_disposition'
  | 'invalid_disposition_metadata'
  | 'status_cardinality_mismatch'
  | 'missing_disposition_rationale'
  | 'strong_criterion_empty_legacy_compatible'
  | 'not_scored_or_not_applicable';

export interface Pg06bCriterionRecord {
  criterionKey: string;
  score: number | null;
  recommendationCount: number;
  evidenceCount: number;
  recommendationStatus: RecommendationStatus | 'invalid' | 'missing';
  rationalePresent: boolean;
  coverageIssues: OpportunityCoverageIssue[];
  classification: Pg06bCriterionClassification;
}

export interface Pg06bCaseRecord {
  sourceFile: string;
  criteriaPointer: string;
  criteriaCount: number;
  scoredCriteriaCount: number;
  totalScore: number | null;
  averageCriterionScore: number | null;
  totalRecommendationCount: number;
  weakCriteriaCount: number;
  weakZeroRecommendationCount: number;
  classificationCounts: Record<Pg06bCriterionClassification, number>;
  criteria: Pg06bCriterionRecord[];
}

export interface Pg06bAnalysisResult {
  generatedAt: string;
  policy: 'PG-06B / RCA-005 editorial calibration; discovery not quota';
  sourceFileCount: number;
  candidateCaseCount: number;
  aggregateClassificationCounts: Record<Pg06bCriterionClassification, number>;
  cases: Pg06bCaseRecord[];
  notes: string[];
}

const CLASSIFICATIONS: Pg06bCriterionClassification[] = [
  'recommendation_present',
  'valid_governed_suppression_requires_editorial_adjudication',
  'propagation_gap_missing_disposition',
  'invalid_disposition_metadata',
  'status_cardinality_mismatch',
  'missing_disposition_rationale',
  'strong_criterion_empty_legacy_compatible',
  'not_scored_or_not_applicable',
];

function emptyClassificationCounts(): Record<Pg06bCriterionClassification, number> {
  return Object.fromEntries(CLASSIFICATIONS.map((key) => [key, 0])) as Record<Pg06bCriterionClassification, number>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function criterionScore(criterion: Record<string, unknown>): number | null {
  return readNumber(criterion.score_0_10)
    ?? readNumber(criterion.final_score_0_10)
    ?? readNumber(criterion.score)
    ?? null;
}

function criterionKey(criterion: Record<string, unknown>, index: number): string {
  for (const key of ['key', 'criterion_key', 'criterionId', 'criterion_id', 'name']) {
    const value = criterion[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return `criterion_${index}`;
}

function recommendationStatus(criterion: Record<string, unknown>): RecommendationStatus | 'invalid' | 'missing' {
  const raw = criterion.recommendation_status ?? criterion.recommendationStatus;
  if (raw === undefined || raw === null || raw === '') return 'missing';
  return isGovernedRecommendationStatus(raw) ? raw : 'invalid';
}

function recommendationStatusRationale(criterion: Record<string, unknown>): unknown {
  return criterion.recommendation_status_rationale ?? criterion.recommendationStatusRationale;
}

function classifyCriterion(args: {
  score: number | null;
  recommendationCount: number;
  status: RecommendationStatus | 'invalid' | 'missing';
  rationalePresent: boolean;
  issues: OpportunityCoverageIssue[];
}): Pg06bCriterionClassification {
  if (args.recommendationCount > 0 && args.issues.length === 0) return 'recommendation_present';
  if (args.issues.includes('invalid_recommendation_status')) return 'invalid_disposition_metadata';
  if (args.issues.includes('recommendation_status_cardinality_mismatch')) return 'status_cardinality_mismatch';
  if (args.issues.includes('missing_disposition_rationale')) return 'missing_disposition_rationale';
  if (args.issues.includes('missing_governed_disposition')) return 'propagation_gap_missing_disposition';
  if (args.recommendationCount === 0 && args.status !== 'missing' && args.status !== 'invalid' && args.rationalePresent) {
    return 'valid_governed_suppression_requires_editorial_adjudication';
  }
  if (args.recommendationCount === 0 && args.status === 'missing' && args.score !== null && args.score >= 8) {
    return 'strong_criterion_empty_legacy_compatible';
  }
  return 'not_scored_or_not_applicable';
}

function findCriteriaArrays(root: unknown): Array<{ pointer: string; criteria: Record<string, unknown>[] }> {
  const found: Array<{ pointer: string; criteria: Record<string, unknown>[] }> = [];
  const seen = new Set<unknown>();

  function visit(value: unknown, pointer: string): void {
    if ((!isObject(value) && !Array.isArray(value)) || seen.has(value)) return;
    seen.add(value);

    if (
      Array.isArray(value)
      && value.length >= 3
      && value.every(isObject)
      && value.some((item) => 'recommendations' in item || 'score_0_10' in item || 'final_score_0_10' in item || 'recommendation_status' in item)
    ) {
      found.push({ pointer, criteria: value });
    }

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${pointer}/${index}`));
      return;
    }

    for (const [key, nested] of Object.entries(value)) {
      visit(nested, `${pointer}/${key}`);
    }
  }

  visit(root, '');
  return found;
}

function totalScore(document: unknown): number | null {
  if (!isObject(document)) return null;
  const overview = isObject(document.overview) ? document.overview : null;
  const overall = isObject(document.overall) ? document.overall : null;
  return readNumber(overview?.overall_score_0_100)
    ?? readNumber(overall?.overall_score_0_100)
    ?? readNumber(document.overall_score)
    ?? null;
}

export function analyzePg06bDocuments(documents: Array<{ sourceFile: string; document: unknown }>): Pg06bAnalysisResult {
  const cases: Pg06bCaseRecord[] = [];

  for (const { sourceFile, document } of documents) {
    for (const { pointer, criteria } of findCriteriaArrays(document)) {
      const records: Pg06bCriterionRecord[] = criteria.map((criterion, index) => {
        const score = criterionScore(criterion);
        const recommendationCount = asArray(criterion.recommendations).length;
        const evidenceCount = asArray(criterion.evidence).length;
        const status = recommendationStatus(criterion);
        const rationale = recommendationStatusRationale(criterion);
        const rationalePresent = typeof rationale === 'string' && rationale.trim().length >= 20;
        const coverage = analyzeGovernedOpportunityCoverage({
          score,
          meaningfulOpportunityCount: recommendationCount,
          recommendationStatus: status === 'missing' ? undefined : status,
          recommendationStatusRationale: rationale,
        });
        return {
          criterionKey: criterionKey(criterion, index),
          score,
          recommendationCount,
          evidenceCount,
          recommendationStatus: status,
          rationalePresent,
          coverageIssues: coverage.issues,
          classification: classifyCriterion({
            score,
            recommendationCount,
            status,
            rationalePresent,
            issues: coverage.issues,
          }),
        };
      });

      const scored = records.filter((record) => record.score !== null);
      const weak = scored.filter((record) => record.score !== null && record.score <= 7);
      const weakZero = weak.filter((record) => record.recommendationCount === 0);
      const totalRecommendationCount = records.reduce((sum, record) => sum + record.recommendationCount, 0);
      const averageCriterionScore = scored.length === 0
        ? null
        : Number((scored.reduce((sum, record) => sum + (record.score ?? 0), 0) / scored.length).toFixed(2));
      const classificationCounts = emptyClassificationCounts();
      for (const record of records) classificationCounts[record.classification] += 1;

      const includeCase = weakZero.length > 0
        || totalRecommendationCount <= 2
        || records.some((record) => record.classification !== 'recommendation_present' && record.classification !== 'not_scored_or_not_applicable');
      if (!includeCase) continue;

      cases.push({
        sourceFile,
        criteriaPointer: pointer || '/',
        criteriaCount: records.length,
        scoredCriteriaCount: scored.length,
        totalScore: totalScore(document),
        averageCriterionScore,
        totalRecommendationCount,
        weakCriteriaCount: weak.length,
        weakZeroRecommendationCount: weakZero.length,
        classificationCounts,
        criteria: records,
      });
    }
  }

  cases.sort((a, b) => b.weakZeroRecommendationCount - a.weakZeroRecommendationCount
    || a.totalRecommendationCount - b.totalRecommendationCount
    || a.sourceFile.localeCompare(b.sourceFile));

  const aggregateClassificationCounts = emptyClassificationCounts();
  for (const item of cases) {
    for (const key of CLASSIFICATIONS) aggregateClassificationCounts[key] += item.classificationCounts[key];
  }

  return {
    generatedAt: new Date().toISOString(),
    policy: 'PG-06B / RCA-005 editorial calibration; discovery not quota',
    sourceFileCount: documents.length,
    candidateCaseCount: cases.length,
    aggregateClassificationCounts,
    cases,
    notes: [
      'This analysis is observational and must not alter scoring, caps, thresholds, suppression policy, or queue admission.',
      'Valid governed suppression requires editorial adjudication before any prompt or policy correction is proposed.',
      'Missing or contradictory disposition metadata is a structural propagation defect, not proof of editorial under-generation.',
      'Criterion prose and manuscript evidence are intentionally excluded from this output.',
    ],
  };
}

export function formatPg06bMarkdown(result: Pg06bAnalysisResult): string {
  const lines: string[] = [];
  lines.push('# PG-06B Editorial Calibration Analysis');
  lines.push('');
  lines.push(`Generated at: ${result.generatedAt}`);
  lines.push(`Source files analyzed: ${result.sourceFileCount}`);
  lines.push(`Candidate cases: ${result.candidateCaseCount}`);
  lines.push('');
  lines.push('## Aggregate classifications');
  for (const key of CLASSIFICATIONS) {
    lines.push(`- ${key}: ${result.aggregateClassificationCounts[key]}`);
  }
  lines.push('');
  lines.push('## Candidate cases');
  for (const item of result.cases) {
    lines.push(`- ${item.sourceFile} (${item.criteriaPointer}): totalScore=${item.totalScore ?? 'unknown'}, recommendations=${item.totalRecommendationCount}, weakZero=${item.weakZeroRecommendationCount}`);
  }
  lines.push('');
  lines.push('## Guardrails');
  for (const note of result.notes) lines.push(`- ${note}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function loadDocuments(paths: string[]): Array<{ sourceFile: string; document: unknown }> {
  return paths.map((filePath) => ({
    sourceFile: filePath,
    document: JSON.parse(readFileSync(filePath, 'utf8')),
  }));
}

function main(): void {
  const args = process.argv.slice(2);
  const markdown = args.includes('--markdown');
  const files = args.filter((arg) => arg !== '--markdown' && arg !== '--json');
  if (files.length === 0) {
    throw new Error(`Usage: npx tsx ${basename(process.argv[1])} [--markdown|--json] <evaluation-json>...`);
  }
  const result = analyzePg06bDocuments(loadDocuments(files));
  process.stdout.write(markdown ? formatPg06bMarkdown(result) : `${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) {
  main();
}