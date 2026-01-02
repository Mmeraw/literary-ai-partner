import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import OpenAI from 'npm:openai@4.76.1';

const openai = new OpenAI({
    apiKey: Deno.env.get("OPENAI_API_KEY"),
});

const WAVE_RUBRIC_VERSION = "WAVE_FLAGS_v1.0";

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

    // Sample chapters for WAVE analysis
    const sampleChapters = [
      chapters[0],
      chapters[Math.floor(chapters.length / 2)],
      chapters[chapters.length - 1]
    ].filter(Boolean);

    const chapterTexts = sampleChapters.map(ch => 
      `Chapter ${ch.order}: ${ch.title}\n${ch.text.substring(0, 2000)}...`
    ).join('\n\n');

    // Evaluate WAVE flags
    const waveResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: `You are evaluating manuscript chapters against the WAVE revision system.

MANUSCRIPT: ${manuscript.title}
Sample chapters (beginning, middle, end):

${chapterTexts}

Evaluate these WAVE dimensions (return "OK" or "FLAG" for each):

**STRUCTURAL FLAGS:**
- SceneGoal: Does each scene have a clear narrative function (reveal/escalate/complicate/resolve)?
- CauseEffect: Do events follow because/therefore logic rather than and-then episodic structure?
- POVIntegrity: Is POV stable, intentional, and free from unintended drift?

**MOMENTUM FLAGS:**
- EchoMotif: Are motifs/phrases overused or used with precision?
- Compression: Is prose economical or padded with unnecessary words?
- ActionReaction: Do character actions generate proportional consequences?

**CLOSURE FLAGS:**
- PromisesKept: Are narrative setups resolved or intentionally left open?
- NarrativeClosure: Does the work resolve its central dramatic question?

Return "OK" if the manuscript meets the standard, "FLAG" if it needs attention.
Also provide brief notes on flagged items.` }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "wave_flags_analysis",
          strict: true,
          schema: {
            type: "object",
            properties: {
              flags: {
                type: "object",
                properties: {
                  Structural: {
                    type: "object",
                    properties: {
                      SceneGoal: { type: "string", enum: ["OK", "FLAG"] },
                      CauseEffect: { type: "string", enum: ["OK", "FLAG"] },
                      POVIntegrity: { type: "string", enum: ["OK", "FLAG"] }
                    },
                    required: ["SceneGoal", "CauseEffect", "POVIntegrity"],
                    additionalProperties: false
                  },
                  Momentum: {
                    type: "object",
                    properties: {
                      EchoMotif: { type: "string", enum: ["OK", "FLAG"] },
                      Compression: { type: "string", enum: ["OK", "FLAG"] },
                      ActionReaction: { type: "string", enum: ["OK", "FLAG"] }
                    },
                    required: ["EchoMotif", "Compression", "ActionReaction"],
                    additionalProperties: false
                  },
                  Closure: {
                    type: "object",
                    properties: {
                      PromisesKept: { type: "string", enum: ["OK", "FLAG"] },
                      NarrativeClosure: { type: "string", enum: ["OK", "FLAG"] }
                    },
                    required: ["PromisesKept", "NarrativeClosure"],
                    additionalProperties: false
                  }
                },
                required: ["Structural", "Momentum", "Closure"],
                additionalProperties: false
              },
              notes: { type: "string" }
            },
            required: ["flags", "notes"],
            additionalProperties: false
          }
        }
      }
    });
    
    const waveAnalysis = JSON.parse(waveResponse.choices[0].message.content);

    const waveFlagsRecord = {
      status: "COMPLETE",
      flags: waveAnalysis.flags,
      notes: waveAnalysis.notes,
      generated_at: new Date().toISOString(),
      rubric_version: WAVE_RUBRIC_VERSION
    };

    // Update manuscript with WAVE flags
    await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
      revisiongrade_breakdown: {
        ...manuscript.revisiongrade_breakdown,
        wave_flags: waveFlagsRecord
      }
    });

    return Response.json({ 
      success: true,
      wave_flags: waveFlagsRecord
    });

  } catch (error) {
    console.error('WAVE flags evaluation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});