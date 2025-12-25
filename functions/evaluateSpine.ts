import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { manuscript_id } = await req.json();

    if (!manuscript_id) {
      return Response.json({ error: 'Manuscript ID required' }, { status: 400 });
    }

    // Get manuscript and chapters
    const manuscripts = await base44.asServiceRole.entities.Manuscript.filter({ id: manuscript_id });
    const manuscript = manuscripts[0];

    if (!manuscript) {
      return Response.json({ error: 'Manuscript not found' }, { status: 404 });
    }

    const chapters = await base44.asServiceRole.entities.Chapter.filter({ manuscript_id }, 'order');

    // Create compressed representation
    const chapterSummaries = chapters.map(ch => {
      const excerpt = ch.text.split(/\s+/).slice(0, 100).join(' ');
      return `Chapter ${ch.order}: ${ch.title} (${ch.word_count} words)\nExcerpt: ${excerpt}...`;
    }).join('\n\n');

    // Evaluate spine
    const spineAnalysis = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a senior literary agent evaluating a full manuscript for representation.

MANUSCRIPT: ${manuscript.title}
Total word count: ${manuscript.word_count}
Chapters: ${chapters.length}

${chapterSummaries}

Evaluate this COMPLETE MANUSCRIPT against these 12 criteria (rate 1-10):

1. Premise & Hook - Is the concept compelling and marketable?
2. Plot Spine - Does the plot escalate logically with rising stakes?
3. Character Arc - Do characters transform meaningfully?
4. Thematic Coherence - Are themes woven naturally throughout?
5. Tension & Pacing - Does momentum build across the full book?
6. Climax Quality - Is the climax earned and satisfying?
7. Resolution - Does the ending resolve key threads?
8. Voice Consistency - Is the voice distinct and maintained?
9. Structural Integrity - Do all parts serve the whole?
10. Emotional Investment - Will readers care about the journey?
11. Market Readiness - Is this ready for agent submission?
12. Overall Strength - Holistic assessment

For each: score (1-10), strengths (array), weaknesses (array), notes (string).
Also provide: overallScore (1-10), verdict (string), majorStrengths (array), criticalWeaknesses (array).`,
      response_json_schema: {
        type: "object",
        properties: {
          overallScore: { type: "number" },
          verdict: { type: "string" },
          majorStrengths: { type: "array", items: { type: "string" } },
          criticalWeaknesses: { type: "array", items: { type: "string" } },
          criteria: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                score: { type: "number" },
                strengths: { type: "array", items: { type: "string" } },
                weaknesses: { type: "array", items: { type: "string" } },
                notes: { type: "string" }
              },
              required: ["name", "score", "strengths", "weaknesses", "notes"]
            }
          }
        },
        required: ["overallScore", "verdict", "criteria"]
      }
    });

    // Update manuscript with spine evaluation
    await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
      spine_score: spineAnalysis.overallScore,
      spine_evaluation: spineAnalysis,
      status: 'ready'
    });

    return Response.json({ 
      success: true,
      spine_evaluation: spineAnalysis
    });

  } catch (error) {
    console.error('Spine evaluation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});