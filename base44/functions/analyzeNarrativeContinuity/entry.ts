import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Story Architecture Layer (SAL)
 * Analyzes narrative continuity and promise resolution
 * 
 * Detects:
 * - Character threads (introduced → developed → resolved/exited)
 * - Conflict threads (raised → escalated → resolved)
 * - Questions/promises (planted → answered/addressed)
 * - Objects/symbols (introduced → paid off)
 * 
 * Flags:
 * - Characters appearing once with stakes, then vanishing
 * - Conflicts that start but don't resolve
 * - Questions raised but never answered
 * - Chekhov's Gun violations (introduced but never fired)
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { manuscript_id } = await req.json();

    if (!manuscript_id) {
      return Response.json({ error: 'manuscript_id required' }, { status: 400 });
    }

    // Fetch manuscript and chapters
    const manuscripts = await base44.asServiceRole.entities.Manuscript.filter({ id: manuscript_id });
    if (!manuscripts || manuscripts.length === 0) {
      return Response.json({ error: 'Manuscript not found' }, { status: 404 });
    }

    const manuscript = manuscripts[0];
    const chapters = await base44.asServiceRole.entities.Chapter.filter(
      { manuscript_id },
      'order'
    );

    if (!chapters || chapters.length === 0) {
      return Response.json({ error: 'No chapters found' }, { status: 404 });
    }

    // Extract narrative threads from chapter summaries
    const prompt = `You are a Story Architecture Analyst. Analyze this manuscript's narrative continuity.

MANUSCRIPT: ${manuscript.title}
TOTAL CHAPTERS: ${chapters.length}

CHAPTER SUMMARIES:
${chapters.map(ch => `Chapter ${ch.order}: ${ch.title}\n${JSON.stringify(ch.summary_json, null, 2)}`).join('\n\n')}

TASK: Identify narrative threads (characters, conflicts, questions, objects/symbols) and track their resolution.

DETECTION RULES:

1. CHARACTER THREADS
   - Named characters with implied stakes or emotional weight
   - Flag if: appears in ≤2 chapters AND has stakes BUT no clear exit/death/resolution
   - OK if: one-scene functional character (waiter, clerk, etc.)

2. CONFLICT THREADS
   - Arguments, ruptures, rivalries, tensions between characters
   - Flag if: conflict introduced BUT no escalation/consequence/resolution
   - Flag if: fight happens but "we never spoke of it again" is absent

3. QUESTION/PROMISE THREADS
   - Explicit narrative questions ("What happened to X?", "Where did Y go?")
   - Implicit promises (foreshadowing, setup, prophecy)
   - Flag if: question raised BUT never answered/reframed/marked as haunting

4. OBJECT/SYMBOL THREADS (Chekhov's Gun)
   - Significant objects introduced with weight/focus
   - Flag if: object gets narrative spotlight BUT never used/paid off
   - OK if: background texture (not spotlighted)

5. RELATIONSHIP THREADS
   - Romantic, familial, mentor relationships introduced
   - Flag if: relationship starts BUT no arc/resolution

6. PHYSICAL STATE CONTINUITY (PSC)
   - Objects/environments described in mutually exclusive states without transition
   - Mutually exclusive pairs: wet ↔ dry, fresh ↔ aged, clean ↔ grimy, intact ↔ broken, warm ↔ cold, recently altered ↔ long-abandoned
   - Flag if: same object described in contradictory physical states (e.g., "dust-covered and curling" + "ink still wet") without causal explanation
   - OK if: transition language present ("after the rain...", "where someone recently touched it...")

RESOLUTION STATES:
- "resolved": Thread has clear closure/payoff
- "intentionally_open": Ambiguity is thematically earned (e.g., haunting absence)
- "unresolved_suspect": Appears forgotten, not intentional
- "deferred": Multi-book series setup

For each thread, provide:
- label (name/identifier)
- thread_type
- introduced_chapter
- introduced_scene (brief context)
- mentions (array of {chapter, context})
- resolution_status
- resolution_chapter (if resolved)
- resolution_note
- flag_reason (if unresolved_suspect)

Return JSON with threads array.`;

    const analysis = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          threads: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                thread_type: { 
                  type: "string",
                  enum: ["character", "conflict", "object_symbol", "question_promise", "relationship", "motif", "physical_continuity"]
                },
                introduced_chapter: { type: "number" },
                introduced_scene: { type: "string" },
                mentions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      chapter: { type: "number" },
                      context: { type: "string" }
                    }
                  }
                },
                resolution_status: {
                  type: "string",
                  enum: ["resolved", "intentionally_open", "unresolved_suspect", "deferred"]
                },
                resolution_chapter: { type: "number" },
                resolution_note: { type: "string" },
                flag_reason: { type: "string" }
              },
              required: ["label", "thread_type", "introduced_chapter", "resolution_status"]
            }
          }
        },
        required: ["threads"]
      }
    });

    // Save threads to database
    const savedThreads = [];
    for (const thread of analysis.threads) {
      const threadData = {
        manuscript_id,
        label: thread.label,
        thread_type: thread.thread_type,
        introduced_chapter: thread.introduced_chapter,
        introduced_scene: thread.introduced_scene || '',
        mentions: thread.mentions || [],
        resolution_status: thread.resolution_status,
        resolution_chapter: thread.resolution_chapter,
        resolution_note: thread.resolution_note || '',
        flag_reason: thread.flag_reason || '',
        author_override: false
      };

      const saved = await base44.asServiceRole.entities.NarrativeThread.create(threadData);
      savedThreads.push(saved);
    }

    // Generate summary report
    const report = {
      total_threads: savedThreads.length,
      resolved: savedThreads.filter(t => t.resolution_status === 'resolved').length,
      intentionally_open: savedThreads.filter(t => t.resolution_status === 'intentionally_open').length,
      unresolved_suspect: savedThreads.filter(t => t.resolution_status === 'unresolved_suspect').length,
      deferred: savedThreads.filter(t => t.resolution_status === 'deferred').length,
      flagged_threads: savedThreads
        .filter(t => t.resolution_status === 'unresolved_suspect')
        .map(t => ({
          label: t.label,
          type: t.thread_type,
          introduced: t.introduced_chapter,
          reason: t.flag_reason
        }))
    };

    // Update manuscript with continuity analysis
    await base44.asServiceRole.entities.Manuscript.update(manuscript_id, {
      continuity_report: report
    });

    return Response.json({
      success: true,
      report,
      threads: savedThreads
    });

  } catch (error) {
    console.error('Narrative continuity analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});