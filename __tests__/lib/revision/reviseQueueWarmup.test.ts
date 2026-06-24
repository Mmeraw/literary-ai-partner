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

  test('loads the full runtime benchmark family for Revise calibration', async () => {
    const corpus = await loadReviseQueueWarmupCorpus()

    for (const path of [
      'docs/benchmarks/RUNTIME_BENCHMARK_AUTHORITY_MAP.md',
      'docs/benchmarks/return-to-the-source-dream-longform-multilayer-gold-standard.md',
      'docs/benchmarks/lost-world-of-mythoamphibia-dream-longform-multilayer-gold-standard.md',
      'docs/benchmarks/cartel-babies-dream-longform-multilayer-gold-standard.md',
      'docs/benchmarks/cartel-babies-criminal-network-suspense-architecture-addendum.md',
      'docs/benchmarks/let-the-river-decide-dream-longform-multilayer-gold-standard.md',
      'docs/benchmarks/let-the-river-decide-expedition-wilderness-architecture-addendum.md',
      'docs/benchmarks/froggin-noggin-dream-longform-multilayer-gold-standard.md',
      'docs/benchmarks/public-domain/dracula-dream-calibration.md',
      'docs/benchmarks/public-domain/great-expectations-dream-calibration.md',
      'docs/benchmarks/public-domain/pride-and-prejudice-dream-calibration.md',
      'docs/benchmarks/public-domain/the-awakening-dream-calibration.md',
      'docs/benchmarks/public-domain/the-wonderful-wizard-of-oz-dream-calibration.md',
      'docs/benchmarks/public-domain/the-murder-on-the-links-dream-calibration-multilayer-addendum.md',
    ]) {
      expect(REVISE_QUEUE_BENCHMARK_FILES).toContain(path)
      expect(corpus.proof.benchmarkFilesLoaded).toContain(path)
      expect(corpus.files[path as (typeof REVISE_QUEUE_WARMUP_FILES)[number]]).toBeTruthy()
    }
  })
})
