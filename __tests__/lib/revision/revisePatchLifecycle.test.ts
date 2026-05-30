import {
  applyPatchFromPreview,
  buildCandidatePatch,
  buildCustomPatch,
  buildPatchPreview,
  ensurePatchProse,
  sha256,
} from '@/lib/revision/revisePatchLifecycle'

describe('revise patch lifecycle safety', () => {
  test('blocks non-prose custom text and accepts manuscript prose', () => {
    expect(ensurePatchProse('Make this more emotional.').ok).toBe(false)
    expect(ensurePatchProse('The lawyer read the clause again, and found in it not eccentricity but surrender.').ok).toBe(true)
  })

  test('builds custom patch as a first-class candidate preserving operation', () => {
    const custom = buildCustomPatch({
      reviseQueueItemId: 'opp-1',
      revisionOperation: 'insert_after_selected_passage',
      sourceTextSnapshot: 'Original source passage.',
      sourceLocation: { chapter_index: 2, paragraph_index: 3 },
      baseManuscriptVersionId: 'mv-100',
      customText: 'Inserted custom prose.',
      sourceOption: 'from_scratch',
      createdAt: '2026-05-30T00:00:00.000Z',
    })

    expect(custom.applicationStatus).toBe('not_applied')
    expect(custom.revisionOperation).toBe('insert_after_selected_passage')
    expect(custom.sourceTextHash).toBe(sha256('Original source passage.'))
  })

  test('blocks apply unless previewed first', () => {
    const patch = buildCandidatePatch({
      reviseQueueItemId: 'opp-2',
      selectedSource: 'A',
      revisionOperation: 'replace_selected_passage',
      sourceTextSnapshot: 'Before text.',
      sourceLocation: { chapter_index: 1, paragraph_index: 1 },
      baseManuscriptVersionId: 'mv-200',
      patchText: 'After replacement text that is valid prose.',
    })

    const preview = buildPatchPreview(patch, '2026-05-30T00:00:00.000Z')
    const result = applyPatchFromPreview({
      preview,
      decisionStatus: 'accepted_a',
      applicationStatus: 'not_applied',
      currentSourceText: 'Before text.',
      currentSourceTextHash: sha256('Before text.'),
      requestedAt: '2026-05-30T00:05:00.000Z',
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected apply to be blocked')
    expect(result.reason).toMatch(/preview confirmation is required/i)
  })

  test('blocks apply when source hash changed and marks conflict_detected', () => {
    const patch = buildCandidatePatch({
      reviseQueueItemId: 'opp-3',
      selectedSource: 'custom',
      revisionOperation: 'replace_selected_passage',
      sourceTextSnapshot: 'Before text.',
      sourceLocation: { chapter_index: 4, paragraph_index: 1 },
      baseManuscriptVersionId: 'mv-300',
      patchText: 'Custom replacement prose for this passage.',
    })

    const preview = buildPatchPreview(patch, '2026-05-30T00:00:00.000Z')
    const result = applyPatchFromPreview({
      preview,
      decisionStatus: 'custom_written',
      applicationStatus: 'previewed',
      currentSourceText: 'Before text changed externally.',
      currentSourceTextHash: sha256('Before text changed externally.'),
      requestedAt: '2026-05-30T00:10:00.000Z',
    })

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected conflict result')
    expect(result.applicationStatus).toBe('conflict_detected')
  })

  test('applies from preview by producing a new manuscript version id and audit record', () => {
    const patch = buildCandidatePatch({
      reviseQueueItemId: 'opp-4',
      selectedSource: 'B',
      revisionOperation: 'replace_selected_passage',
      sourceTextSnapshot: 'Before text.',
      sourceLocation: { chapter_index: 2, paragraph_index: 5 },
      baseManuscriptVersionId: 'mv-400',
      patchText: 'After text that can be copied directly into the manuscript.',
    })
    const preview = buildPatchPreview(patch, '2026-05-30T00:00:00.000Z')

    const result = applyPatchFromPreview({
      preview,
      decisionStatus: 'accepted_b',
      applicationStatus: 'previewed',
      currentSourceText: 'Before text.',
      currentSourceTextHash: sha256('Before text.'),
      requestedAt: '2026-05-30T00:12:00.000Z',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('Expected success result')
    expect(result.manuscriptVersionAfter).not.toBe(result.manuscriptVersionBefore)
    expect(result.appliedPatchRecord.selected_source).toBe('B')
    expect(result.appliedPatchRecord.revision_operation).toBe('replace_selected_passage')
  })
})
