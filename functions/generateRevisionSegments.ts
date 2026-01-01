import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { base_version_id, new_version_id, output_type } = await req.json();

        if (!base_version_id || !new_version_id || !output_type) {
            return Response.json({ 
                error: 'Missing required fields: base_version_id, new_version_id, output_type' 
            }, { status: 400 });
        }

        // Fetch both versions
        const baseVersion = await base44.entities.OutputVersion.filter({ id: base_version_id });
        const newVersion = await base44.entities.OutputVersion.filter({ id: new_version_id });

        if (!baseVersion.length || !newVersion.length) {
            return Response.json({ error: 'Version not found' }, { status: 404 });
        }

        const baseText = baseVersion[0].content;
        const newText = newVersion[0].content;

        // Create revision event
        const revisionEvent = await base44.entities.RevisionEvent.create({
            output_id: baseVersion[0].output_id,
            output_type,
            base_version_id,
            new_version_id,
            status: 'pending'
        });

        // Generate segments using LLM to identify meaningful changes
        const response = await base44.integrations.Core.InvokeLLM({
            prompt: `You are a text diff analyzer. Compare the following two versions and identify all meaningful changes.

ORIGINAL:
${baseText}

REVISED:
${newText}

For each change, provide:
1. original_text: the exact span from the original
2. revised_text: the exact span from the revised version
3. change_type: "edit", "insert", or "delete"
4. rationale: brief explanation (clarity, pacing, tone, specificity, etc.)
5. criteria_tag: one of "clarity", "pacing", "structure", "tone", "redundancy", "specificity", "voice", "grammar"

Rules:
- Identify phrase/sentence-level changes (not character-level)
- Only return actual changes, not unchanged text
- Keep original_text and revised_text concise (max 2-3 sentences each)
- Order changes sequentially as they appear
- Focus on substantive edits, not minor punctuation

Return a JSON array of change objects.`,
            response_json_schema: {
                type: "object",
                properties: {
                    segments: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                original_text: { type: "string" },
                                revised_text: { type: "string" },
                                change_type: { type: "string", enum: ["edit", "insert", "delete"] },
                                rationale: { type: "string" },
                                criteria_tag: { 
                                    type: "string", 
                                    enum: ["clarity", "pacing", "structure", "tone", "redundancy", "specificity", "voice", "grammar"]
                                }
                            },
                            required: ["original_text", "revised_text", "change_type", "rationale", "criteria_tag"]
                        }
                    }
                },
                required: ["segments"]
            }
        });

        // Store segments
        const segments = response.segments || [];
        const createdSegments = [];

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const created = await base44.entities.RevisionSegment.create({
                revision_event_id: revisionEvent.id,
                original_text: seg.original_text,
                revised_text: seg.revised_text,
                change_type: seg.change_type,
                rationale: seg.rationale,
                criteria_tag: seg.criteria_tag,
                order_index: i
            });
            createdSegments.push(created);
        }

        return Response.json({
            success: true,
            revision_event_id: revisionEvent.id,
            segments: createdSegments,
            segment_count: createdSegments.length
        });

    } catch (error) {
        console.error('Revision segment generation error:', error);
        return Response.json({ 
            error: 'Failed to generate revision segments',
            details: error.message 
        }, { status: 500 });
    }
});