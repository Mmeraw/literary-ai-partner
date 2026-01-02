import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import OpenAI from 'npm:openai@4.76.1';

const openai = new OpenAI({
    apiKey: Deno.env.get("OPENAI_API_KEY"),
});

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

    // Evaluate SPINE (gate artifact - NOT the 13 criteria)
    const spineResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: `You are a structural editor evaluating the SPINE (narrative skeleton) of a manuscript.

MANUSCRIPT: ${manuscript.title}
Total word count: ${manuscript.word_count}
Chapters: ${chapters.length}

${chapterSummaries}

Evaluate the NARRATIVE SPINE as a gate artifact. This is NOT the 13 criteria evaluation.

Assess these SPINE-SPECIFIC elements:

1. **Protagonist Objective Clarity** (1-10)
   - Is there a single, clear driving want/need that structures the narrative?
   - Can you state it in one sentence: "Protagonist must [X] or [Y] will happen"?

2. **Antagonistic Force Strength** (1-10)
   - Is the opposition concrete and escalating?
   - Does it create unavoidable pressure on the protagonist?

3. **Causal Chain Integrity** (1-10)
   - Does A cause B, B cause C (because/therefore logic)?
   - Or are events episodic (and then/and then)?

4. **Stakes Escalation** (1-10)
   - Do consequences grow more severe across the arc?
   - Is there a clear "point of no return"?

5. **Climax Mechanism** (1-10)
   - Is there a decisive confrontation/choice that cannot be avoided?
   - Does it force irreversible consequence?

6. **Resolution Closure** (1-10)
   - Are core narrative promises resolved or intentionally deferred?
   - Does the ending answer the central dramatic question?

For each: score (1-10), evidence (string), red_flags (array of strings).

Also provide:
- spine_statement: one-sentence summary of protagonist's core objective
- spine_score: overall spine strength (1-10)
- spine_flags: array of structural issues (e.g., "objective_blur", "weak_causality", "climax_lacks_trigger", "closure_deferred_unintentionally")
- gate_status: "PASS" if spine_score >= 7, "NEEDS_WORK" if < 7
- notes: actionable guidance for strengthening spine` }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "spine_gate_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              spine_statement: { type: "string" },
              spine_score: { type: "number" },
              spine_flags: { type: "array", items: { type: "string" } },
              gate_status: { type: "string", enum: ["PASS", "NEEDS_WORK"] },
              notes: { type: "string" },
              elements: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    score: { type: "number" },
                    evidence: { type: "string" },
                    red_flags: { type: "array", items: { type: "string" } }
                  },
                  required: ["name", "score", "evidence", "red_flags"],
                  additionalProperties: false
                }
              }
            },
            required: ["spine_statement", "spine_score", "spine_flags", "gate_status", "notes", "elements"],
            additionalProperties: false
          }
        }
      }
    });
    const spineAnalysis = JSON.parse(spineResponse.choices[0].message.content);

    // Build spine record with status
    const spineRecord = {
      status: "COMPLETE",
      story_spine: spineAnalysis.spine_statement,
      spine_score: spineAnalysis.spine_score,
      spine_flags: spineAnalysis.spine_flags,
      spine_notes: spineAnalysis.notes,
      generated_at: new Date().toISOString(),
      rubric_version: "SPINE_v1.0",
      gate_status: spineAnalysis.gate_status,
      elements: spineAnalysis.elements
    };

    // Update manuscript with spine gate artifact
    await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
      spine_score: spineAnalysis.spine_score,
      spine_evaluation: spineRecord,
      spine_completed_at: new Date().toISOString(),
      status: spineAnalysis.gate_status === 'PASS' ? 'spine_complete' : 'spine_evaluating'
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