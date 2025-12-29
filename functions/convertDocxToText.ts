import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import mammoth from 'npm:mammoth@1.8.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return Response.json({ error: 'No file provided' }, { status: 400 });
        }

        // Convert to ArrayBuffer for mammoth
        const arrayBuffer = await file.arrayBuffer();

        // Extract text from DOCX
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;

        // Count words
        const wordCount = text.split(/\s+/).filter(w => w).length;

        if (wordCount > 250000) {
            return Response.json({ 
                success: false,
                error: `Document too large: ${wordCount.toLocaleString()} words. Maximum is 250,000 words.` 
            }, { status: 400 });
        }

        // Return extracted text and preview
        return Response.json({
            success: true,
            text: text,
            wordCount: wordCount,
            preview: text.substring(0, 2000) + (text.length > 2000 ? '...' : '')
        });

    } catch (error) {
        console.error('DOCX conversion error:', error);
        return Response.json({ 
            success: false,
            error: 'Failed to convert document. Please try pasting text or using a .TXT file.' 
        }, { status: 500 });
    }
});