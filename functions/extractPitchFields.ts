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

        console.log('📄 Step 1: Fetching and processing file directly...');
        
        // Fetch file directly
        const response = await fetch(file_url);
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.status}`);
        }
        
        const fileName = file_url.split('/').pop() || 'unknown';
        const arrayBuffer = await response.arrayBuffer();
        
        let fileText = '';
        let fileType = 'txt';
        
        // Handle different file types
        if (fileName.toLowerCase().endsWith('.docx') || fileName.toLowerCase().endsWith('.doc')) {
            console.log('Processing Word document...');
            fileType = 'docx';
            const buffer = new Uint8Array(arrayBuffer);
            const mammoth = await import('npm:mammoth@1.8.0');
            const result = await mammoth.extractRawText({ buffer });
            fileText = result.value;
        } else if (fileName.toLowerCase().endsWith('.txt')) {
            console.log('Processing TXT file...');
            fileType = 'txt';
            fileText = new TextDecoder().decode(arrayBuffer);
        } else if (fileName.toLowerCase().endsWith('.pdf')) {
            console.log('Processing PDF file...');
            fileType = 'pdf';
            const pdfResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
                file_url,
                json_schema: { type: 'object', properties: { text: { type: 'string' } } }
            });
            fileText = pdfResult.output?.text || '';
        } else if (fileName.toLowerCase().endsWith('.rtf')) {
            console.log('Processing RTF file...');
            fileType = 'rtf';
            const rtfResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
                file_url,
                json_schema: { type: 'object', properties: { text: { type: 'string' } } }
            });
            fileText = rtfResult.output?.text || '';
        } else {
            throw new Error(`Unsupported file type: ${fileName}`);
        }
        
        console.log(`✅ File processed: ${fileText.length} characters from ${fileName}`);

        // Use first 50k characters for analysis (or full text if shorter)
        const manuscriptSample = fileText.substring(0, Math.min(50000, fileText.length));
        console.log(`Using ${manuscriptSample.length} characters for analysis`);

        console.log('🔍 Step 2: Extracting all pitch fields from manuscript...');
        const extractionPrompt = `Analyze this manuscript/screenplay excerpt and extract all fields for pitch generation.

MANUSCRIPT TEXT:
${manuscriptSample}

Extract and provide:
1. Title - Extract from the document header or opening
2. Genre - Be specific (e.g., "Eco-horror, Dark Fantasy", "Literary Thriller", "Contemporary Romance")
3. Word count estimate - Based on the full manuscript length
4. Logline - A compelling 1-2 sentence pitch that captures the core story
5. Key themes - Comma-separated list of 3-5 key themes
6. Protagonist - Name and brief description
7. Stakes - What's at risk? What will happen if the protagonist fails?
8. Setting - Location, time period, and world details
9. Unique hook - What makes this story different from everything else in the genre? The distinctive element that sets it apart.

Return structured JSON with all fields populated. Be specific and compelling.`;

        console.log('Calling LLM for extraction...');
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

        console.log('✅ Step 2 complete - Extraction successful');
        console.log('Extracted data:', JSON.stringify(extracted, null, 2));

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