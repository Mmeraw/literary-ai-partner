import { readFile } from 'fs/promises'
import { join } from 'path'
import { createHash } from 'crypto'

export const REVISE_QUEUE_WARMUP_FILES = [
  'docs/prompts/phase-0-revise-queue-warmup.md',
  'docs/canon/revise-queue-v2-contract.md',
  'docs/canon/revise-queue-six-part-diagnostic.md',
  'docs/gold-standards/revise-queue-rendering-exemplars.md',
  'docs/gold-standards/revise-queue-invalid-examples.md',
  // Ten-layer benchmarked story ledgers and governing contracts used during warmup calibration.
  'docs/STORY_LEDGER_QUALITY_GATE.md',
  'docs/canon/STORY_LEDGER_SEMANTIC_INTEGRITY_CONTRACT.md',
  'docs/benchmarks/froggin-noggin-dream-v2-governed-ledger-addendum.md',
  'docs/benchmarks/let-the-river-decide-dream-v2-governed-ledger-addendum.md',
  'docs/benchmarks/cartel-babies-dream-longform-multilayer-gold-standard.md',
] as const

export const REVISE_QUEUE_BENCHMARK_FILES = [
  'docs/benchmarks/froggin-noggin-dream-v2-governed-ledger-addendum.md',
  'docs/benchmarks/let-the-river-decide-dream-v2-governed-ledger-addendum.md',
  'docs/benchmarks/cartel-babies-dream-longform-multilayer-gold-standard.md',
] as const

export type ReviseQueueWarmupFileProof = {
  sha256: string
  bytes: number
}

export type ReviseQueueWarmupProof = {
  combinedSha256: string
  combinedBytes: number
  fileCount: number
  benchmarkCount: number
  benchmarkFilesLoaded: string[]
  perFile: Record<(typeof REVISE_QUEUE_WARMUP_FILES)[number], ReviseQueueWarmupFileProof>
}

export type ReviseQueueWarmupCorpus = {
  loadedAt: string
  files: Record<(typeof REVISE_QUEUE_WARMUP_FILES)[number], string>
  combinedText: string
  proof: ReviseQueueWarmupProof
}

let warmupCorpusPromise: Promise<ReviseQueueWarmupCorpus> | null = null

function workspacePath(relativePath: string): string {
  return join(process.cwd(), relativePath)
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function readRequiredFile(relativePath: string): Promise<string> {
  const content = await readFile(workspacePath(relativePath), 'utf8')
  if (!content.trim()) {
    throw new Error(`Revise Queue warmup file is empty: ${relativePath}`)
  }
  return content
}

export async function loadReviseQueueWarmupCorpus(): Promise<ReviseQueueWarmupCorpus> {
  if (!warmupCorpusPromise) {
    warmupCorpusPromise = (async () => {
      const files = {} as Record<(typeof REVISE_QUEUE_WARMUP_FILES)[number], string>
      const perFile = {} as Record<(typeof REVISE_QUEUE_WARMUP_FILES)[number], ReviseQueueWarmupFileProof>
      for (const file of REVISE_QUEUE_WARMUP_FILES) {
        files[file] = await readRequiredFile(file)
        perFile[file] = {
          sha256: sha256(files[file]),
          bytes: Buffer.byteLength(files[file], 'utf8'),
        }
      }

      const missingBenchmarks = REVISE_QUEUE_BENCHMARK_FILES.filter((file) => !REVISE_QUEUE_WARMUP_FILES.includes(file))
      if (missingBenchmarks.length > 0) {
        throw new Error(`Revise Queue warmup missing benchmark authorities: ${missingBenchmarks.join(', ')}`)
      }

      const combinedText = REVISE_QUEUE_WARMUP_FILES.map((file) => `## ${file}\n\n${files[file]}`).join('\n\n---\n\n')

      return {
        loadedAt: new Date().toISOString(),
        files,
        combinedText,
        proof: {
          combinedSha256: sha256(combinedText),
          combinedBytes: Buffer.byteLength(combinedText, 'utf8'),
          fileCount: REVISE_QUEUE_WARMUP_FILES.length,
          benchmarkCount: REVISE_QUEUE_BENCHMARK_FILES.length,
          benchmarkFilesLoaded: [...REVISE_QUEUE_BENCHMARK_FILES],
          perFile,
        },
      }
    })().catch((error) => {
      warmupCorpusPromise = null
      throw error
    })
  }

  return warmupCorpusPromise
}