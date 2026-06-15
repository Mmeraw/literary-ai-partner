import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { withRetry } from '@/lib/evaluation/pipeline/openaiRetry';
import {
  hasRepeatedSentenceOpenings,
  sanitizeAuthorFacingProse,
  startsWithRepetitiveLeadIn,
} from '@/lib/text/authorFacingProse';

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
type SynopsisLength = 'query' | 'standard' | 'extended';

interface GenerateRequest {
  manuscriptId: number;
  evaluationJobId: string;
  section: SectionType;
  mode: GenerateMode;
  existingContent?: string;
  authorBioInput?: string;
  synopsisLength?: SynopsisLength;
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

const SYNOPSIS_LENGTH_LIMITS: Record<SynopsisLength, { min: number; max: number; label: string; instruction: string }> = {
  query: {
    min: 100,
    max: 150,
    label: 'Query Synopsis',
    instruction: '100-150 words. Use a compact query-form synopsis that still reveals the ending.',
  },
  standard: {
    min: 250,
    max: 500,
    label: 'Standard Synopsis',
    instruction: '250-500 words. Use the standard agency-submission synopsis length.',
  },
  extended: {
    min: 700,
    max: 1000,
    label: 'Extended Synopsis',
    instruction: '700-1,000 words. Use a fuller submission synopsis with the complete main arc and resolution.',
  },
};

function normalizeSynopsisLength(value: unknown): SynopsisLength {
  return value === 'query' || value === 'standard' || value === 'extended' ? value : 'standard';
}

function wordLimitFor(section: SectionType, synopsisLength: SynopsisLength): number {
  return section === 'synopsis' ? SYNOPSIS_LENGTH_LIMITS[synopsisLength].max : WORD_LIMITS[section];
}

function wordMinimumFor(section: SectionType, synopsisLength: SynopsisLength): number | undefined {
  if (section === 'synopsis') return SYNOPSIS_LENGTH_LIMITS[synopsisLength].min;
  return WORD_MINIMUMS[section];
}

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

function qualityGate(text: string, section: SectionType, synopsisLength: SynopsisLength = 'standard'): { pass: boolean; reason?: string } {
  if (!text || text.trim().length < 20) {
    return { pass: false, reason: 'Output too short — generation failed' };
  }

  if (startsWithRepetitiveLeadIn(text)) {
    return { pass: false, reason: 'Contains repetitive lead-in boilerplate at section start' };
  }

  if (hasRepeatedSentenceOpenings(text, 4, 1)) {
    return { pass: false, reason: 'Contains repeated sentence openings that indicate duplicated boilerplate' };
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
  const limit = wordLimitFor(section, synopsisLength);
  if (wordCount > limit * 1.1) {
    return { pass: false, reason: `Exceeds word limit: ${wordCount}/${limit} words` };
  }

  // Minimum word count — reject thin output that won't serve agents
  const minWords = wordMinimumFor(section, synopsisLength);
  if (minWords && wordCount < minWords) {
    return { pass: false, reason: `Output too thin (${wordCount} words) — minimum ${minWords} words required for agent-ready ${section}` };
  }

  return { pass: true };
}

// ── System prompts per section ───────────────────────────────────────────────

function getSystemPrompt(section: SectionType, synopsisLength: SynopsisLength = 'standard'): string {
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
- HARD CAP: 450 words maximum (350-400 is ideal)
- STRUCTURE (follow this exact order):
  1. HOOK (1 paragraph, 2-4 sentences): Drop the reader into the story's world. Name the protagonist, their situation, and what disrupts it. No rhetorical questions. No "What if..." openings. Start with story, not setup.
  2. STAKES (1 paragraph): The central conflict — what the protagonist must do, what stands against them, and what they'll lose if they fail. Reveal at least one major turn. This is NOT a teaser — agents want to see narrative architecture.
  3. METADATA (1 line): "[TITLE] is a [genre] complete at [word count] words, with series potential" (or standalone). Include target audience if relevant.
  4. COMPARABLES (1 sentence): "It will appeal to readers of [Comp 1] and [Comp 2]" — woven naturally, not as a bullet list.
  5. BIO (optional): Include author bio facts ONLY if approved author-supplied bio material is present in the context. If no approved author bio facts are provided, omit bio claims entirely. NEVER invent credentials, awards, education, locations, publications, or lived experience.
  6. CLOSE: "Thank you for your time and consideration. I look forward to the opportunity to share the full manuscript."
- VOICE: Confident, precise, literary. Match the manuscript's tone — if the novel is dark, the query is dark. If lyrical, the query is lyrical. Never sound desperate, self-deprecating, or salesy.
- Every sentence must advance the agent's understanding of the story or the author's credibility. Cut anything generic.
- Do NOT summarize themes in abstract language ("explores the nature of..."). Show, don't tell — even in a query.`;

    case 'what_makes_unique':
      return `${baseRules}

UNIQUE DIFFERENTIATOR REQUIREMENTS:
- One focused paragraph: 100-150 words (aim for 120)
- Answer ONE question: "What does THIS manuscript offer that nothing else on the market does right now?"
- STRUCTURE: Lead with the differentiator itself (not "What makes this novel unique is..."). State it as fact, then support with 2-3 specific details from the manuscript.
- Categories of differentiation (pick the strongest ONE, not all):
  • Structural innovation (non-linear timeline, dual POV, epistolary, unreliable narrator architecture)
  • Voice/Tone (a specific fusion nobody else is doing — e.g. "literary prose with thriller pacing")
  • Subject/Setting access (insider knowledge, lived experience, underrepresented world)
  • Thematic intersection (two themes rarely combined — e.g. "addiction through the lens of bureaucratic harm reduction")
- NEVER use: "This novel is unique because..." or "Unlike anything else..." or "A fresh take on..."
- Write as if pitching to a jaded agent who has read 200 queries today — be specific enough that they can't confuse this book with another.
- This must work both standalone AND embedded inside the query letter.`;

    case 'synopsis': {
      const synopsisConfig = SYNOPSIS_LENGTH_LIMITS[synopsisLength];
      return `${baseRules}

SYNOPSIS REQUIREMENTS:
  - LENGTH: ${synopsisConfig.instruction}
- MUST REVEAL THE ENDING — agents REQUIRE this. A synopsis that withholds the resolution is an automatic rejection.
- Write in present tense, third person, active voice throughout.
- STRUCTURE (follow this arc):
  1. SETUP (2-3 sentences): Protagonist, their world, their flaw or desire.
  2. INCITING INCIDENT: The event that forces them out of stasis.
  3. RISING ACTION: 3-4 key turning points (not every plot beat — only decisions that change the trajectory).
  4. CLIMAX: The protagonist's defining choice under maximum pressure.
  5. RESOLUTION: What happens as a result. How the world and character are changed.
- FOCUS on the protagonist's emotional arc and key DECISIONS. Agents want to see character agency, not a sequence of things happening TO someone.
- NAME only essential characters (protagonist + 2-3 others maximum). Unnamed characters = "his sister" or "a stranger."
- NO chapter-by-chapter breakdown. No "In chapter 3..." framing.
- NO teaser language ("What happens next will change everything"). This is not a blurb — it's a professional narrative summary.
- MAINTAIN the manuscript's tone — if the novel is literary and quiet, the synopsis is literary and quiet. If it's tense and propulsive, so is the synopsis.
- Every sentence must move the story forward. Cut transitions, setting descriptions, and subplot details unless they directly affect the main arc.`;
  }

    case 'query_pitch':
      return `${baseRules}

QUERY PITCH REQUIREMENTS:
- ONE sentence. 25-50 words maximum. No exceptions.
- This is the "elevator pitch" — the single sentence an agent uses to pitch YOUR book at an editorial meeting.
- STRUCTURE: [TITLE] is a [genre] [comp positioning] in which [protagonist with one defining trait] must [specific action with stakes] before/or else [concrete consequence].
- EXAMPLES of strong pitches (for calibration only — do NOT copy these):
  • "THE HOUSE IN THE CERULEAN SEA is a cozy fantasy in the vein of Howl's Moving Castle in which a government caseworker must decide whether to condemn six magical children or defy the bureaucracy that raised him."
  • "GONE GIRL is a literary thriller about a husband whose wife's disappearance exposes the toxic architecture of their marriage."
- NEVER use: vague stakes ("must confront their past"), abstract language ("navigates a world of..."), or multiple clauses connected by "and."
- The pitch must contain: the protagonist's identity, the specific conflict, and what's at stake — all in one sentence.
- If the word count exceeds 50, CUT. Tighter is always better.`;

    case 'comparables':
      return `${baseRules}

COMPARABLES REQUIREMENTS:
- 2-4 comparable titles. No more, no fewer than 2.
- FORMAT for each: "[TITLE] by [Author] ([Year]) — [one precise sentence explaining the specific connection]"
- RULES for selecting comps:
  • Published within the last 5 years (ideally 2-3 years). Agents use comps to assess market viability — old titles signal you don't know the current market.
  • NEVER use mega-bestsellers alone (Gone Girl, The Hunger Games, Harry Potter). Agents interpret this as "I don't read in my genre." You may reference one as a "meets" pairing (e.g., "X meets Gone Girl") only if paired with a mid-list title.
  • Mix: one comp for VOICE/CRAFT similarity, one for MARKET/AUDIENCE positioning. If 3-4 comps, include at least one that shows thematic intersection.
  • Be SPECIFIC about the connection: not "similar themes" but "the same claustrophobic single-setting tension" or "lyrical prose style with short chapters."
  • Comps must be in the same genre or adjacent. Do not comp literary fiction to a thriller unless the manuscript genuinely crosses genres.
- STRUCTURE: Present as a brief paragraph with natural transitions, OR as a formatted list. Agent preference varies — a paragraph reads more professionally.
- After the comp list, include ONE sentence positioning the manuscript: "[TITLE] sits at the intersection of [Genre A] and [Genre B], for readers who want [specific reading experience]."
- Draw from real published titles. Be accurate about authors and publication years.`;

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

async function fetchManuscriptContext(manuscriptId: number, evaluationJobId: string, userId: string) {
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

  const { data: agentSections } = await admin
    .from('agent_readiness_sections')
    .select('section_type, content, status')
    .eq('user_id', userId)
    .eq('manuscript_id', manuscriptId)
    .eq('evaluation_job_id', evaluationJobId);

  return {
    manuscript,
    artifact: artifact?.content,
    job,
    chunks: chunks?.map(c => c.content).filter(Boolean) ?? [],
    storyLedger: ledger?.content,
    agentSections: (agentSections ?? []) as Array<{ section_type: SectionType; content: string | null; status: string | null }>,
  };
}

function getPersistedAgentSection(
  ctx: Awaited<ReturnType<typeof fetchManuscriptContext>>,
  sectionType: SectionType,
  requiredStatus?: 'approved' | 'draft',
): string | null {
  const section = ctx.agentSections.find((candidate) => {
    if (candidate.section_type !== sectionType) return false;
    if (requiredStatus && candidate.status !== requiredStatus) return false;
    return typeof candidate.content === 'string' && candidate.content.trim().length > 0;
  });

  return section?.content?.trim() ?? null;
}

function buildQueryLetterSupportContext(ctx: Awaited<ReturnType<typeof fetchManuscriptContext>>): string {
  const parts: string[] = [];
  const synopsis = getPersistedAgentSection(ctx, 'synopsis');
  const unique = getPersistedAgentSection(ctx, 'what_makes_unique');
  const comparables = getPersistedAgentSection(ctx, 'comparables');
  const approvedBio = getPersistedAgentSection(ctx, 'author_bio', 'approved');

  if (synopsis) parts.push(`PERSISTED SYNOPSIS DRAFT (story facts only):\n${synopsis}`);
  if (unique) parts.push(`PERSISTED UNIQUE DIFFERENTIATOR DRAFT:\n${unique}`);
  if (comparables) parts.push(`PERSISTED COMPARABLES DRAFT:\n${comparables}`);

  if (approvedBio) {
    parts.push(`APPROVED AUTHOR BIO FACTS (author-supplied; may be used in the query letter):\n${approvedBio}`);
  } else {
    parts.push('AUTHOR BIO POLICY: No approved author-supplied bio is available. Omit author credentials and bio claims from the query letter. Do not invent them.');
  }

  return parts.join('\n\n');
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
  const synopsisLength = normalizeSynopsisLength(body.synopsisLength);

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
  const ctx = await fetchManuscriptContext(manuscriptId, evaluationJobId, user.id);
  if (!ctx.manuscript) {
    return NextResponse.json({ error: 'Manuscript not found' }, { status: 404 });
  }

  // Build the prompt
  const contextSummary = buildContextSummary(ctx);
  const systemPrompt = getSystemPrompt(section, synopsisLength);

  let userMessage = `Using the manuscript data below, generate a professional, agent-submission-ready ${sectionLabel(section)} for "${ctx.manuscript.title}".

${contextSummary}`;

  if (section === 'synopsis') {
    const synopsisConfig = SYNOPSIS_LENGTH_LIMITS[synopsisLength];
    userMessage += `\n\nSYNOPSIS LENGTH SELECTED: ${synopsisConfig.label}. ${synopsisConfig.instruction}`;
  }

  if (section === 'query_letter') {
    userMessage += `\n\nQUERY LETTER SUPPORTING PACKAGE CONTEXT:\n${buildQueryLetterSupportContext(ctx)}`;
  }

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

    generated = sanitizeAuthorFacingProse(completion.choices[0]?.message?.content?.trim() ?? '');
  } catch (err) {
    console.error(`[AgentReadiness] OpenAI call failed for section=${section}:`, err);
    return NextResponse.json({
      error: 'Generation failed — please try again',
      details: err instanceof Error ? err.message : String(err),
    }, { status: 502 });
  }

  // Quality gate
  const gate = qualityGate(generated, section, synopsisLength);
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
      const retryText = sanitizeAuthorFacingProse(retryCompletion.choices[0]?.message?.content?.trim() ?? '');
      const retryGate = qualityGate(retryText, section, synopsisLength);
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
    console.error(`[AgentReadiness] Failed to persist section=${section}:`, saveError.message);
    return NextResponse.json({
      error: 'Failed to persist generated section',
      section,
    }, { status: 500 });
  }

  return NextResponse.json({
    content: generated,
    section,
    wordCount: generated.trim().split(/\s+/).filter(Boolean).length,
    wordLimit: wordLimitFor(section, synopsisLength),
    ...(section === 'synopsis' ? { synopsisLength, wordMinimum: SYNOPSIS_LENGTH_LIMITS[synopsisLength].min } : {}),
    model: MODEL,
    mode,
    persisted: true,
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
