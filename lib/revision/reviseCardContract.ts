export const REVISION_OPERATIONS = [
  'replace_selected_passage',
  'insert_before_selected_passage',
  'insert_after_selected_passage',
  'rewrite_full_paragraph',
  'rewrite_multi_paragraph_span',
  'compress_selected_passage',
  'delete_selected_passage',
  'split_paragraph',
  'merge_paragraphs',
  'reorder_within_section',
  'needs_targeting',
] as const

export type RevisionOperation = typeof REVISION_OPERATIONS[number]

export type RevisionReadiness = 'ready_for_revise' | 'needs_targeting'

export type PatchApplicationStatus =
  | 'not_applied'
  | 'previewed'
  | 'applied'
  | 'failed'
  | 'conflict_detected'

export type RevisionOptionRole =
  | 'recommended_repair'
  | 'rhythm_variant'
  | 'bolder_rendering_shift'

export type ReviseCardValidationInput = {
  issueStatement?: string | null | undefined
  symptom?: string | null | undefined
  cause?: string | null | undefined
  fixStrategy?: string | null | undefined
  readerImpact?: string | null | undefined
  operationNote?: string | null | undefined
  sourceText: string | null | undefined
  sourceLocationLabel: string | null | undefined
  hasManuscriptWideSupport?: boolean | null | undefined
  revisionOperation: RevisionOperation | null | undefined
  candidateTexts: Array<string | null | undefined>
}

export type ReviseCardValidationResult = {
  readiness: RevisionReadiness
  reason: string | null
}

export const operationLabels: Record<RevisionOperation, string> = {
  replace_selected_passage: 'Suggested replacement',
  insert_before_selected_passage: 'Suggested insertion before passage',
  insert_after_selected_passage: 'Suggested insertion after passage',
  rewrite_full_paragraph: 'Suggested paragraph rewrite',
  rewrite_multi_paragraph_span: 'Suggested multi-paragraph rewrite',
  compress_selected_passage: 'Suggested compressed version',
  delete_selected_passage: 'Suggested deletion',
  split_paragraph: 'Suggested split',
  merge_paragraphs: 'Suggested merged passage',
  reorder_within_section: 'Suggested reordered sequence',
  needs_targeting: 'Needs targeting before revise',
}

export const customOperationLabels: Record<RevisionOperation, string> = {
  replace_selected_passage: 'Write your custom replacement',
  insert_before_selected_passage: 'Write your custom insertion before this passage',
  insert_after_selected_passage: 'Write your custom insertion after this passage',
  rewrite_full_paragraph: 'Write your custom paragraph rewrite',
  rewrite_multi_paragraph_span: 'Write your custom multi-paragraph rewrite',
  compress_selected_passage: 'Write your custom compressed version',
  delete_selected_passage: 'Write your custom deletion note',
  split_paragraph: 'Write your custom split version',
  merge_paragraphs: 'Write your custom merged passage',
  reorder_within_section: 'Write your custom reordered sequence',
  needs_targeting: 'Target this issue before writing custom prose',
}

export const REVISION_OPTION_LABELS = {
  A: 'A — Recommended Repair',
  B: 'B — Rhythm Variant',
  C: 'C — Bolder Rendering Shift',
} as const

const FORBIDDEN_META_SUGGESTIONS = [
  'review this opportunity',
  'apply the same repair goal',
  'choose the least disruptive repair',
  'preserve the existing order',
  'smallest connective beat',
  'lowest-disruption approach',
  'higher-leverage option',
  'default repair plan',
  'default plan drawn from the evaluation',
  'preserves author voice',
  'preserve author voice',
  'stronger emphasis, image, or beat structure',
  'add the smallest connective beat',
  're-sequence or deepen the affected beat',
  're-sequence or deepen',
  'author-controlled cadence',
  'default repair path',
  'primary repair path from the evaluation',
  'higher-leverage option when local polish is not enough',
  'in the paragraph containing',
  'replace one clause',
  'replace one rhyme-heavy clause',
  'replace this passage',
  'repair this passage',
  'fix this passage',
  'recommended repair path',
  'primary repair path',
  'will sharpen stakes',
  'causal engine',
  'this revision improves',
  'making newton',
  'gives readers',
  'evaluation_result',
  'criteria.recommendations',
  'prosecontrol',
  'narrativedrive',
  'recommendation',
  'onto the page',
  'on the page',
  'the scene moved forward',
  'the reader could feel',
  'the pressure visible',
  'the next action carried',
  'forcing the choice',
  'a cost the reader',
  'visible point of no return',
  'the consequence landed',
  'the consequence lands',
  'turning the exchange into',
  'keeps forward momentum',
  'forward momentum',
  'pressure stays visible',
  'answers in motion',
  'physical beat carries',
  'sharper physical image',
  'abstract pressure',
  'visible consequence',
  'immediate consequence',
  'consequence on the page',
  'without a pause for explanation',
  'a pause for explanation',
  'bolder prose move',
  'stronger prose move',
  'assertive prose',
  'more assertive',
  'cadence shift',
  'rendering shift',
  'prose move',
]

const MISSING_SOURCE_MARKERS = [
  'no excerpt available',
  'location pending',
  'manuscript-wide pattern',
  'available in diagnostic details',
]

const META_EDITORIAL_PATTERNS = [
  /\bshould\s+(?:be|consider|use|show|clarify|strengthen|expand|repair|fix|add|include|replace|compress|delete|move)\b/i,
  /\bcould\s+(?:be|use|clarify|strengthen|expand|repair|fix|add|include|replace|compress|delete|move)\b/i,
  /\bwould\s+(?:improve|clarify|strengthen|sharpen|help|give readers|make the|raise the|lower the)\b/i,
  /\bwill\s+(?:improve|clarify|strengthen|sharpen|help|give readers|make the|raise the|lower the)\b/i,
  /\bgives readers\b/i,
  /\bshows\s+(?:that|how|why|the reader|readers)\b/i,
  /\bexpand\s+(?:the|this|that|on|into)\b/i,
  /\bclarif(?:y|ies)\s+(?:the|this|that|how|why)\b/i,
  /\bstrengthen\s+(?:the|this|that)\b/i,
  /\bfix(?:es)?\s+(?:the|this|that)\s+(?:passage|paragraph|section|line|sentence|draft|prose|wording|flow|cadence|rhythm|issue)\b/i,
  /\brepair(?:s)?\s+(?:the|this|that)\s+(?:passage|paragraph|section|line|sentence|draft|prose|wording|flow|cadence|rhythm|issue)\b/i,
  /\bkeeps? momentum\b/i,
  /\bcausal engine\b/i,
  /\bprimary repair path\b/i,
  /\bsecondary variant\b/i,
  /\balternative variant\b/i,
  /\bfrom the evaluation\b/i,
  /\brecommended repair\b/i,
  /\brhythm variant\b/i,
  /\bbolder rendering\b/i,
  /\bsuggested replacement\b/i,
  /\bpreserve author voice\b/i,
  /\bapply the same repair goal\b/i,
  /\breview this opportunity\b/i,
  // Abstract beat-sheet patterns — prose that describes narrative beats without character names
  /\bthe (?:moment|beat|scene|choice|action|exchange|consequence) (?:held|forced|carried|landed|lands|turned|turns|made|moved|moves)\b/i,
  /\bforcing the (?:choice|decision|moment|action)\b/i,
  /\b(?:onto|on) the page\b/i,
  /\bthe scene (?:moved|moves) forward\b/i,
  /\bthe reader (?:could|can|will) feel\b/i,
  /\bthe pressure (?:visible|stays visible|remains visible|becomes visible)\b/i,
  /\bthe next action carried\b/i,
  /\brefusal remained possible\b/i,
  /\bpoint of no return\b/i,
  /\bvisible point of\b/i,
  /\bthe consequence.* land(?:ed|s)\b/i,
  /\bturning the exchange\b/i,
  // Imperative editorial verbs at sentence boundaries — "Highlight X", "Sharpen the Y", etc.
  /(?:^|[.!?]\s+)(?:highlight|sharpen|clarify|strengthen|deepen|compress|tighten|expand|foreground|underscore|dramatize|intensify|surface|ground|anchor)\s+(?:the|this|that|how|what|answers|details|moments|images|beats|prose|stakes|tension|pressure|conflict|character)/i,
  // Abstract narrative-mechanics language (no character names, describes what prose "does")
  /\b(?:a|the) (?:physical|narrative|dramatic|emotional|structural|tonal|rhythmic) beat\b/i,
  /\b(?:abstract|concrete|visible|immediate|tangible|physical) (?:pressure|consequence|tension|stakes|momentum)\b/i,
  /\bkeeps? (?:forward )?momentum\b/i,
  /\bpressure (?:stays|remains|becomes) visible\b/i,
  /\banswers in motion\b/i,
  /\bwithout a pause for (?:explanation|breath)\b/i,
  /\bcadence (?:shift|change|variation)\b/i,
  /\brendering shift\b/i,
  /\bprose (?:move|rhythm|beat|shift)\b/i,
  /\b(?:more |most )?assertive prose\b/i,
]

const WORD_PROCESSOR_ARTIFACT_PATTERNS = [
  /(?:^|\s)[vow]:\*\s*\{\s*behavior\s*:\s*url\(#default#vml\)\s*;?\s*\}/i,
  /(?:^|\s)\.shape\s*\{\s*behavior\s*:\s*url\(#default#vml\)\s*;?\s*\}/i,
  /\btable\.msonormaltable\b/i,
  /\bmso-style-name\b/i,
  /\bmso-tstyle-rowband-size\b/i,
  /\bmso-tstyle-colband-size\b/i,
  /\bmso-pagination\b/i,
  /\/\*\s*style definitions\s*\*\//i,
  /\bshape\s+\\\*\s+mergeformat\b/i,
  /\bnormal\s+0\s+false\b/i,
  /\bx-none\b/i,
  /\bbehavior\s*:\s*url\(#default#vml\)\b/i,
  /<\/?(?:html|head|body|style|xml|meta|o:p|v:[^>\s]+|w:[^>\s]+|st1:[^>\s]+)[^>]*>/i,
]

function normalize(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

function tokenSet(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean),
  )
}

function overlapRatio(a: string, b: string): number {
  const left = tokenSet(a)
  const right = tokenSet(b)
  if (left.size === 0 || right.size === 0) return 0
  let overlap = 0
  for (const token of left) {
    if (right.has(token)) overlap += 1
  }
  return overlap / Math.max(left.size, right.size)
}

function proseTokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function sharedLeadingTokenCount(a: string, b: string): number {
  const left = proseTokens(a)
  const right = proseTokens(b)
  const limit = Math.min(left.length, right.length)
  let count = 0
  for (let i = 0; i < limit; i += 1) {
    if (left[i] !== right[i]) break
    count += 1
  }
  return count
}

function hasInternalTokenLeak(value: string): boolean {
  const clean = normalize(value)
  if (!clean) return false

  if (/\b[A-Z]{3,}:[a-z_]+\b/.test(clean)) return true
  if (/\b(?:evaluation_result|criteria\.recommendations|prosecontrol|narrativedrive|provenance)\b/i.test(clean)) {
    return true
  }

  return false
}

function hasMetaEditorialPattern(value: string): boolean {
  const clean = normalize(value)
  if (!clean) return false
  return META_EDITORIAL_PATTERNS.some((pattern) => pattern.test(clean))
}

function candidateRepeatsIssueStatement(candidateText: string, issueStatement: string): boolean {
  const candidate = normalize(candidateText).toLowerCase()
  const issue = normalize(issueStatement).toLowerCase()
  if (!candidate || !issue) return false

  if (candidate === issue) return true

  // A candidate that is only a short diagnostic restatement must be hidden.
  // Longer manuscript prose is allowed to share vocabulary with the issue statement.
  const candidateWordCount = candidate.split(/\s+/).filter(Boolean).length
  if (candidateWordCount <= 12 && (candidate.includes(issue) || issue.includes(candidate))) return true

  return false
}

export function hasForbiddenMetaSuggestion(value: string | null | undefined): boolean {
  const clean = normalize(value).toLowerCase()
  if (!clean) return false
  return FORBIDDEN_META_SUGGESTIONS.some((phrase) => clean.includes(phrase))
}

export function hasWordProcessorArtifact(value: string | null | undefined): boolean {
  const clean = normalize(value)
  if (!clean) return false
  if (WORD_PROCESSOR_ARTIFACT_PATTERNS.some((pattern) => pattern.test(clean))) return true
  if (/<\/?[a-z][\w:-]*[^>]*>/i.test(clean)) return true
  if (/&(?:nbsp|quot|lt|gt|amp);|&#160;/i.test(clean)) return true
  return false
}

export function isMissingSourceMarker(value: string | null | undefined): boolean {
  const clean = normalize(value).toLowerCase()
  if (!clean) return true
  return MISSING_SOURCE_MARKERS.some((marker) => clean.includes(marker))
}

export function candidateTextIsCopyPasteReady(value: string | null | undefined): boolean {
  const clean = normalize(value)
  if (!clean) return false
  if (hasWordProcessorArtifact(clean)) return false
  if (hasForbiddenMetaSuggestion(clean)) return false
  if (hasMetaEditorialPattern(clean)) return false
  if (hasInternalTokenLeak(clean)) return false

  // Copy-paste prose must have at least enough substance to be a manuscript patch.
  // This intentionally allows short insertions, but blocks one-word placeholders.
  return clean.split(/\s+/).length >= 5
}

export function getRenderableCandidateText(input: {
  candidateText: string | null | undefined
  issueStatement?: string | null | undefined
}): string {
  const candidateText = normalize(input.candidateText)
  const issueStatement = normalize(input.issueStatement)

  if (!candidateTextIsCopyPasteReady(candidateText)) return ''
  if (issueStatement && candidateRepeatsIssueStatement(candidateText, issueStatement)) return ''
  return candidateText
}

export function validateReviseCardContract(input: ReviseCardValidationInput): ReviseCardValidationResult {
  if (!normalize(input.issueStatement)) {
    return { readiness: 'needs_targeting', reason: 'Missing issue statement.' }
  }

  if (!normalize(input.symptom)) {
    return { readiness: 'needs_targeting', reason: 'Missing diagnostic symptom.' }
  }

  if (!normalize(input.cause)) {
    return { readiness: 'needs_targeting', reason: 'Missing diagnostic cause.' }
  }

  if (!normalize(input.fixStrategy)) {
    return { readiness: 'needs_targeting', reason: 'Missing diagnostic fix strategy.' }
  }

  if (!normalize(input.readerImpact)) {
    return { readiness: 'needs_targeting', reason: 'Missing diagnostic reader impact.' }
  }

  if (!normalize(input.operationNote)) {
    return { readiness: 'needs_targeting', reason: 'Missing operation or targeting note.' }
  }

  if (!input.revisionOperation) {
    return { readiness: 'needs_targeting', reason: 'Missing revision operation.' }
  }

  if (input.revisionOperation === 'needs_targeting') {
    return { readiness: 'needs_targeting', reason: 'Revision operation still needs targeting.' }
  }

  const hasSourceLocation = normalize(input.sourceLocationLabel) && !isMissingSourceMarker(input.sourceLocationLabel)
  const hasSourceText = normalize(input.sourceText) && !isMissingSourceMarker(input.sourceText)
  const hasManuscriptWideSupport = Boolean(input.hasManuscriptWideSupport)

  if (!hasSourceLocation && !hasSourceText) {
    return { readiness: 'needs_targeting', reason: 'Missing exact source location or source passage.' }
  }

  if (!hasSourceText && !hasManuscriptWideSupport) {
    return { readiness: 'needs_targeting', reason: 'Missing evidence excerpt or manuscript-wide support.' }
  }

  if (input.candidateTexts.length !== 3) {
    return { readiness: 'needs_targeting', reason: 'Missing exact A/B/C candidate patches.' }
  }

  const invalidIndex = input.candidateTexts.findIndex((text) => {
    const clean = normalize(text)
    if (!candidateTextIsCopyPasteReady(clean)) return true
    return candidateRepeatsIssueStatement(clean, normalize(input.issueStatement))
  })
  if (invalidIndex !== -1) {
    return { readiness: 'needs_targeting', reason: `Candidate ${String.fromCharCode(65 + invalidIndex)} is not copy-paste ready.` }
  }

  const normalizedCandidates = input.candidateTexts
    .slice(0, 3)
    .map((text) => normalize(text).toLowerCase())

  if (new Set(normalizedCandidates).size < 3) {
    return { readiness: 'needs_targeting', reason: 'Candidate options are not materially distinct.' }
  }

  const [a, b, c] = normalizedCandidates
  if (overlapRatio(a, b) >= 0.9 || overlapRatio(a, c) >= 0.9 || overlapRatio(b, c) >= 0.9) {
    return { readiness: 'needs_targeting', reason: 'Candidate options are not materially distinct.' }
  }

  const sharedLeadInLimit = 4
  if (
    sharedLeadingTokenCount(a, b) >= sharedLeadInLimit
    || sharedLeadingTokenCount(a, c) >= sharedLeadInLimit
    || sharedLeadingTokenCount(b, c) >= sharedLeadInLimit
  ) {
    return { readiness: 'needs_targeting', reason: 'Candidate options are not materially distinct.' }
  }

  return { readiness: 'ready_for_revise', reason: null }
}

export function inferRevisionOperation(input: {
  scope?: string | null
  mode?: string | null
  fixDirection?: string | null
  recommendation?: string | null
}): RevisionOperation {
  const scope = normalize(input.scope).toLowerCase()
  const haystack = [input.fixDirection, input.recommendation, input.mode, input.scope]
    .map(normalize)
    .join(' ')
    .toLowerCase()

  if (/\b(insert|add|include|introduce)\b/.test(haystack) && /\bbefore\b/.test(haystack)) return 'insert_before_selected_passage'
  if (/\b(insert|add|include|introduce)\b/.test(haystack)) return 'insert_after_selected_passage'
  if (/\b(compress|condense|trim|tighten|shorten)\b/.test(haystack)) return 'compress_selected_passage'
  if (/\b(delete|remove|cut)\b/.test(haystack)) return 'delete_selected_passage'
  if (/\bsplit\b/.test(haystack)) return 'split_paragraph'
  if (/\bmerge\b/.test(haystack)) return 'merge_paragraphs'
  if (/\b(reorder|re-sequence|resequence)\b/.test(haystack)) return 'reorder_within_section'

  if (scope === 'line' || scope === 'passage') return 'replace_selected_passage'
  if (scope === 'scene' || scope === 'chapter' || scope === 'structural' || scope === 'manuscript') return 'rewrite_multi_paragraph_span'

  return 'replace_selected_passage'
}

export function operationRequiresStructuralPreview(operation: RevisionOperation): boolean {
  return [
    'rewrite_multi_paragraph_span',
    'delete_selected_passage',
    'merge_paragraphs',
    'reorder_within_section',
  ].includes(operation)
}
