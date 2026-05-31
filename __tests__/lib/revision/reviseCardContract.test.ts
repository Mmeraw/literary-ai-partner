import {
  candidateTextIsCopyPasteReady,
  customOperationLabels,
  getRenderableCandidateText,
  inferRevisionOperation,
  operationLabels,
  operationRequiresStructuralPreview,
  validateReviseCardContract,
} from '@/lib/revision/reviseCardContract'

describe('revise card contract', () => {
  test('accepts a ready card with exact source text, operation, location, and A/B/C candidate prose', () => {
    const result = validateReviseCardContract({
      issueStatement: 'The will language implies surrender rather than legal caution.',
      symptom: 'The clause reads as procedural detail instead of emotional consequence.',
      cause: 'The sentence overweights legal framing and underweights narrative signal.',
      fixStrategy: 'Insert a brief emotional bridge immediately after the clause.',
      readerImpact: 'Readers retain legal clarity while feeling the private stakes.',
      operationNote: 'insert_after_selected_passage · Chapter 2 — Search for Mr. Hyde, paragraph 3',
      sourceText: 'The lawyer read the clause again, and found it no less monstrous at the second reading.',
      sourceLocationLabel: 'Chapter 2 — Search for Mr. Hyde, paragraph 3',
      revisionOperation: 'insert_after_selected_passage',
      candidateTexts: [
        'To Mr. Utterson, this was no mere eccentricity of legal language.',
        'The lawyer read the clause again, and found in it not eccentricity but surrender.',
        'The paper had the dry face of law, but beneath it moved a private catastrophe.',
      ],
    })

    expect(result).toEqual({ readiness: 'ready_for_revise', reason: null })
  })

  test('keeps sparse-manuscript opportunities visible as needs targeting instead of failing the queue', () => {
    const result = validateReviseCardContract({
      issueStatement: 'The excerpt is too brief to prove whether the image pays off later.',
      symptom: 'Only one local image is available in the submitted sample.',
      cause: 'The submission is sparse, so global pattern evidence is unavailable.',
      fixStrategy: 'Render the item as cautionary targeting instead of suppressing the evaluation.',
      readerImpact: 'The author sees the limitation without losing the evaluation or Revise path.',
      operationNote: 'needs_targeting · Sparse 200-word submission',
      sourceText: 'No excerpt available — sparse submission requires author confirmation before A/B/C prose.',
      sourceLocationLabel: 'Location pending',
      revisionOperation: 'replace_selected_passage',
      candidateTexts: [
        'A valid replacement could exist here.',
        'A second valid replacement could exist here.',
        'A third valid replacement could exist here.',
      ],
    })

    expect(result.readiness).toBe('needs_targeting')
    expect(result.reason).toMatch(/source location/i)
  })

  test('allows ordinary manuscript prose containing modal verbs and common action verbs', () => {
    expect(candidateTextIsCopyPasteReady('She would have entered the chapel if the bell had not begun to shake.')).toBe(true)
    expect(candidateTextIsCopyPasteReady('He could not breathe until the lantern shows the empty room.')).toBe(true)
    expect(candidateTextIsCopyPasteReady('He moved to repair the latch before the wind reached the cradle.')).toBe(true)
    expect(candidateTextIsCopyPasteReady('The boy will carry the letter because no one else can lift it.')).toBe(true)
  })

  test('shunts no-excerpt and location-pending cards to needs targeting', () => {
    const result = validateReviseCardContract({
      issueStatement: 'The recommendation is not targetable yet.',
      symptom: 'No target location is specified.',
      cause: 'The item is still manuscript-wide and unresolved.',
      fixStrategy: 'Target a precise location before offering A/B/C.',
      readerImpact: 'Prevents accepting generic guidance as prose.',
      operationNote: 'needs_targeting · Location pending',
      sourceText: 'No excerpt available — this recommendation is based on patterns found across the manuscript rather than a single passage.',
      sourceLocationLabel: 'Location pending',
      revisionOperation: 'replace_selected_passage',
      candidateTexts: [
        'A valid replacement could exist here.',
        'A second valid replacement could exist here.',
        'A third valid replacement could exist here.',
      ],
    })

    expect(result.readiness).toBe('needs_targeting')
    expect(result.reason).toMatch(/source location/i)
  })

  test('blocks lazy meta-suggestion text from A/B/C candidates', () => {
    expect(candidateTextIsCopyPasteReady('Apply the same repair goal with a lighter touch, preserving more of the original cadence.')).toBe(false)
    expect(candidateTextIsCopyPasteReady('Preserve the existing order and add the smallest connective beat that restores clarity.')).toBe(false)
    expect(candidateTextIsCopyPasteReady('Making Newton’s decision and its fallout concrete will sharpen stakes and give readers a clear causal engine.')).toBe(false)
    expect(candidateTextIsCopyPasteReady('This revision improves Narrative Drive & Momentum by adding a clearer causal engine.')).toBe(false)
    expect(candidateTextIsCopyPasteReady('In the paragraph containing “hithery-thithery dock,” replace one rhyme-heavy clause.')).toBe(false)
    expect(candidateTextIsCopyPasteReady('PROSECONTROL:recommendation')).toBe(false)
    expect(candidateTextIsCopyPasteReady('The door stood in the row like a warning no one had chosen to read.')).toBe(true)
  })

  test('blocks word-processor and HTML artifact blobs from A/B/C candidates', () => {
    expect(candidateTextIsCopyPasteReady('v:* {behavior:url(#default#VML);} o:* {behavior:url(#default#VML);}')).toBe(false)
    expect(candidateTextIsCopyPasteReady('table.MsoNormalTable {mso-style-name:"Table Normal"; mso-pagination:widow-orphan;}')).toBe(false)
    expect(candidateTextIsCopyPasteReady('<style>table.MsoNormalTable{mso-style-name:"Table Normal";}</style>')).toBe(false)
  })

  test('routes cards to needs_targeting when A/B/C are not materially distinct', () => {
    const result = validateReviseCardContract({
      issueStatement: 'Internal conflict is stated but not yet dramatized in the line.',
      symptom: 'The line states conflict without dramatizing it.',
      cause: 'The sentence reports emotion instead of staging it.',
      fixStrategy: 'Replace line with dramatized physical beat.',
      readerImpact: 'Readers infer conflict through action instead of summary.',
      operationNote: 'replace_selected_passage · Chapter 2 — Search for Mr. Hyde, paragraph 4',
      sourceText: 'The voices in his head began to knock against one another.',
      sourceLocationLabel: 'Chapter 2 — Search for Mr. Hyde, paragraph 4',
      revisionOperation: 'replace_selected_passage',
      candidateTexts: [
        'The voices in his head began to knock against one another.',
        'The voices in his head began to knock against one another.',
        'The voices in his head began to knock against one another.',
      ],
    })

    expect(result.readiness).toBe('needs_targeting')
    expect(result.reason).toMatch(/materially distinct/i)
  })

  test('maps operation labels and custom labels deterministically', () => {
    expect(operationLabels.insert_after_selected_passage).toBe('Suggested insertion after passage')
    expect(operationLabels.replace_selected_passage).toBe('Suggested replacement')
    expect(customOperationLabels.insert_after_selected_passage).toBe('Write your custom insertion after this passage')
  })

  test('infers operation from fix direction and scope', () => {
    expect(inferRevisionOperation({ fixDirection: 'Insert a reaction beat after the will is described.', scope: 'Passage' })).toBe('insert_after_selected_passage')
    expect(inferRevisionOperation({ fixDirection: 'Compress this paragraph to reduce drag.', scope: 'Passage' })).toBe('compress_selected_passage')
    expect(inferRevisionOperation({ fixDirection: 'Replace the selected sentence with a cleaner rendering.', scope: 'Line' })).toBe('replace_selected_passage')
  })

  test('marks structural operations as preview-required', () => {
    expect(operationRequiresStructuralPreview('rewrite_multi_paragraph_span')).toBe(true)
    expect(operationRequiresStructuralPreview('delete_selected_passage')).toBe(true)
    expect(operationRequiresStructuralPreview('replace_selected_passage')).toBe(false)
  })

  test('routes short issue restatement to needs_targeting', () => {
    const result = validateReviseCardContract({
      issueStatement: 'The paragraph loses cause-and-effect clarity at the pivot.',
      symptom: 'Causal pivot is implied rather than explicit.',
      cause: 'The transition skips the motivating beat.',
      fixStrategy: 'Add a direct causal bridge sentence.',
      readerImpact: 'Restores continuity and reader trust.',
      operationNote: 'insert_after_selected_passage · Chapter 4 paragraph 2',
      sourceText: 'He turned away from the fire and said nothing for a long while.',
      sourceLocationLabel: 'Chapter 4 paragraph 2',
      revisionOperation: 'insert_after_selected_passage',
      candidateTexts: [
        'The paragraph loses cause-and-effect clarity at the pivot.',
        'He turned away from the fire, then admitted what he feared he had caused.',
        'He turned from the fire and finally named the consequence he had been avoiding.',
      ],
    })

    expect(result.readiness).toBe('needs_targeting')
    expect(result.reason).toMatch(/copy-paste ready/i)
  })

  test('allows longer manuscript prose that shares vocabulary with the issue statement', () => {
    const visible = getRenderableCandidateText({
      candidateText: 'The paragraph lost its cause-and-effect clarity only when he turned away from the fire, then named the consequence he had caused.',
      issueStatement: 'The paragraph loses cause-and-effect clarity at the pivot.',
    })

    expect(visible).toBe('The paragraph lost its cause-and-effect clarity only when he turned away from the fire, then named the consequence he had caused.')
  })

  test('hides candidate prose from renderer when candidate duplicates issue statement', () => {
    const hidden = getRenderableCandidateText({
      candidateText: 'The paragraph loses cause-and-effect clarity at the pivot.',
      issueStatement: 'The paragraph loses cause-and-effect clarity at the pivot.',
    })

    const visible = getRenderableCandidateText({
      candidateText: 'He turned away from the fire, then named the consequence he had caused.',
      issueStatement: 'The paragraph loses cause-and-effect clarity at the pivot.',
    })

    expect(hidden).toBe('')
    expect(visible).toBe('He turned away from the fire, then named the consequence he had caused.')
  })

  test('does not hide short prose based on overlap alone when text is not a direct restatement', () => {
    const visible = getRenderableCandidateText({
      candidateText: 'At the pivot, the paragraph lost cause-and-effect clarity, then he named it.',
      issueStatement: 'The paragraph loses cause-and-effect clarity at the pivot.',
    })

    expect(visible).toBe('At the pivot, the paragraph lost cause-and-effect clarity, then he named it.')
  })
})
