import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { canonicalJsonSha256 } from '@/lib/evaluation/canonicalJsonHash';
import { withRetry } from '@/lib/evaluation/pipeline/openaiRetry';
import {
  hasRepeatedSentenceOpenings,
  sanitizeAuthorFacingProse,
  startsWithRepetitiveLeadIn,
} from '@/lib/text/authorFacingProse';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type SectionType =
  | 'query_letter'
  | 'what_makes_unique'
  | 'synopsis'
  | 'query_pitch'
  | 'comparables'
  | 'author_bio';

type GenerateMode = 'generate' | 'regenerate' | 'improve';
type SynopsisLength = 'query' | 'standard' | 'extended';
type SynopsisVariant = 'short' | 'medium' | 'long';

interface GenerateRequest {
  manuscriptId: number;
  evaluationJobId: string;
  section: SectionType;
  mode: GenerateMode;
  existingContent?: string;
  authorBioInput?: string;
  synopsisLength?: SynopsisLength;
  synopsisVariant?: SynopsisVariant;
}

type CanonicalOpportunityContext = {
  id: string;
  primaryCriterion: string;
  severity: string;
  action: string;
  evidence: string;
  location: string;
  readerEffect: string;
};

type CertifiedCanonicalOpportunityContext = {
  opportunities: CanonicalOpportunityContext[];
  sourcePolicy: 'certified_ued_canonical_opportunity_ledger';
  failureReason: string | null;
};

const MODEL = process.env.AGENT_READINESS_MODEL ?? 'gpt-4o';
const MAX_TOKENS = 2400;
const TIMEOUT_MS = 45_000;

const VALID_SECTIONS: SectionType[] = [
  'query_letter',
  'what_makes_unique',
  'synopsis',
  'query_pitch',
  'comparables',
  'author_bio',
];

const SYNOPSIS_LIMITS: Record<SynopsisVariant, { min: number; max: number; ideal: string; label: string }> = {
  short: { min: 100, max: 150, ideal: '100-150 words', label: 'short query synopsis' },
  medium: { min: 250, max: 500, ideal: '350-450 words', label: 'standard synopsis' },
  long: { min: 700, max: 1000, ideal: '700-1,000 words', label: 'extended synopsis' },
};

const WORD_LIMITS: Record<SectionType, number> = {
  query_letter: 450,
  what_makes_unique: 150,
  synopsis: 500,
  query_pitch: 75,
  comparables: 200,
  author_bio: 200,
};

const WORD_MINIMUMS: Partial<Record<SectionType, number>> = {
  query_letter: 200,
  synopsis: 150,
  author_bio: 50,
  what_makes_unique: 60,
};

function synopsisVariantFromRequest(length: unknown, variant: unknown): SynopsisVariant {
  if (variant === 'short' || variant === 'medium' || variant === 'long') return variant;
  if (length === 'query') return 'short';
  if (length === 'extended') return 'long';
  return 'medium';
}

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

function wordBounds(section: SectionType, synopsisVariant: SynopsisVariant): { min?: number; max: number } {
  if (section === 'synopsis') return SYNOPSIS_LIMITS[synopsisVariant];
  return { min: WORD_MINIMUMS[section], max: WORD_LIMITS[section] };
}

function qualityGate(text: string, section: SectionType, synopsisVariant: SynopsisVariant): { pass: boolean; reason?: string } {
  if (!text || text.trim().length < 20) return { pass: false, reason: 'Output too short — generation failed' };
  if (startsWithRepetitiveLeadIn(text)) return { pass: false, reason: 'Contains repetitive lead-in boilerplate at section start' };
  if (hasRepeatedSentenceOpenings(text, 4, 1)) return { pass: false, reason: 'Contains repeated sentence openings that indicate duplicated boilerplate' };

  for (const pat of EDITORIAL_META_PATTERNS) {
    if (pat.test(text)) return { pass: false, reason: `Contains editorial meta-language: "${text.match(pat)?.[0]}"` };
  }
  for (const pat of PLACEHOLDER_PATTERNS) {
    if (pat.test(text)) return { pass: false, reason: `Contains unresolved placeholder: "${text.match(pat)?.[0]}"` };
  }

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const { min, max } = wordBounds(section, synopsisVariant);
  if (wordCount > max * 1.1) return { pass: false, reason: `Exceeds word limit: ${wordCount}/${max} words` };
  if (min && wordCount < min) return { pass: false, reason: `Output too thin (${wordCount} words) — minimum ${min} words required` };
  return { pass: true };
}

function baseRules(): string {
  return `You are a professional literary agent submission consultant. You produce polished, agent-ready materials that authors can submit directly to literary agents without editing.

ABSOLUTE RULES:
- Write in the author's voice, NOT as an advisor.
- Use only the provided manuscript, accepted evaluation/story facts, and author-supplied materials.
- NEVER invent plot facts, credentials, awards, education, publication history, personal facts, comps, or market claims.
- NEVER include editorial commentary, suggestions, or meta-language about the manuscript.
- NEVER use placeholder brackets like [Agent Name] or [Title].
- Output ONLY the finished, submission-ready text — no preambles, explanations, or notes.`;
}

function getSystemPrompt(section: SectionType, synopsisVariant: SynopsisVariant, hasBioMaterial: boolean): string {
  const rules = baseRules();
  switch (section) {
    case 'query_letter':
      return `${rules}

QUERY LETTER REQUIREMENTS:
- HARD CAP: 450 words maximum; 350-400 is ideal.
- Structure: story hook, stakes/conflict, metadata, comparables if available, optional bio sentence if author-supplied bio exists, professional close.
- BIO RULE: ${hasBioMaterial ? 'Use only the author-supplied or approved bio facts provided below.' : 'Do NOT include biographical claims. Do NOT invent credentials. Omit the bio paragraph and close professionally.'}
- Start with story, not setup. No rhetorical questions. No teaser language.
- Reveal enough narrative architecture that an agent can see the book, not just a mood.
- Match the manuscript tone and genre. Every sentence must advance story, market fit, or author credibility.`;

    case 'what_makes_unique':
      return `${rules}

UNIQUE DIFFERENTIATOR REQUIREMENTS:
- One focused paragraph, 100-150 words.
- Answer: what does THIS manuscript offer that the market does not already have?
- Lead with the differentiator itself, then support it with 2-3 specific manuscript details.
- Avoid vague claims like "fresh take," "unlike anything else," or "this novel is unique because."`;

    case 'synopsis': {
      const spec = SYNOPSIS_LIMITS[synopsisVariant];
      return `${rules}

SYNOPSIS REQUIREMENTS (${spec.label.toUpperCase()}):
- Length: ${spec.ideal}; hard cap ${spec.max} words.
- MUST reveal the ending/resolution if the ending is available in the provided story facts.
- Present tense, third person, active voice.
- Include setup, inciting incident, major turning points, climax, and resolution.
- Focus on protagonist agency and emotional arc, not a chapter-by-chapter breakdown.
- Name only essential characters.
- No teaser language; this is a professional synopsis, not back-cover copy.`;
    }

    case 'query_pitch':
      return `${rules}

QUERY PITCH REQUIREMENTS:
- ONE sentence, 25-50 words.
- Include protagonist identity, specific conflict/action, genre/positioning, and concrete stakes.
- No vague stakes such as "must confront the past" unless the provided facts make that specific.`;

    case 'comparables':
      return `${rules}

COMPARABLES REQUIREMENTS:
- Suggest 2-4 comparable titles with specific rationale.
- Prefer recent titles in the same or adjacent genre.
- Do not claim facts about a comp unless you are confident from general literary knowledge and the manuscript context.
- If uncertain, frame as provisional author-review positioning, not as final market fact.`;

    case 'author_bio':
      return `${rules}

AUTHOR BIO REQUIREMENTS:
- Third person, professional tone, 75-150 words.
- ONLY include facts from the author-supplied materials.
- NEVER invent credentials, awards, education, publication history, residence, personal details, or lived experience.
- Connect the author's real background to why they are positioned to write this manuscript.`;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return '';
}

function extractCertifiedCanonicalOpportunityContext(
  unifiedDocument: unknown,
  certificationContent: unknown,
): CertifiedCanonicalOpportunityContext {
  const blocked = (failureReason: string): CertifiedCanonicalOpportunityContext => ({
    opportunities: [],
    sourcePolicy: 'certified_ued_canonical_opportunity_ledger',
    failureReason,
  });

  if (!isRecord(unifiedDocument)) return blocked('unified_evaluation_document_v1 missing');
  if (!isRecord(certificationContent)) return blocked('author_exposure_certification_v1 missing');
  if (
    certificationContent.schema_version !== 'author_exposure_certification_v1' ||
    certificationContent.decision !== 'certified' ||
    typeof certificationContent.unified_document_hash !== 'string'
  ) {
    return blocked('author_exposure_certification_v1 is not certified');
  }

  if (canonicalJsonSha256(unifiedDocument) !== certificationContent.unified_document_hash) {
    return blocked('certified UED hash mismatch');
  }

  const ledger = isRecord(unifiedDocument.canonicalOpportunityLedger)
    ? unifiedDocument.canonicalOpportunityLedger
    : null;
  const rendered = Array.isArray(ledger?.rendered_opportunities)
    ? ledger.rendered_opportunities
    : [];

  const opportunities = rendered
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .map((item) => ({
      id: firstString(item.id, item.opportunity_id),
      primaryCriterion: firstString(item.primary_criterion, item.criterion),
      severity: firstString(item.severity),
      action: firstString(item.fix_direction, item.action, item.symptom),
      evidence: firstString(item.evidence, item.anchor_snippet, item.evidence_anchor),
      location: firstString(item.location, item.manuscript_coordinates),
      readerEffect: firstString(item.reader_effect, item.expected_impact),
    }))
    .filter((item) => item.id && item.action && item.evidence)
    .slice(0, 10);

  if (rendered.length > 0 && opportunities.length === 0) {
    return blocked('canonicalOpportunityLedger.rendered_opportunities contains no usable agent-readiness opportunities');
  }

  return {
    opportunities,
    sourcePolicy: 'certified_ued_canonical_opportunity_ledger',
    failureReason: null,
  };
}

async function fetchManuscriptContext(manuscriptId: number, evaluationJobId: string, userId: string) {
  const admin = createAdminClient();

  const { data: manuscript } = await admin
    .from('manuscripts')
    .select('id, title, word_count, created_at')
    .eq('id', manuscriptId)
    .single();

  const { data: artifact } = await admin
    .from('evaluation_artifacts')
    .select('content, artifact_type')
    .eq('job_id', evaluationJobId)
    .eq('artifact_type', 'unified_evaluation_document_v1')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: certificationRow } = await admin
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', evaluationJobId)
    .eq('artifact_type', 'author_exposure_certification_v1')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: chunks } = await admin
    .from('manuscript_chunks')
    .select('content, chunk_index')
    .eq('manuscript_id', manuscriptId)
    .order('chunk_index', { ascending: true })
    .limit(8);

  const { data: ledger } = await admin
    .from('evaluation_artifacts')
    .select('content')
    .eq('job_id', evaluationJobId)
    .in('artifact_type', ['accepted_story_ledger_v1', 'story_ledger_v1'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: approvedSections } = await admin
    .from('agent_readiness_sections')
    .select('section_type, content, status, updated_at')
    .eq('user_id', userId)
    .eq('manuscript_id', manuscriptId)
    .eq('evaluation_job_id', evaluationJobId)
    .eq('status', 'approved');

  const canonicalOpportunityContext = extractCertifiedCanonicalOpportunityContext(artifact?.content, certificationRow?.content);

  return {
    manuscript,
    artifact: artifact?.content,
    chunks: chunks?.map((c) => c.content).filter(Boolean) ?? [],
    storyLedger: ledger?.content,
    canonicalOpportunities: canonicalOpportunityContext.opportunities,
    canonicalOpportunitySourcePolicy: canonicalOpportunityContext.sourcePolicy,
    canonicalOpportunityFailureReason: canonicalOpportunityContext.failureReason,
    approvedSections: approvedSections ?? [],
  };
}

function stringifyIfUseful(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function buildContextSummary(ctx: Awaited<ReturnType<typeof fetchManuscriptContext>>): string {
  const parts: string[] = [];
  if (ctx.manuscript) {
    parts.push(`MANUSCRIPT: "${ctx.manuscript.title}"`);
    if (ctx.manuscript.word_count) parts.push(`Word Count: ${ctx.manuscript.word_count.toLocaleString()}`);
  }

  if (ctx.artifact && typeof ctx.artifact === 'object') {
    const result = ctx.artifact as Record<string, unknown>;
    const overview = result.overview && typeof result.overview === 'object' ? result.overview as Record<string, unknown> : null;
    const metadata = result.metadata && typeof result.metadata === 'object' ? result.metadata as Record<string, unknown> : null;
    if (overview?.genre) parts.push(`Genre: ${overview.genre}`);
    if (overview?.one_paragraph_summary) parts.push(`\nEVALUATION SUMMARY:\n${overview.one_paragraph_summary}`);
    if (Array.isArray(overview?.top_3_strengths)) parts.push(`\nTOP STRENGTHS:\n${overview.top_3_strengths.join('\n')}`);
    if (metadata?.genre_diagnosis) parts.push(`\nGENRE DIAGNOSIS: ${metadata.genre_diagnosis}`);
    if (metadata?.target_audience) parts.push(`TARGET AUDIENCE: ${metadata.target_audience}`);
    if (metadata?.market_readiness_verdict) parts.push(`MARKET READINESS: ${metadata.market_readiness_verdict}`);
  }

  if (ctx.storyLedger && typeof ctx.storyLedger === 'object') {
    const ledger = ctx.storyLedger as Record<string, unknown>;
    for (const key of ['protagonist', 'setting', 'central_conflict', 'themes', 'ending', 'resolution', 'major_turning_points']) {
      const value = stringifyIfUseful(ledger[key]);
      if (value) parts.push(`${key.toUpperCase()}: ${value}`);
    }
  }

  if (ctx.canonicalOpportunities.length > 0) {
    parts.push(`\nCANONICAL OPPORTUNITY LEDGER — SINGLE RECOMMENDATION SOURCE:\n${ctx.canonicalOpportunities.map((opp, index) => {
      const details = [
        `ID: ${opp.id}`,
        opp.primaryCriterion ? `Criterion: ${opp.primaryCriterion}` : '',
        opp.severity ? `Severity: ${opp.severity}` : '',
        `Action: ${opp.action}`,
        `Evidence: ${opp.evidence}`,
        opp.location ? `Location: ${opp.location}` : '',
        opp.readerEffect ? `Reader effect: ${opp.readerEffect}` : '',
      ].filter(Boolean).join(' | ');
      return `${index + 1}. ${details}`;
    }).join('\n')}`);
  }

  for (const section of ctx.approvedSections as Array<{ section_type: string; content: string }>) {
    if (section.section_type !== 'author_bio') {
      parts.push(`\nAPPROVED ${section.section_type.toUpperCase()} SECTION:\n${section.content}`);
    }
  }

  if (ctx.chunks.length > 0) {
    const openingText = ctx.chunks.slice(0, 3).join('\n\n').substring(0, 3500);
    parts.push(`\nMANUSCRIPT OPENING / VOICE SAMPLE:\n${openingText}`);
  }

  return parts.join('\n');
}

function approvedAuthorBio(ctx: Awaited<ReturnType<typeof fetchManuscriptContext>>): string {
  const match = (ctx.approvedSections as Array<{ section_type: string; content: string }>).find((s) => s.section_type === 'author_bio');
  return match?.content?.trim() ?? '';
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: GenerateRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { manuscriptId, evaluationJobId, section, mode, existingContent, authorBioInput } = body;
  const synopsisVariant = synopsisVariantFromRequest(body.synopsisLength, body.synopsisVariant);

  if (!manuscriptId || !evaluationJobId || !section) {
    return NextResponse.json({ error: 'Missing required fields: manuscriptId, evaluationJobId, section' }, { status: 400 });
  }
  if (!VALID_SECTIONS.includes(section)) return NextResponse.json({ error: `Invalid section: ${section}` }, { status: 400 });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });

  const ctx = await fetchManuscriptContext(manuscriptId, evaluationJobId, user.id);
  if (!ctx.manuscript) return NextResponse.json({ error: 'Manuscript not found' }, { status: 404 });

  if (section !== 'author_bio' && ctx.canonicalOpportunityFailureReason) {
    return NextResponse.json({
      error: 'Certified canonical recommendation ledger unavailable for Agent Readiness generation',
      code: 'CERTIFIED_CANONICAL_OPPORTUNITY_LEDGER_UNAVAILABLE',
      details: ctx.canonicalOpportunityFailureReason,
      sourcePolicy: ctx.canonicalOpportunitySourcePolicy,
    }, { status: 409 });
  }

  const suppliedBio = authorBioInput?.trim() ?? '';
  const existingApprovedBio = approvedAuthorBio(ctx);

  if (section === 'author_bio' && suppliedBio.length < 50) {
    return NextResponse.json({
      error: suppliedBio.length === 0
        ? 'Author Bio requires author-supplied materials (resume, CV, bio notes). No credentials can be invented.'
        : `Author Bio input too brief (${suppliedBio.length} characters). Please provide at least 50 characters of background information.`,
      section: 'author_bio',
      needsInput: true,
    }, { status: 422 });
  }

  const bioMaterial = suppliedBio || existingApprovedBio;
  const systemPrompt = getSystemPrompt(section, synopsisVariant, bioMaterial.length >= 50);
  const contextSummary = buildContextSummary(ctx);

  let userMessage = `Using the grounded manuscript data below, generate a professional, agent-submission-ready ${sectionLabel(section, synopsisVariant)} for "${ctx.manuscript.title}".\n\n${contextSummary}`;

  if (mode === 'improve' && existingContent) {
    userMessage = `Improve the author's draft ${sectionLabel(section, synopsisVariant)} while preserving their voice and intent. Do NOT add facts not grounded in the manuscript context or author-supplied materials.\n\nCURRENT DRAFT:\n${existingContent}\n\nMANUSCRIPT CONTEXT:\n${contextSummary}`;
  } else if (mode === 'regenerate') {
    userMessage += '\n\nGenerate a fresh version with a different structure or angle, still grounded only in the provided facts.';
  }

  if (section === 'author_bio') {
    const cappedBio = suppliedBio.length > 5000 ? suppliedBio.substring(0, 5000) + '\n\n[Input truncated — only first 5,000 characters used]' : suppliedBio;
    userMessage += `\n\nAUTHOR-SUPPLIED BIO MATERIALS:\n${cappedBio}`;
  } else if (bioMaterial.length >= 50) {
    userMessage += `\n\nAPPROVED/AUTHOR-SUPPLIED BIO MATERIALS FOR OPTIONAL USE:\n${bioMaterial}`;
  } else if (section === 'query_letter') {
    userMessage += '\n\nAUTHOR BIO STATUS: No author-supplied biography is available. Do not invent an author bio or credentials. Omit biographical claims.';
  }

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
      { maxAttempts: 2, label: `agent_readiness_${section}_${synopsisVariant}` },
    );
    generated = sanitizeAuthorFacingProse(completion.choices[0]?.message?.content?.trim() ?? '');
  } catch (err) {
    console.error(`[AgentReadiness] OpenAI call failed for section=${section}:`, err);
    return NextResponse.json({ error: 'Generation failed — please try again', details: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }

  const gate = qualityGate(generated, section, synopsisVariant);
  if (!gate.pass) {
    try {
      const retryCompletion = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: `${systemPrompt}\n\nCRITICAL: Your previous output was rejected: ${gate.reason}. Fix this issue.` },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.3,
        max_tokens: MAX_TOKENS,
      });
      const retryText = sanitizeAuthorFacingProse(retryCompletion.choices[0]?.message?.content?.trim() ?? '');
      const retryGate = qualityGate(retryText, section, synopsisVariant);
      if (!retryGate.pass) return NextResponse.json({ error: `Quality gate failed: ${retryGate.reason}`, generated: retryText, gateFailure: true }, { status: 422 });
      generated = retryText;
    } catch {
      return NextResponse.json({ error: `Quality gate failed: ${gate.reason}`, generated, gateFailure: true }, { status: 422 });
    }
  }

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
    }, { onConflict: 'user_id,manuscript_id,section_type' });

  if (saveError) {
    console.error(`[AgentReadiness] Failed to persist section=${section}:`, saveError.message);
    return NextResponse.json({ error: 'Failed to persist generated section', section }, { status: 500 });
  }

  return NextResponse.json({
    content: generated,
    section,
    synopsisVariant: section === 'synopsis' ? synopsisVariant : undefined,
    wordCount: generated.trim().split(/\s+/).filter(Boolean).length,
    wordLimit: wordBounds(section, synopsisVariant).max,
    model: MODEL,
    mode,
    persisted: true,
    sourcePolicy: section === 'author_bio' ? 'author_supplied_only' : ctx.canonicalOpportunitySourcePolicy,
  });
}

function sectionLabel(section: SectionType, synopsisVariant: SynopsisVariant): string {
  switch (section) {
    case 'query_letter': return 'Query Letter';
    case 'what_makes_unique': return 'What Makes This Novel Unique statement';
    case 'synopsis': return `${SYNOPSIS_LIMITS[synopsisVariant].label}`;
    case 'query_pitch': return 'Query Pitch';
    case 'comparables': return 'Comparable Titles section';
    case 'author_bio': return 'Author Bio';
  }
}
