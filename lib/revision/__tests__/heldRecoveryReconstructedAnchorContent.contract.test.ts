import fs from 'node:fs'
import path from 'node:path'

import {
  buildReconstructedAnchorContent,
  type BuildReconstructedAnchorContentInput,
  type CanonicalSingleChunkSource,
  type ReconstructedAnchorAuthority,
  type ReconstructedAnchorContentResult,
} from '@/lib/revision/heldRecoveryReconstructedAnchorContent'
import { sourceHashForCanonicalChunkContent } from '@/lib/revision/heldRecoveryRuntimeInputs'
import { sourceHashFor } from '@/lib/revision/heldRecoveryVersioning'

// Canonical non-negative integer STRING (never a JS number). Using the maximum
// signed PostgreSQL bigint proves the exact value survives the builder unchanged
// even though it exceeds Number.MAX_SAFE_INTEGER and could not round-trip as a
// JS number.
const MANUSCRIPT_ID = '9223372036854775807'
const OTHER_MANUSCRIPT_ID = '9223372036854775806'
const MANUSCRIPT_VERSION_SHA = 'msv-sha-1'
const HELD_ITEM_PERSISTED_VERSION = 'hiv-1'
const CANONICAL_COORDINATES = 'ch3:p12'

const EVIDENCE = 'The quick brown fox watches the gate.'
const PREFIX = 'Opening context. '
const SUFFIX = ' Trailing context.'
const SOURCE_TEXT = `${PREFIX}${EVIDENCE}${SUFFIX}`
const EVIDENCE_START = PREFIX.length
const EVIDENCE_END = PREFIX.length + EVIDENCE.length

function chunkFor(content: string, absoluteStart: number): CanonicalSingleChunkSource {
  return {
    chunkId: 'chunk-1',
    manuscriptId: MANUSCRIPT_ID,
    manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
    contentAbsoluteStart: absoluteStart,
    contentAbsoluteEnd: absoluteStart + content.length,
    content,
    contentHash: sourceHashForCanonicalChunkContent(content),
  }
}

function authorityFor(overrides: Partial<ReconstructedAnchorAuthority> = {}): ReconstructedAnchorAuthority {
  return {
    manuscriptId: MANUSCRIPT_ID,
    manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
    heldItemPersistedVersion: HELD_ITEM_PERSISTED_VERSION,
    sourceHash: sourceHashFor({ source_text: SOURCE_TEXT.trim() }),
    sourceStartOffset: EVIDENCE_START,
    sourceEndOffset: EVIDENCE_END,
    recoveryMethod: 'source_text_location_only',
    completionFingerprint: 'fp-irrelevant-to-this-module',
    ...overrides,
  }
}

function baseInput(
  overrides: Partial<BuildReconstructedAnchorContentInput> = {},
): BuildReconstructedAnchorContentInput {
  return {
    authority: authorityFor(),
    canonicalSource: {
      manuscriptId: MANUSCRIPT_ID,
      manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
      text: SOURCE_TEXT,
    },
    chunk: chunkFor(SOURCE_TEXT, 0),
    canonicalManuscriptCoordinates: CANONICAL_COORDINATES,
    ...overrides,
  }
}

describe('buildReconstructedAnchorContent — success', () => {
  it('returns exactly the two computed fields: evidenceAnchor and manuscriptCoordinates', () => {
    const result = buildReconstructedAnchorContent(baseInput())

    expect(result).toEqual({
      status: 'built',
      value: {
        evidenceAnchor: EVIDENCE,
        manuscriptCoordinates: CANONICAL_COORDINATES,
      },
    })
    expect(result.status === 'built' && Object.keys(result.value).sort()).toEqual([
      'evidenceAnchor',
      'manuscriptCoordinates',
    ])
  })

  it('preserves leading and trailing whitespace inside the span exactly', () => {
    const evidenceWithWhitespace = '  padded evidence  '
    const source = `prefix${evidenceWithWhitespace}suffix`
    const start = 'prefix'.length
    const end = start + evidenceWithWhitespace.length
    const result = buildReconstructedAnchorContent(baseInput({
      authority: authorityFor({
        sourceHash: sourceHashFor({ source_text: source.trim() }),
        sourceStartOffset: start,
        sourceEndOffset: end,
      }),
      canonicalSource: { manuscriptId: MANUSCRIPT_ID, manuscriptVersionSha: MANUSCRIPT_VERSION_SHA, text: source },
      chunk: chunkFor(source, 0),
    }))

    expect(result.status).toBe('built')
    expect(result.status === 'built' && result.value.evidenceAnchor).toBe(evidenceWithWhitespace)
  })

  it('returns canonicalManuscriptCoordinates byte-for-byte unchanged, including internal whitespace', () => {
    const coordinatesWithWhitespace = '  ch3 : p12  '
    const result = buildReconstructedAnchorContent(
      baseInput({ canonicalManuscriptCoordinates: coordinatesWithWhitespace }),
    )

    expect(result.status).toBe('built')
    expect(result.status === 'built' && result.value.manuscriptCoordinates).toBe(coordinatesWithWhitespace)
  })

  it('does not mutate any input object', () => {
    const input = baseInput()
    const snapshot = JSON.parse(JSON.stringify(input))

    buildReconstructedAnchorContent(input)

    expect(input).toEqual(snapshot)
  })

  it('operates in trimmed-source coordinate space: outer whitespace on canonicalSource.text does not shift offsets', () => {
    const untrimmedSource = `   ${SOURCE_TEXT}   `
    const trimmed = untrimmedSource.trim()
    const chunkContent = trimmed.slice(EVIDENCE_START, EVIDENCE_END)
    const result = buildReconstructedAnchorContent(baseInput({
      authority: authorityFor({
        sourceHash: sourceHashFor({ source_text: untrimmedSource.trim() }),
        sourceStartOffset: EVIDENCE_START,
        sourceEndOffset: EVIDENCE_END,
      }),
      canonicalSource: { manuscriptId: MANUSCRIPT_ID, manuscriptVersionSha: MANUSCRIPT_VERSION_SHA, text: untrimmedSource },
      chunk: chunkFor(chunkContent, EVIDENCE_START),
    }))

    expect(result.status).toBe('built')
    expect(result.status === 'built' && result.value.evidenceAnchor).toBe(EVIDENCE)
  })
})

describe('buildReconstructedAnchorContent — hash mismatch', () => {
  it('rejects when the canonical chunk contentHash does not match its content', () => {
    expect(buildReconstructedAnchorContent(baseInput({
      chunk: { ...chunkFor(SOURCE_TEXT, 0), contentHash: 'forged-hash' },
    }))).toEqual({
      status: 'rejected',
      reason: 'chunk_content_hash_mismatch',
    })
  })

  it('rejects when authority.sourceHash disagrees with the hash of trimmed source_text', () => {
    expect(buildReconstructedAnchorContent(baseInput({
      authority: authorityFor({ sourceHash: 'not-the-real-hash' }),
    }))).toEqual({
      status: 'rejected',
      reason: 'authority_source_hash_mismatch',
    })
  })

  it('rejects an untrimmed-hash implementation as an alternate algorithm', () => {
    const paddedSource = `  ${SOURCE_TEXT}  `

    expect(buildReconstructedAnchorContent(baseInput({
      authority: authorityFor({ sourceHash: sourceHashFor({ source_text: paddedSource }) }),
      canonicalSource: { manuscriptId: MANUSCRIPT_ID, manuscriptVersionSha: MANUSCRIPT_VERSION_SHA, text: paddedSource },
      chunk: chunkFor(paddedSource, 0),
    }))).toEqual({
      status: 'rejected',
      reason: 'authority_source_hash_mismatch',
    })
  })
})

describe('buildReconstructedAnchorContent — malformed authority offsets', () => {
  it.each([
    authorityFor({ sourceStartOffset: -1 }),
    authorityFor({ sourceStartOffset: EVIDENCE_START, sourceEndOffset: EVIDENCE_START }),
    authorityFor({ sourceStartOffset: EVIDENCE_END, sourceEndOffset: EVIDENCE_START }),
    authorityFor({ sourceStartOffset: 1.5 }),
    authorityFor({ sourceEndOffset: Number.MAX_SAFE_INTEGER + 10 }),
  ])('rejects malformed authority offsets', (authority) => {
    expect(buildReconstructedAnchorContent(baseInput({ authority }))).toEqual({
      status: 'rejected',
      reason: 'malformed_authority_offsets',
    })
  })
})

describe('buildReconstructedAnchorContent — malformed chunk interval', () => {
  it.each([
    { ...chunkFor(SOURCE_TEXT, 0), contentAbsoluteEnd: 0 },
    { ...chunkFor(SOURCE_TEXT, 0), contentAbsoluteStart: -5, contentAbsoluteEnd: SOURCE_TEXT.length - 5 },
    { ...chunkFor(SOURCE_TEXT, 0), contentAbsoluteStart: 0.5 },
  ])('rejects malformed chunk offsets', (chunk) => {
    expect(buildReconstructedAnchorContent(baseInput({ chunk }))).toEqual({
      status: 'rejected',
      reason: 'malformed_chunk_offsets',
    })
  })
})

describe('buildReconstructedAnchorContent — cross-chunk span unsupported', () => {
  it('rejects a span that starts before the chunk', () => {
    const chunkStart = EVIDENCE_START + 5
    const chunkContent = SOURCE_TEXT.slice(chunkStart)

    expect(buildReconstructedAnchorContent(baseInput({ chunk: chunkFor(chunkContent, chunkStart) }))).toEqual({
      status: 'rejected',
      reason: 'cross_chunk_span_unsupported',
    })
  })

  it('rejects a span that ends after the chunk', () => {
    const chunkContent = SOURCE_TEXT.slice(0, EVIDENCE_END - 5)

    expect(buildReconstructedAnchorContent(baseInput({ chunk: chunkFor(chunkContent, 0) }))).toEqual({
      status: 'rejected',
      reason: 'cross_chunk_span_unsupported',
    })
  })

  it('rejects a span that only partially overlaps the supplied chunk on both sides', () => {
    const chunkContent = SOURCE_TEXT.slice(EVIDENCE_START + 3, EVIDENCE_END - 3)

    expect(buildReconstructedAnchorContent(baseInput({
      chunk: chunkFor(chunkContent, EVIDENCE_START + 3),
    }))).toEqual({
      status: 'rejected',
      reason: 'cross_chunk_span_unsupported',
    })
  })
})

describe('buildReconstructedAnchorContent — chunk content length mismatch', () => {
  it('rejects when contentAbsoluteEnd - contentAbsoluteStart does not equal content.length', () => {
    expect(buildReconstructedAnchorContent(baseInput({
      chunk: { ...chunkFor(SOURCE_TEXT, 0), contentAbsoluteEnd: SOURCE_TEXT.length + 5 },
    }))).toEqual({
      status: 'rejected',
      reason: 'chunk_content_length_mismatch',
    })
  })
})

describe('buildReconstructedAnchorContent — canonical chunk/source parity', () => {
  it('rejects a chunk with a valid self-hash whose content differs from the canonical-source slice', () => {
    const forgedContent = 'X'.repeat(EVIDENCE_END - EVIDENCE_START)

    expect(buildReconstructedAnchorContent(baseInput({
      chunk: {
        chunkId: 'forged',
        manuscriptId: MANUSCRIPT_ID,
        manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
        contentAbsoluteStart: EVIDENCE_START,
        contentAbsoluteEnd: EVIDENCE_END,
        content: forgedContent,
        contentHash: sourceHashForCanonicalChunkContent(forgedContent),
      },
    }))).toEqual({
      status: 'rejected',
      reason: 'chunk_canonical_source_mismatch',
    })
  })

  it('rejects a chunk whose interval extends beyond canonicalSource.text length', () => {
    const overrunContent = SOURCE_TEXT.slice(EVIDENCE_START) + 'EXTRA_TAIL'
    const start = EVIDENCE_START

    expect(buildReconstructedAnchorContent(baseInput({
      chunk: {
        chunkId: 'overrun',
        manuscriptId: MANUSCRIPT_ID,
        manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
        contentAbsoluteStart: start,
        contentAbsoluteEnd: start + overrunContent.length,
        content: overrunContent,
        contentHash: sourceHashForCanonicalChunkContent(overrunContent),
      },
    }))).toEqual({
      status: 'rejected',
      reason: 'chunk_canonical_source_mismatch',
    })
  })

  it('rejects a chunk whose content is correct but declared at the wrong absolute interval', () => {
    const genuineLeading = SOURCE_TEXT.slice(0, EVIDENCE_END - EVIDENCE_START)
    const wrongStart = EVIDENCE_START + 4
    const wrongEnd = wrongStart + genuineLeading.length
    expect(SOURCE_TEXT.slice(wrongStart, wrongEnd)).not.toBe(genuineLeading)

    expect(buildReconstructedAnchorContent(baseInput({
      authority: authorityFor({ sourceStartOffset: wrongStart, sourceEndOffset: wrongStart + 3 }),
      chunk: {
        chunkId: 'misplaced',
        manuscriptId: MANUSCRIPT_ID,
        manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
        contentAbsoluteStart: wrongStart,
        contentAbsoluteEnd: wrongEnd,
        content: genuineLeading,
        contentHash: sourceHashForCanonicalChunkContent(genuineLeading),
      },
    }))).toEqual({
      status: 'rejected',
      reason: 'chunk_canonical_source_mismatch',
    })
  })

  it('accepts a genuine sub-chunk at a non-zero interval and extracts against it', () => {
    const chunkStart = 4
    const chunkContent = SOURCE_TEXT.slice(chunkStart, EVIDENCE_END + 4)
    const result = buildReconstructedAnchorContent(baseInput({
      chunk: chunkFor(chunkContent, chunkStart),
    }))

    expect(result.status).toBe('built')
    expect(result.status === 'built' && result.value.evidenceAnchor).toBe(EVIDENCE)
  })

  it('applies parity in UTF-16 string-index space when supplementary-plane content precedes the chunk', () => {
    const emoji = '😀'
    const source = `${emoji} lead ${EVIDENCE} tail`
    const start = source.indexOf(EVIDENCE)
    const end = start + EVIDENCE.length
    const chunkStart = emoji.length + 1
    const chunkContent = source.slice(chunkStart, end + 3)

    const result = buildReconstructedAnchorContent(baseInput({
      authority: authorityFor({
        sourceHash: sourceHashFor({ source_text: source.trim() }),
        sourceStartOffset: start,
        sourceEndOffset: end,
      }),
      canonicalSource: { manuscriptId: MANUSCRIPT_ID, manuscriptVersionSha: MANUSCRIPT_VERSION_SHA, text: source },
      chunk: chunkFor(chunkContent, chunkStart),
    }))

    expect(result.status).toBe('built')
    expect(result.status === 'built' && result.value.evidenceAnchor).toBe(EVIDENCE)

    const forged = 'Z'.repeat(chunkContent.length)
    expect(buildReconstructedAnchorContent(baseInput({
      authority: authorityFor({
        sourceHash: sourceHashFor({ source_text: source.trim() }),
        sourceStartOffset: start,
        sourceEndOffset: end,
      }),
      canonicalSource: { manuscriptId: MANUSCRIPT_ID, manuscriptVersionSha: MANUSCRIPT_VERSION_SHA, text: source },
      chunk: {
        ...chunkFor(chunkContent, chunkStart),
        content: forged,
        contentHash: sourceHashForCanonicalChunkContent(forged),
      },
    }))).toEqual({
      status: 'rejected',
      reason: 'chunk_canonical_source_mismatch',
    })
  })

  it('applies canonical parity before the cross-chunk containment check', () => {
    const forgedContent = 'Y'.repeat(EVIDENCE_END - EVIDENCE_START)

    expect(buildReconstructedAnchorContent(baseInput({
      authority: authorityFor({
        sourceStartOffset: EVIDENCE_START,
        sourceEndOffset: EVIDENCE_END + 3,
      }),
      chunk: {
        chunkId: 'forged-and-too-short',
        manuscriptId: MANUSCRIPT_ID,
        manuscriptVersionSha: MANUSCRIPT_VERSION_SHA,
        contentAbsoluteStart: EVIDENCE_START,
        contentAbsoluteEnd: EVIDENCE_END,
        content: forgedContent,
        contentHash: sourceHashForCanonicalChunkContent(forgedContent),
      },
    }))).toEqual({
      status: 'rejected',
      reason: 'chunk_canonical_source_mismatch',
    })
  })
})

describe('buildReconstructedAnchorContent — identity failures', () => {
  it('rejects manuscript ID mismatches', () => {
    expect(buildReconstructedAnchorContent(baseInput({
      canonicalSource: { manuscriptId: OTHER_MANUSCRIPT_ID, manuscriptVersionSha: MANUSCRIPT_VERSION_SHA, text: SOURCE_TEXT },
    }))).toEqual({ status: 'rejected', reason: 'manuscript_identity_mismatch' })

    expect(buildReconstructedAnchorContent(baseInput({
      chunk: { ...chunkFor(SOURCE_TEXT, 0), manuscriptId: OTHER_MANUSCRIPT_ID },
    }))).toEqual({ status: 'rejected', reason: 'manuscript_identity_mismatch' })
  })

  it('rejects manuscript version mismatches', () => {
    expect(buildReconstructedAnchorContent(baseInput({
      canonicalSource: { manuscriptId: MANUSCRIPT_ID, manuscriptVersionSha: 'other-sha', text: SOURCE_TEXT },
    }))).toEqual({ status: 'rejected', reason: 'manuscript_version_mismatch' })

    expect(buildReconstructedAnchorContent(baseInput({
      chunk: { ...chunkFor(SOURCE_TEXT, 0), manuscriptVersionSha: 'other-sha' },
    }))).toEqual({ status: 'rejected', reason: 'manuscript_version_mismatch' })
  })

  it('rejects an unsupported recovery method', () => {
    expect(buildReconstructedAnchorContent(baseInput({
      authority: {
        ...authorityFor(),
        recoveryMethod: 'other_method' as ReconstructedAnchorAuthority['recoveryMethod'],
      },
    }))).toEqual({
      status: 'rejected',
      reason: 'unsupported_recovery_method',
    })
  })
})

describe('buildReconstructedAnchorContent — empty evidence and missing coordinates', () => {
  it('rejects missing canonical manuscript coordinates', () => {
    expect(buildReconstructedAnchorContent(baseInput({ canonicalManuscriptCoordinates: '' }))).toEqual({
      status: 'rejected',
      reason: 'missing_canonical_manuscript_coordinates',
    })

    expect(buildReconstructedAnchorContent(baseInput({ canonicalManuscriptCoordinates: '   ' }))).toEqual({
      status: 'rejected',
      reason: 'missing_canonical_manuscript_coordinates',
    })
  })
})

describe('buildReconstructedAnchorContent — Unicode / UTF-16 string-index offsets', () => {
  it('extracts an emoji-containing span using JS-string-index offsets', () => {
    const content = 'AA😀  anchor text  ZZ'
    const evidenceAnchor = '😀  anchor text  '
    const contentAbsoluteStart = 0
    const sourceStartOffset = contentAbsoluteStart + content.indexOf(evidenceAnchor)
    const sourceEndOffset = sourceStartOffset + evidenceAnchor.length
    expect(sourceStartOffset).toBeGreaterThanOrEqual(0)

    const result = buildReconstructedAnchorContent(baseInput({
      authority: authorityFor({
        sourceHash: sourceHashFor({ source_text: content.trim() }),
        sourceStartOffset,
        sourceEndOffset,
      }),
      canonicalSource: { manuscriptId: MANUSCRIPT_ID, manuscriptVersionSha: MANUSCRIPT_VERSION_SHA, text: content },
      chunk: chunkFor(content, contentAbsoluteStart),
    }))

    expect(result.status).toBe('built')
    const value = result.status === 'built' ? result.value : (undefined as unknown as ReconstructedAnchorContentResult)
    expect(value).toEqual({
      evidenceAnchor,
      manuscriptCoordinates: CANONICAL_COORDINATES,
    })
    expect(Object.keys(value).sort()).toEqual(['evidenceAnchor', 'manuscriptCoordinates'])
  })

  it('rejects a span that splits a surrogate pair at the chunk boundary as cross_chunk_span_unsupported', () => {
    const emoji = '😀'
    const source = `lead-${emoji}-trail`
    const emojiStart = 'lead-'.length
    const chunkContent = source.slice(0, emojiStart + 1)

    expect(buildReconstructedAnchorContent(baseInput({
      authority: authorityFor({
        sourceHash: sourceHashFor({ source_text: source.trim() }),
        sourceStartOffset: emojiStart,
        sourceEndOffset: emojiStart + emoji.length,
      }),
      canonicalSource: { manuscriptId: MANUSCRIPT_ID, manuscriptVersionSha: MANUSCRIPT_VERSION_SHA, text: source },
      chunk: chunkFor(chunkContent, 0),
    }))).toEqual({
      status: 'rejected',
      reason: 'cross_chunk_span_unsupported',
    })
  })
})

describe('buildReconstructedAnchorContent — source guards (secondary)', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'heldRecoveryReconstructedAnchorContent.ts'),
    'utf8',
  )

  it('never imports or calls Supabase', () => {
    expect(source).not.toMatch(/Supabase/)
  })

  it('never uses a `.from(` query builder call', () => {
    expect(source).not.toMatch(/\.from\(/)
  })

  it('never uses indexOf( to search for the anchor', () => {
    expect(source).not.toMatch(/indexOf\(/)
  })

  it('uses .trim( exactly once — only to reproduce the executor hash algorithm', () => {
    const matches = source.match(/\.trim\(/g) ?? []
    expect(matches.length).toBe(1)
  })

  it('never references re-admission, classification, or queue-transition production functions', () => {
    expect(source).not.toMatch(/runHeldRecoveryReconstructionReadmission/)
    expect(source).not.toMatch(/runReconstructionClassification/)
    expect(source).not.toMatch(/runReconstructionQueueTransition/)
    expect(source).not.toMatch(/decideHeldQueueTransition/)
  })

  it('never references recorded-attempt / series concepts', () => {
    expect(source).not.toMatch(/recordedAttempt/)
    expect(source).not.toMatch(/attemptNumber/)
    expect(source).not.toMatch(/seriesKey/)
  })

  it('never reads the opaque executorResult snapshot', () => {
    expect(source).not.toMatch(/executorResult/)
  })

  it('never converts a manuscript id from a number (no Number/parseInt/unary+/String(number))', () => {
    expect(source).not.toMatch(/Number\(/)
    expect(source).not.toMatch(/parseInt\(/)
    expect(source).not.toMatch(/parseFloat\(/)
    // unary plus applied to a manuscript identifier
    expect(source).not.toMatch(/\+\s*\w*[mM]anuscriptId/)
    // stringifying a numeric manuscript id would launder lost precision
    expect(source).not.toMatch(/String\([^)]*[mM]anuscriptId/)
  })
})

describe('buildReconstructedAnchorContent — canonical bigint manuscriptId fidelity', () => {
  it('carries the exact max signed PostgreSQL bigint string through to the result path unchanged', () => {
    // The builder returns only evidenceAnchor + manuscriptCoordinates, so we
    // prove fidelity by requiring the exact-string identity triple to be
    // accepted (build succeeds) for a value that exceeds Number.MAX_SAFE_INTEGER.
    expect(Number(MANUSCRIPT_ID) > Number.MAX_SAFE_INTEGER).toBe(true)
    const result = buildReconstructedAnchorContent(baseInput())
    expect(result.status).toBe('built')
  })

  it('accepts two distinct large bigint strings that would collide as JS numbers', () => {
    // 9223372036854775807 and ...806 both round to the same IEEE-754 double, so a
    // number-based identity check could not tell them apart. As strings they are
    // distinct and the mismatch is detected exactly.
    expect(Number(MANUSCRIPT_ID)).toBe(Number(OTHER_MANUSCRIPT_ID))
    // Compared as runtime strings (not narrowed literals): they are distinct.
    expect(String(MANUSCRIPT_ID) === String(OTHER_MANUSCRIPT_ID)).toBe(false)
    expect(buildReconstructedAnchorContent(baseInput({
      canonicalSource: { manuscriptId: OTHER_MANUSCRIPT_ID, manuscriptVersionSha: MANUSCRIPT_VERSION_SHA, text: SOURCE_TEXT },
    }))).toEqual({ status: 'rejected', reason: 'manuscript_identity_mismatch' })
  })

  it('requires all three identity sources (authority, canonicalSource, chunk) to match exactly', () => {
    // authority mismatches the (matching) source+chunk pair
    expect(buildReconstructedAnchorContent(baseInput({
      authority: authorityFor({ manuscriptId: OTHER_MANUSCRIPT_ID }),
    }))).toEqual({ status: 'rejected', reason: 'manuscript_identity_mismatch' })
  })
})
