import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { withRetry } from '@/lib/evaluation/pipeline/openaiRetry';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ── Types ────────────────────────────────────────────────────────────────────

type SectionType =
  | 'query_letter'
  | 'what_makes_unique'
  | 'synopsis'
  | 'query_pitch'
  | 'comparables'
  | 'author_bio';

type GenerateMode = 'generate' | 'regenerate' | 'improve';

interface GenerateRequest {
  manuscriptId: number;
  evaluationJobId: string;
  section: SectionType;
  mode: GenerateMode;
  existingContent?: string;
  authorBioInput?: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MODEL = process.env.AGENT_READINESS_MODEL ?? 'gpt-4o';
const MAX_TOKENS = 2000;
const TIMEOUT_MS = 45_000;

const WORD_LIMITS: Record<SectionType, number> = {
  query_letter: 450,
  what_makes_unique: 150,
  synopsis: 500,
  query_pitch: 50,
  comparables: 200,
  author_bio: 150,
};

// ── Quality Gate: reject editorial meta-language ─────────────────────────────

const EDITORIAL_META_PATTERNS = [
  /\bthe reader would benefit from\b/i,
  /\bit would be beneficial to\b/i,
  /\ba revision here could\b/i,
  /\bone might improve\b/i,
  /\ban opportunity exists to\b/i,
  /\bwould be more effective with\b/i,
  /\bthis section could be strengthened\b/i,
  /\bconsider adding\b/i,
  /\bthe author should\b/i,
  /\bthe manuscript would\b/i,
  /\bshould be expanded\b/i,
  /\bneeds further development\b/i,
];

const PLACEHOLDER_PATTERNS = [
  /\[Agent Name\]/i,
  /\[Author Name\]/i,
  /\[Title\]/i,
  /\[Genre\]/i,
  /\[Word Count\]/i,
  /\[Comp \d\]/i,
  /\[INSERT\b/i,
  /\[TODO\b/i,
  /\[PLACEHOLDER\b/i,
];

const WORD_MINIMUMS: Partial<Record<SectionType, number>> = {
  query_letter: 200,
  synopsis: 150,
  author_bio: 50,
  what_makes_unique: 60,
};

function qualityGate(text: string, section: SectionType): { pass: boolean; reason?: string } {
  if (!text || text.trim().length < 20) {
    return { pass: false, reason: 'Output too short — generation failed' };
  }

  for (const pat of EDITORIAL_META_PATTERNS) {
    if (pat.test(text)) {
      return { pass: false, reason: `Contains editorial meta-language: "${text.match(pat)?.[0]}"` };
    }
  }

  for (const pat of PLACEHOLDER_PATTERNS) {
    if (pat.test(text)) {
      return { pass: false, reason: `Contains unresolved placeholder: "${text.match(pat)?.[0]}"` };
    }
  }

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const limit = WORD_LIMITS[section];
  if (wordCount > limit * 1.1) {
    return { pass: false, reason: `Exceeds word limit: ${wordCount}/${limit} words` };
  }

  // Minimum word count — reject thin output that won't serve agents
  const minWords = WORD_MINIMUMS[section];
  if (minWords && wordCount < minWords) {
    return { pass: false, reason: `Output too thin (${wordCount} words) — minimum ${minWords} words required for agent-ready ${section}` };
  }

  return { pass: true };
}

// ── System prompts per section ───────────────────────────────────────────────

function getSystemPrompt(section: SectionType): string {
  const baseRules = `You are a professional literary agent submission consultant. You produce polished, agent-ready materials that authors can submit directly to literary agents without editing.

ABSOLUTE RULES:
- Write in the author's voice, NOT as an advisor
- NEVER include editorial commentary, suggestions, or meta-language about the manuscript
- NEVER use phrases like "the reader would benefit from", "consider adding", "this could be strengthened"
- NEVER include placeholder brackets like [Agent Name] or [Title] — use the actual manuscript details provided
- Output ONLY the finished, submission-ready text — no preambles, explanations, or notes
- Write as if the author themselves crafted this for a real agent submission`;

  switch (section) {
    case 'query_letter':
      return `${baseRules}

QUERY LETTER REQUIREMENTS:
- Open with a compelling hook paragraph (the story pitch)
- Follow with a brief synopsis: protagonist, central conflict, stakes, major turn, consequence
- Include metadata line: title, genre, word count, audience
- Include comparables sentence naturally
- Include "what makes this unique" paragraph
- Close with brief professional bio and "Thank you for your time and consideration"
- HARD CAP: 450 words maximum
- Tone: confident, professional, not desperate or self-deprecating`;

    case 'what_makes_unique':
      return `${baseRules}

UNIQUE DIFFERENTIATOR REQUIREMENTS:
- One focused paragraph (100-150 words)
- Identify the specific hook, premise, voice, or structural element that separates this manuscript from everything else in its genre
- Be concrete and specific — not generic praise
- Position the manuscript in the market without being salesy
- This must work both standalone AND inside the query letter`;

    case 'synopsis':
      return `${baseRules}

SYNOPSIS REQUIREMENTS:
- 250-500 words (standard length)
- MUST reveal the ending — agents expect this
- Cover: protagonist, inciting incident, rising action, climax, resolution
- Write in present tense, third person
- Focus on emotional arc and character decisions, not every plot point
- No chapter-by-chapter breakdown
- Maintain the manuscript's tone and voice`;

    case 'query_pitch':
      return `${baseRules}

QUERY PITCH REQUIREMENTS:
- One sentence only (25-50 words maximum)
- Captures the manuscript's core hook and positioning
- Format: "[TITLE] is a [genre] about [protagonist] who must [conflict/stakes]"
- Must be compelling enough to make an agent want to read more
- Think of it as the elevator pitch version`;

    case 'comparables':
      return `${baseRules}

COMPARABLES REQUIREMENTS:
- 2-4 comparable titles with brief rationale for each
- Format: "[Title] by [Author] — [one sentence explaining the connection]"
- Comps should be published within the last 5 years when possible
- Mix of commercial success and craft similarity
- Be specific about WHAT connects them (voice, structure, theme, audience)
- Never use mega-bestsellers as sole comps (agents see this as naive)
- Include at least one comp that shows market positioning`;

    case 'author_bio':
      return `${baseRules}

AUTHOR BIO REQUIREMENTS:
- Third person, professional tone — punchy and authoritative, not passive or generic
- 75-150 words (aim for 100-120 for maximum impact)
- ONLY include facts from the author-supplied materials — NEVER invent credentials
- STRUCTURE (follow this order):
  1. LEAD with professional identity + "turned novelist/author" (use active phrasing, e.g. "former X turned novelist" — never "transitioned into a career as")
  2. IMMEDIATELY connect the author to THIS manuscript — why they are uniquely positioned to write it (lived experience in the setting, professional expertise relevant to the theme, etc.)
  3. BRIEFLY mention 1-2 other completed works to signal range (titles only, no plot summaries)
  4. ONE standout credential that signals authority or memorability (e.g. pitched on Dragons' Den, Stanford certification, military rank, UN peacekeeping, 3,300 flying hours)
  5. CLOSE with current location
- VOICE: Use "turned" not "transitioned into." Use active constructions. Every sentence must earn its place.
- PRIORITIZE facts that explain WHY this author writes THIS book over generic résumé padding
- If author has no publishing credits, focus on life experience relevant to the manuscript — this IS the "why you" factor agents look for
- Do NOT include: age, marital status, pet names, generic adjectives, or any fact that doesn't serve the agent's question "why should I trust this person to write this book?"
- Do NOT enumerate degrees or jobs as a list — weave the most relevant ones into a narrative`;

    default:
      return baseRules;
  }
}

// ── Fetch manuscript & evaluation data from Supabase ─────────────────────────

async function fetchManuscriptContext(manuscriptId: number, evaluationJobId: string) {
  const admin = createAdminClient();

  // Fetch manuscript metadata
  const { data: manuscript } = await admin
    .from('manuscripts')
    .select('id, title, word_count, created_at')
    .eq('id', manuscriptId)
    .single();

  // Fetch evaluation artifact (the full evaluation result)
  const { data: artifact } = await admin
    .from('evaluation_artifacts')
    .select('content, artifact_type')
    .eq('job_id', evaluationJobId)
    .in('artifact_type', ['evaluation_result_v2', 'evaluation_result_v1'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch evaluation job metadata for mode, policy
  const { data: job } = await admin
    .from('evaluation_jobs')
    .select('id, status, evaluation_mode, progress')
    .eq('id', evaluationJobId)
    .single();

  // Fetch first few manuscript chunks for prose context
  const { data: chunks } = await admin
    .from('manuscript_chunks')
    .select('content, chunk_index')
    .eq('manuscript_id', manuscriptId)
    .order('chunk_index', { ascending: true })
    .limit(5);

  // Fetch story ledger if available
  const { data: ledger } = await admin
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', evaluationJobId)
    .eq('artifact_type', 'story_ledger_v1')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    manuscript,
    artifact: artifact?.content,
    job,
    chunks: chunks?.map(c => c.content).filter(Boolean) ?? [],
    storyLedger: ledger?.content,
  };
}

function buildContextSummary(ctx: Awaited<ReturnType<typeof fetchManuscriptContext>>): string {
  const parts: string[] = [];

  if (ctx.manuscript) {
    parts.push(`MANUSCRIPT: "${ctx.manuscript.title}"`);
    if (ctx.manuscript.word_count) parts.push(`Word Count: ${ctx.manuscript.word_count.toLocaleString()}`);
  }

  // Extract genre from evaluation artifact if available
  if (ctx.artifact && typeof ctx.artifact === 'object') {
    const result = ctx.artifact as Record<string, unknown>;
    if (result.overview && typeof result.overview === 'object') {
      const overview = result.overview as Record<string, unknown>;
      if (overview.genre) parts.push(`Genre: ${overview.genre}`);
    }
  }

  // Extract key findings from evaluation result
  if (ctx.artifact && typeof ctx.artifact === 'object') {
    const result = ctx.artifact as Record<string, unknown>;
    
    // Overview/summary
    if (result.overview && typeof result.overview === 'object') {
      const overview = result.overview as Record<string, unknown>;
      if (overview.one_paragraph_summary) parts.push(`\nEVALUATION SUMMARY:\n${overview.one_paragraph_summary}`);
      if (Array.isArray(overview.top_3_strengths)) {
        parts.push(`\nTOP STRENGTHS:\n${overview.top_3_strengths.map((s, i) => `${i + 1}. ${s}`).join('\n')}`);
      }
    }

    // Criteria scores and insights
    if (Array.isArray(result.criteria)) {
      const topCriteria = (result.criteria as Array<Record<string, unknown>>)
        .filter(c => typeof c.score_0_10 === 'number' && (c.score_0_10 as number) >= 7)
        .slice(0, 5)
        .map(c => `- ${c.key}: ${c.score_0_10}/10`);
      if (topCriteria.length > 0) {
        parts.push(`\nSTRONGEST AREAS:\n${topCriteria.join('\n')}`);
      }
    }

    // Genre/audience/market signals
    if (result.metadata && typeof result.metadata === 'object') {
      const meta = result.metadata as Record<string, unknown>;
      if (meta.genre_diagnosis) parts.push(`\nGENRE DIAGNOSIS: ${meta.genre_diagnosis}`);
      if (meta.target_audience) parts.push(`TARGET AUDIENCE: ${meta.target_audience}`);
      if (meta.market_readiness_verdict) parts.push(`MARKET READINESS: ${meta.market_readiness_verdict}`);
    }
  }

  // Story ledger facts
  if (ctx.storyLedger && typeof ctx.storyLedger === 'object') {
    const ledger = ctx.storyLedger as Record<string, unknown>;
    if (ledger.protagonist) parts.push(`\nPROTAGONIST: ${JSON.stringify(ledger.protagonist)}`);
    if (ledger.setting) parts.push(`SETTING: ${JSON.stringify(ledger.setting)}`);
    if (ledger.central_conflict) parts.push(`CENTRAL CONFLICT: ${JSON.stringify(ledger.central_conflict)}`);
    if (ledger.themes) parts.push(`THEMES: ${JSON.stringify(ledger.themes)}`);
    if (ledger.ending) parts.push(`ENDING: ${JSON.stringify(ledger.ending)}`);
  }

  // Include manuscript opening for voice/tone reference
  if (ctx.chunks.length > 0) {
    const openingText = ctx.chunks.slice(0, 2).join('\n\n').substring(0, 2000);
    parts.push(`\nMANUSCRIPT OPENING (for voice/tone reference):\n${openingText}`);
  }

  return parts.join('\n');
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth check
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request
  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { manuscriptId, evaluationJobId, section, mode, existingContent, authorBioInput } = body;

  if (!manuscriptId || !evaluationJobId || !section) {
    return NextResponse.json({ error: 'Missing required fields: manuscriptId, evaluationJobId, section' }, { status: 400 });
  }

  const validSections: SectionType[] = ['query_letter', 'what_makes_unique', 'synopsis', 'query_pitch', 'comparables', 'author_bio'];
  if (!validSections.includes(section)) {
    return NextResponse.json({ error: `Invalid section: ${section}` }, { status: 400 });
  }

  // Check for OpenAI API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
  }

  // Fetch context
  const ctx = await fetchManuscriptContext(manuscriptId, evaluationJobId);
  if (!ctx.manuscript) {
    return NextResponse.json({ error: 'Manuscript not found' }, { status: 404 });
  }

  // Build the prompt
  const contextSummary = buildContextSummary(ctx);
  const systemPrompt = getSystemPrompt(section);

  let userMessage = `Using the manuscript data below, generate a professional, agent-submission-ready ${sectionLabel(section)} for "${ctx.manuscript.title}".

${contextSummary}`;

  // Mode-specific adjustments
  if (mode === 'improve' && existingContent) {
    userMessage = `The author has written a draft ${sectionLabel(section)}. Improve it to be more polished and agent-ready while preserving their voice and intent. Do NOT add editorial commentary — just output the improved version.

CURRENT DRAFT:
${existingContent}

MANUSCRIPT CONTEXT:
${contextSummary}`;
  } else if (mode === 'regenerate') {
    userMessage += '\n\nGenerate a fresh version — different approach, structure, or angle from any previous attempt.';
  }

  // Special handling for author bio
  if (section === 'author_bio') {
    const trimmedBio = authorBioInput?.trim() ?? '';
    
    if (trimmedBio.length < 50) {
      return NextResponse.json({
        error: trimmedBio.length === 0
          ? 'Author Bio requires author-supplied materials (resume, CV, bio notes). No credentials can be invented.'
          : `Author Bio input too brief (${trimmedBio.length} characters). Please provide at least 50 characters of background information — a sentence or two about your professional background, education, or life experience relevant to your writing.`,
        section: 'author_bio',
        needsInput: true,
      }, { status: 422 });
    }

    // Cap input at 5000 chars to prevent context overflow while preserving most CVs
    const BIO_INPUT_MAX = 5000;
    const cappedBio = trimmedBio.length > BIO_INPUT_MAX
      ? trimmedBio.substring(0, BIO_INPUT_MAX) + '\n\n[Input truncated — only first 5,000 characters used]'
      : trimmedBio;

    userMessage += `\n\nAUTHOR-SUPPLIED BIO MATERIALS:\n${cappedBio}`;
    userMessage += `\n\nIMPORTANT: The manuscript being queried is "${ctx.manuscript.title}". The bio MUST connect the author's background to why they are uniquely positioned to write this specific book. Lead with their professional identity, then immediately tie their lived experience or expertise to this manuscript's subject matter.`;
  }

  // Call OpenAI
  const openai = new OpenAI({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });

  let generated: string;
  try {
    const completion = await withRetry(
      () => openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: MAX_TOKENS,
      }),
      { maxAttempts: 2, label: `agent_readiness_${section}` },
    );

    generated = completion.choices[0]?.message?.content?.trim() ?? '';
  } catch (err) {
    console.error(`[AgentReadiness] OpenAI call failed for section=${section}:`, err);
    return NextResponse.json({
      error: 'Generation failed — please try again',
      details: err instanceof Error ? err.message : String(err),
    }, { status: 502 });
  }

  // Quality gate
  const gate = qualityGate(generated, section);
  if (!gate.pass) {
    // Try once more with stricter temperature
    try {
      const retryCompletion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt + '\n\nCRITICAL: Your previous output was rejected. ' + gate.reason + '. Fix this issue.' },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: MAX_TOKENS,
      });
      const retryText = retryCompletion.choices[0]?.message?.content?.trim() ?? '';
      const retryGate = qualityGate(retryText, section);
      if (retryGate.pass) {
        generated = retryText;
      } else {
        return NextResponse.json({
          error: `Quality gate failed: ${retryGate.reason}`,
          generated: retryText,
          gateFailure: true,
        }, { status: 422 });
      }
    } catch {
      return NextResponse.json({
        error: `Quality gate failed: ${gate.reason}`,
        generated,
        gateFailure: true,
      }, { status: 422 });
    }
  }

  // Persist to Supabase
  const admin = createAdminClient();
  const { error: saveError } = await admin
    .from('agent_readiness_sections')
    .upsert({
      user_id: user.id,
      manuscript_id: manuscriptId,
      evaluation_job_id: evaluationJobId,
      section_type: section,
      content: generated,
      status: 'draft',
      generated_at: new Date().toISOString(),
      model_used: MODEL,
      mode,
    }, {
      onConflict: 'user_id,manuscript_id,section_type',
    });

  if (saveError) {
    // Non-fatal — still return the generated content
    console.warn(`[AgentReadiness] Failed to persist section=${section}:`, saveError.message);
  }

  return NextResponse.json({
    content: generated,
    section,
    wordCount: generated.trim().split(/\s+/).filter(Boolean).length,
    wordLimit: WORD_LIMITS[section],
    model: MODEL,
    mode,
    persisted: !saveError,
  });
}

function sectionLabel(section: SectionType): string {
  switch (section) {
    case 'query_letter': return 'Query Letter';
    case 'what_makes_unique': return 'What Makes This Novel Unique statement';
    case 'synopsis': return 'Synopsis';
    case 'query_pitch': return 'Query Pitch (one sentence)';
    case 'comparables': return 'Comparables section';
    case 'author_bio': return 'Author Bio';
  }
}
