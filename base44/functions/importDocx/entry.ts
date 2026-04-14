import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import mammoth from 'npm:mammoth@1.8.0';

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

        // Fetch the file from the URL
        const fileResponse = await fetch(file_url);
        if (!fileResponse.ok) {
            return Response.json({ error: `Failed to fetch file: ${fileResponse.statusText}` }, { status: 400 });
        }

        // Read file as buffer
        const arrayBuffer = await fileResponse.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);

        // Convert .docx to text (extract plain text)
        const result = await mammoth.extractRawText({ buffer });

        return Response.json({
            success: true,
            text: result.value,
            messages: result.messages
        });

    } catch (error) {
        console.error('Import error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});