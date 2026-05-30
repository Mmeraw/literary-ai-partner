import {
  candidateTextIsCopyPasteReady,
  customOperationLabels,
  inferRevisionOperation,
  operationLabels,
  operationRequiresStructuralPreview,
  validateReviseCardContract,
} from '@/lib/revision/reviseCardContract'

describe('revise card contract', () => {
  test('accepts a ready card with exact source text, operation, location, and A/B/C candidate prose', () => {
    const result = validateReviseCardContract({
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

  test('shunts no-excerpt and location-pending cards to needs targeting', () => {
    const result = validateReviseCardContract({
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
    expect(candidateTextIsCopyPasteReady('The door stood in the row like a warning no one had chosen to read.')).toBe(true)
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
})
