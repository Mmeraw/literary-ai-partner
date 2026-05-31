import {
  loadReviseQueueWarmupCorpus,
  REVISE_QUEUE_BENCHMARK_FILES,
  REVISE_QUEUE_WARMUP_FILES,
} from '@/lib/revision/reviseQueueWarmup'

describe('revise queue warmup corpus proof', () => {
  test('loads required warmup files with deterministic proof metadata', async () => {
    const corpus = await loadReviseQueueWarmupCorpus()

    expect(corpus.loadedAt).toBeTruthy()
    expect(corpus.combinedText.length).toBeGreaterThan(1000)

    expect(corpus.proof.fileCount).toBe(REVISE_QUEUE_WARMUP_FILES.length)
    expect(corpus.proof.benchmarkCount).toBe(REVISE_QUEUE_BENCHMARK_FILES.length)
    expect(corpus.proof.benchmarkFilesLoaded).toEqual([...REVISE_QUEUE_BENCHMARK_FILES])
    expect(corpus.proof.combinedBytes).toBeGreaterThan(1000)
    expect(corpus.proof.combinedSha256).toMatch(/^[a-f0-9]{64}$/)

    for (const file of REVISE_QUEUE_WARMUP_FILES) {
      expect(corpus.files[file]).toBeTruthy()
      expect(corpus.proof.perFile[file].bytes).toBeGreaterThan(0)
      expect(corpus.proof.perFile[file].sha256).toMatch(/^[a-f0-9]{64}$/)
    }
  })
})
