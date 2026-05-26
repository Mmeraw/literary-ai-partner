#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const reportPath = args.report;
const sourcePath = args.source;
const entitiesPath = args.entities;
const strictWarnings = Boolean(args['strict-warnings']);
const expectedFailCodes = csv(args['expect-fail-codes']);

if (!reportPath) failCli('Missing required argument: --report <path>');
if (!fs.existsSync(reportPath)) failCli(`Report file not found: ${reportPath}`);

const reportText = readText(reportPath);
const sourceText = sourcePath && fs.existsSync(sourcePath) ? readText(sourcePath) : null;
const entityConfig = entitiesPath && fs.existsSync(entitiesPath)
  ? JSON.parse(fs.readFileSync(entitiesPath, 'utf8'))
  : defaultEntityConfig();

const failures = [];
const warnings = [];

checkReportStateContradictions(reportText, failures);
checkScoreLedger(reportText, failures);
checkCanonicalEntityAliases(reportText, entityConfig, failures);
checkQuoteFidelity(reportText, sourceText, failures, warnings);
checkRecommendationPriority(reportText, warnings);
checkSceneGeographyCompression(reportText, warnings);

const expectedModeResult = expectedFailCodes.length > 0
  ? evaluateExpectedFailures(expectedFailCodes, failures)
  : null;

printResults({ failures, warnings, strictWarnings, expectedModeResult });

if (expectedModeResult) process.exit(expectedModeResult.ok ? 0 : 1);
if (failures.length > 0 || (strictWarnings && warnings.length > 0)) process.exit(1);
process.exit(0);

function checkReportStateContradictions(text, failures) {
  const terminalSignals = [
    /✓\s*Report ready/i,
    /\bReport ready\b/i,
    /\bEvaluation complete!\s*100%/i,
    /\bYour evaluation report is ready\b/i,
    /\bEvaluation completed successfully\b/i,
  ];

  const nonTerminalSignals = [
    /\bCalibration\s*[—-]\s*pending\b/i,
    /\bCraft diagnostics\s*[—-]\s*in progress/i,
    /\bTEMPORARY CONNECTION ISSUE\b/i,
    /\bServer error\b/i,
    /\bRetrying automatically\b/i,
    /\bDownload Report Available after evaluation completes\b/i,
    /\bReport not ready yet\b/i,
  ];

  const hasTerminal = terminalSignals.some((rx) => rx.test(text));
  const foundNonTerminal = nonTerminalSignals.filter((rx) => rx.test(text)).map(String);

  if (hasTerminal && foundNonTerminal.length > 0) {
    failures.push({
      code: 'REPORT_STATE_CONTRADICTION',
      severity: 'critical',
      message: 'Report displays terminal-ready language while also displaying pending/in-progress/error/unavailable states.',
      evidence: foundNonTerminal,
    });
  }
}

function checkScoreLedger(text, failures) {
  const overallScore = extractOverallScore(text);
  const ledgerScore10 = extractLedgerScore10(text);
  if (overallScore === null || ledgerScore10 === null) return;

  const expectedOverall = Math.round(ledgerScore10 * 10);
  const delta = Math.abs(expectedOverall - overallScore);

  if (delta > 1) {
    failures.push({
      code: 'SCORE_LEDGER_MISMATCH',
      severity: 'critical',
      message: `Overall Score ${overallScore}/100 does not reconcile with Score Ledger ${ledgerScore10}/10. Expected approximately ${expectedOverall}/100.`,
      evidence: { overallScore, ledgerScore10, expectedOverall, delta },
    });
  }
}

function extractOverallScore(text) {
  const patterns = [
    /Overall Score\s*[:\n\r ]+(\d+(?:\.\d+)?)/i,
    /Overall\s+Score\s*<\/?[^>]*>\s*(\d+(?:\.\d+)?)/i,
    /Overall\s+Score[\s\S]{0,40}?(\d+(?:\.\d+)?)\s*\/\s*100/i,
  ];
  for (const rx of patterns) {
    const match = text.match(rx);
    if (match) return Number(match[1]);
  }
  return null;
}

function extractLedgerScore10(text) {
  const patterns = [
    /Score Ledger:\s*Score:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i,
    /Canonical Score:\s*(\d+(?:\.\d+)?)\s*\/\s*10/i,
    /Score\s*\(0[–-]10\).*?(\d+(?:\.\d+)?)\s*\/\s*10/is,
  ];
  for (const rx of patterns) {
    const match = text.match(rx);
    if (match) return Number(match[1]);
  }
  return null;
}

function checkCanonicalEntityAliases(text, entityConfig, failures) {
  const forbiddenPatterns = entityConfig.forbidden_patterns || [];
  const hits = [];
  for (const pattern of forbiddenPatterns) {
    try {
      const rx = new RegExp(pattern, 'iu');
      if (rx.test(text)) hits.push(pattern);
    } catch (error) {
      failures.push({
        code: 'INVALID_ENTITY_FORBIDDEN_PATTERN',
        severity: 'high',
        message: `Invalid forbidden entity regex: ${pattern}`,
        evidence: String(error?.message || error),
      });
    }
  }

  if (hits.length > 0) {
    failures.push({
      code: 'CANONICAL_ENTITY_ALIAS_LEAK',
      severity: 'high',
      message: 'Report contains malformed, placeholder, or forbidden character labels. Use canonical entity ledger instead.',
      evidence: hits,
    });
  }
}

function checkQuoteFidelity(report, source, failures, warnings) {
  if (!source) {
    warnings.push({
      code: 'QUOTE_FIDELITY_NOT_RUN',
      severity: 'medium',
      message: 'Quote fidelity check skipped because no --source manuscript/report-source text was provided.',
    });
    return;
  }

  const reportQuotes = extractDirectQuotes(stripCodeFences(report));
  const normalizedSource = normalizeForQuoteMatch(source);
  const driftedQuotes = [];

  for (const quote of reportQuotes) {
    const normalizedQuote = normalizeForQuoteMatch(quote);
    if (!shouldCheckQuote(normalizedQuote)) continue;
    if (!normalizedSource.includes(normalizedQuote)) driftedQuotes.push(quote);
  }

  if (driftedQuotes.length > 0) {
    failures.push({
      code: 'QUOTE_FIDELITY_DRIFT',
      severity: 'high',
      message: 'Report contains quoted language that does not appear verbatim in the provided source text.',
      evidence: driftedQuotes.slice(0, 20),
      count: driftedQuotes.length,
    });
  }
}

function extractDirectQuotes(text) {
  const quotes = new Set();
  for (const rx of [/"([^"]{2,300})"/g, /“([^”]{2,300})”/g]) {
    let match;
    while ((match = rx.exec(text)) !== null) quotes.add(match[1].trim());
  }
  return [...quotes];
}

function shouldCheckQuote(quote) {
  if (!quote || quote.length < 16 || !/[a-zA-Z]/.test(quote)) return false;
  const skipPatterns = [
    /^Chapter\s+\d+/i,
    /^High Confidence$/i,
    /^Moderate Confidence$/i,
    /^Low Confidence$/i,
    /^STANDARD$/i,
    /^BALANCED$/i,
    /^Report ready$/i,
    /^Evaluation complete/i,
  ];
  return !skipPatterns.some((rx) => rx.test(quote));
}

function normalizeForQuoteMatch(value) {
  return value.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();
}

function stripCodeFences(value) {
  return value.replace(/```[\s\S]*?```/g, '');
}

function checkRecommendationPriority(text, warnings) {
  const topRecommendationsBlock = extractTopRecommendations(text);
  if (!topRecommendationsBlock) {
    warnings.push({ code: 'TOP_RECOMMENDATIONS_NOT_FOUND', severity: 'medium', message: 'Could not locate Top Recommendations block.' });
    return;
  }

  const topMentionsCosmetic = /metaphor|land\/body|vary|trim|imagery|line-level/i.test(topRecommendationsBlock);
  const bodyMentionsIdentityRisk = /name\/identity|identity transition|alias shift|Michael Salter|Miguel|McGill|Michael Wagner|Polito|Paulito|Paul Robert Wagner/i.test(text);
  const topMentionsIdentityRisk = /name\/identity|identity transition|alias|Michael|Miguel|McGill|Wagner|Polito|Paulito|Paul/i.test(topRecommendationsBlock);
  const bodyMentionsClosureRisk = /macro-closure|closure perception|lasting shape|left open|rounded closure|long-term consequences/i.test(text);
  const topMentionsClosureRisk = /closure|consequence|ending|payoff|resolution/i.test(topRecommendationsBlock);

  if (topMentionsCosmetic && bodyMentionsIdentityRisk && !topMentionsIdentityRisk) {
    warnings.push({ code: 'WEAK_TOP_RECOMMENDATION_PRIORITY', severity: 'medium-high', message: 'Top recommendations appear to prioritize cosmetic prose polish while identity/name transition risk appears elsewhere in the report.' });
  }

  if (topMentionsCosmetic && bodyMentionsClosureRisk && !topMentionsClosureRisk) {
    warnings.push({ code: 'WEAK_TOP_RECOMMENDATION_PRIORITY', severity: 'medium-high', message: 'Top recommendations appear to prioritize cosmetic prose polish while closure/payoff risk appears elsewhere in the report.' });
  }
}

function extractTopRecommendations(text) {
  const match = text.match(/Top Recommendations([\s\S]*?)(Story Criteria Scores|Confidence Guide|Key Metrics|Narrative Synthesis)/i);
  return match ? match[1] : null;
}

function checkSceneGeographyCompression(text, warnings) {
  const patterns = [
    /\bNo and Raúl pass a hidden truck\b/i,
    /\bMichael and Raúl pass a hidden truck\b/i,
    /\bRaúl(?:'s|’s)? authority under the overpass\b/i,
  ];
  const hits = patterns.filter((rx) => rx.test(text)).map(String);
  if (hits.length > 0) {
    warnings.push({
      code: 'SCENE_GEOGRAPHY_COMPRESSION',
      severity: 'medium',
      message: 'Report may compress scene geography or authority staging in a way that should be evidence-checked.',
      evidence: hits,
    });
  }
}

function defaultEntityConfig() {
  return {
    forbidden_patterns: [
      "\\bNo[’']s\\s+(captivity|abduction|situation|highway|choice|loading|trauma|realization|disciplined|voice|scenes?)\\b",
      "\\bNo\\s+(is|moves|chooses|does|not breaking|was|has|keeps|starts|arrives|works|gets|remains)\\b",
      "\\bforeign-captive angle in No\\b",
      "\\bthe close first-person voice channeled through No\\b",
      "\\bNo and Raúl\\b",
    ],
  };
}

function evaluateExpectedFailures(expectedCodes, failures) {
  const actualCodes = new Set(failures.map((failure) => failure.code));
  const missing = expectedCodes.filter((code) => !actualCodes.has(code));
  return { ok: missing.length === 0, expectedCodes, actualCodes: [...actualCodes], missing };
}

function csv(value) {
  if (!value || value === true) return [];
  return String(value).split(',').map((part) => part.trim()).filter(Boolean);
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    if (key === 'strict-warnings') {
      parsed[key] = true;
      continue;
    }
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) parsed[key] = true;
    else {
      parsed[key] = next;
      i += 1;
    }
  }
  return parsed;
}

function readText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') {
    failCli('PDF input is not supported directly. Run governance before PDF export or provide text/HTML/Markdown rendered report text.');
  }
  return fs.readFileSync(filePath, 'utf8');
}

function printResults({ failures, warnings, strictWarnings, expectedModeResult }) {
  console.log('\nRevisionGrade Report Governance Validator');
  console.log('========================================\n');

  if (expectedModeResult) {
    console.log('Expected-failure regression mode enabled.');
    console.log(`Expected codes: ${expectedModeResult.expectedCodes.join(', ')}`);
    console.log(`Actual failure codes: ${expectedModeResult.actualCodes.join(', ') || '(none)'}`);
    console.log(expectedModeResult.ok ? 'PASS: Expected failure codes were detected.\n' : `FAIL: Missing expected codes: ${expectedModeResult.missing.join(', ')}\n`);
  }

  if (failures.length === 0 && warnings.length === 0) {
    console.log('PASS: No report governance failures detected.\n');
    return;
  }

  if (failures.length > 0) {
    console.log(`FAILURES (${failures.length})`);
    console.log('----------------');
    for (const failure of failures) {
      console.log(`\n[${failure.severity.toUpperCase()}] ${failure.code}`);
      console.log(failure.message);
      if (failure.evidence) console.log(`Evidence:\n${JSON.stringify(failure.evidence, null, 2)}`);
    }
    console.log('');
  }

  if (warnings.length > 0) {
    console.log(`WARNINGS (${warnings.length})`);
    console.log('----------------');
    for (const warning of warnings) {
      console.log(`\n[${warning.severity.toUpperCase()}] ${warning.code}`);
      console.log(warning.message);
      if (warning.evidence) console.log(`Evidence:\n${JSON.stringify(warning.evidence, null, 2)}`);
    }
    console.log('');
  }

  if (strictWarnings && warnings.length > 0) console.log('Strict warnings enabled: warnings are treated as failures.\n');
}

function failCli(message) {
  console.error(`ERROR: ${message}`);
  process.exit(2);
}
