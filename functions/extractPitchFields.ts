import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { file_url } = await req.json();

        if (!file_url) {
            return Response.json({ error: 'file_url is required' }, { status: 400 });
        }

        console.log('📄 Fetching manuscript file for pitch extraction...');
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            throw new Error(`Failed to fetch file: ${fileResponse.status} ${fileResponse.statusText}`);
        }
        const fileBuffer = await fileResponse.arrayBuffer();
        const fileText = new TextDecoder().decode(fileBuffer);
        console.log(`✅ File fetched: ${fileText.length} characters`);

        // Use first 50k characters for analysis
        const manuscriptSample = fileText.substring(0, 50000);

        console.log('🔍 Extracting all pitch fields from manuscript...');
        const extractionPrompt = `Analyze this manuscript/screenplay and extract all fields for pitch generation:

Manuscript excerpt:
${manuscriptSample}

Extract and provide:
1. Title (from document)
2. Genre (be specific, e.g., "Eco-horror, Dark Fantasy")
3. Word count estimate
4. Logline/pitch (1-2 compelling sentences)
5. Key themes (comma-separated)
6. Protagonist (name and brief description)
7. Stakes (what's at risk?)
8. Setting (location and time period)
9. Unique hook (what makes this different from everything else in the genre?)

Return structured JSON with all fields populated.`;

        const extracted = await base44.integrations.Core.InvokeLLM({
            prompt: extractionPrompt,
            response_json_schema: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    genre: { type: 'string' },
                    wordCount: { type: 'string' },
                    logline: { type: 'string' },
                    keyThemes: { type: 'string' },
                    protagonist: { type: 'string' },
                    stakes: { type: 'string' },
                    setting: { type: 'string' },
                    uniqueHook: { type: 'string' }
                }
            }
        });

        console.log('✅ Extraction complete:', { title: extracted.title, genre: extracted.genre });

        return Response.json({
            success: true,
            fields: extracted
        });

    } catch (error) {
        console.error('❌ Pitch field extraction error:', error);
        console.error('Error stack:', error.stack);
        return Response.json({ 
            error: 'Failed to extract pitch fields', 
            details: error.message 
        }, { status: 500 });
    }
});