"use client";

import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";

export type SectionType =
  | 'query_letter'
  | 'what_makes_unique'
  | 'synopsis'
  | 'query_pitch'
  | 'comparables'
  | 'author_bio';

export type GenerateMode = 'generate' | 'regenerate' | 'improve';

interface GenerateResult {
  content: string;
  wordCount: number;
  wordLimit: number;
  model: string;
  mode: GenerateMode;
  persisted: boolean;
}

interface UseAgentReadinessGenerateReturn {
  generating: boolean;
  error: string | null;
  manuscriptId: string | null;
  evaluationJobId: string | null;
  generate: (section: SectionType, mode: GenerateMode, opts?: {
    existingContent?: string;
    authorBioInput?: string;
  }) => Promise<GenerateResult | null>;
  clearError: () => void;
}

export function useAgentReadinessGenerate(): UseAgentReadinessGenerateReturn {
  const searchParams = useSearchParams();
  const manuscriptId = searchParams.get('manuscriptId');
  const evaluationJobId = searchParams.get('evaluationJobId');

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (
    section: SectionType,
    mode: GenerateMode,
    opts?: { existingContent?: string; authorBioInput?: string },
  ): Promise<GenerateResult | null> => {
    if (!manuscriptId || !evaluationJobId) {
      setError('No manuscript selected. Go back and select a manuscript with a completed evaluation.');
      return null;
    }

    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/agent-readiness/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manuscriptId: Number(manuscriptId),
          evaluationJobId,
          section,
          mode,
          existingContent: opts?.existingContent,
          authorBioInput: opts?.authorBioInput,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || `Generation failed (${res.status})`);
        return null;
      }

      return data as GenerateResult;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error — check your connection';
      setError(msg);
      return null;
    } finally {
      setGenerating(false);
    }
  }, [manuscriptId, evaluationJobId]);

  const clearError = useCallback(() => setError(null), []);

  return {
    generating,
    error,
    manuscriptId,
    evaluationJobId,
    generate,
    clearError,
  };
}
