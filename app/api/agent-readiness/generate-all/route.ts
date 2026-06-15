/**
 * POST /api/agent-readiness/generate-all
 *
 * One-click generation of all Agent Readiness sections.
 * Generates 5 core sections sequentially (query_letter, what_makes_unique,
 * synopsis, query_pitch, comparables). Author Bio is included only if
 * authorBioInput is provided.
 *
 * Returns a JSON object with each section's generated content.
 */

import { NextResponse } from 'next/server';

const SECTIONS_ORDER = [
  'query_pitch',
  'what_makes_unique',
  'synopsis',
  'comparables',
  'query_letter', // last because it benefits from having other sections as context
] as const;

type SynopsisLength = 'query' | 'standard' | 'extended';

function normalizeSynopsisLength(value: unknown): SynopsisLength {
  return value === 'query' || value === 'standard' || value === 'extended' ? value : 'standard';
}

export async function POST(request: Request) {
  const body = await request.json();
  const { manuscriptId, evaluationJobId, authorBioInput } = body;
  const synopsisLength = normalizeSynopsisLength(body.synopsisLength);
  const trimmedAuthorBioInput = typeof authorBioInput === 'string' ? authorBioInput.trim() : '';

  if (!manuscriptId || !evaluationJobId) {
    return NextResponse.json(
      { error: 'manuscriptId and evaluationJobId are required' },
      { status: 400 }
    );
  }

  // Get the origin from the request for internal calls
  const url = new URL(request.url);
  const origin = url.origin;

  // Forward cookies for authentication
  const cookieHeader = request.headers.get('cookie') ?? '';

  const results: Record<string, { content: string; wordCount: number; error?: string }> = {};
  const errors: string[] = [];

  // Generate all non-bio sections sequentially
  for (const section of SECTIONS_ORDER) {
    try {
      const res = await fetch(`${origin}/api/agent-readiness/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookieHeader,
        },
        body: JSON.stringify({
          manuscriptId,
          evaluationJobId,
          section,
          mode: 'generate',
          ...(section === 'synopsis' ? { synopsisLength } : {}),
        }),
      });

      const data = await res.json();

      if (res.ok && data.content) {
        results[section] = {
          content: data.content,
          wordCount: data.wordCount ?? data.content.split(/\s+/).length,
        };
      } else {
        results[section] = {
          content: '',
          wordCount: 0,
          error: data.error || `Failed (${res.status})`,
        };
        errors.push(`${section}: ${data.error || res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      results[section] = { content: '', wordCount: 0, error: msg };
      errors.push(`${section}: ${msg}`);
    }
  }

  // Generate bio if author input is provided
  if (trimmedAuthorBioInput && trimmedAuthorBioInput.length < 50) {
    results['author_bio'] = {
      content: '',
      wordCount: 0,
      error: 'Author Bio input too brief. Please provide at least 50 characters of author-supplied background material.',
    };
    errors.push('author_bio: Author Bio input too brief');
  } else if (trimmedAuthorBioInput.length >= 50) {
    try {
      const res = await fetch(`${origin}/api/agent-readiness/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookieHeader,
        },
        body: JSON.stringify({
          manuscriptId,
          evaluationJobId,
          section: 'author_bio',
          mode: 'generate',
          authorBioInput: trimmedAuthorBioInput,
        }),
      });

      const data = await res.json();

      if (res.ok && data.content) {
        results['author_bio'] = {
          content: data.content,
          wordCount: data.wordCount ?? data.content.split(/\s+/).length,
        };
      } else {
        results['author_bio'] = {
          content: '',
          wordCount: 0,
          error: data.error || `Failed (${res.status})`,
        };
        errors.push(`author_bio: ${data.error || res.status}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      results['author_bio'] = { content: '', wordCount: 0, error: msg };
      errors.push(`author_bio: ${msg}`);
    }
  }

  const sectionsGenerated = Object.values(results).filter(r => r.content).length;
  const totalSections = trimmedAuthorBioInput ? 6 : 5;

  return NextResponse.json({
    results,
    summary: {
      generated: sectionsGenerated,
      total: totalSections,
      errors: errors.length > 0 ? errors : undefined,
    },
  });
}
