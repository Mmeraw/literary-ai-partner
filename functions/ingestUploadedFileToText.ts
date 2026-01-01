import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Shared ingestion function - converts any uploaded file to plain text
 * Supports: DOCX, DOC, TXT, PDF, RTF
 * Returns normalized response contract
 */
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ 
                success: false, 
                error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
            }, { status: 401 });
        }

        const { file_url } = await req.json();

        if (!file_url) {
            return Response.json({ 
                success: false, 
                error: { code: 'MISSING_FILE_URL', message: 'file_url is required' }
            }, { status: 400 });
        }

        console.log('📄 Ingesting file:', file_url);
        
        const fileName = file_url.toLowerCase();
        const isWordDoc = fileName.endsWith('.docx') || fileName.endsWith('.doc');
        const isTxt = fileName.endsWith('.txt');
        const isPdf = fileName.endsWith('.pdf');
        const isRtf = fileName.endsWith('.rtf');
        
        let extractedText = '';
        let fileType = '';
        
        if (isWordDoc) {
            console.log('🔧 Processing Word document...');
            fileType = fileName.endsWith('.docx') ? 'docx' : 'doc';
            
            // Fetch file directly
            const response = await fetch(file_url);
            if (!response.ok) {
                throw new Error(`Failed to fetch DOCX: ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            
            // Use mammoth directly
            const mammoth = await import('npm:mammoth@1.8.0');
            const result = await mammoth.extractRawText({ arrayBuffer });
            extractedText = result.value;
            console.log(`✅ Word document extracted: ${extractedText.length} characters`);
        } 
        else if (isTxt) {
            console.log('📄 Processing plain text file...');
            fileType = 'txt';
            const response = await fetch(file_url);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${response.status} ${response.statusText}`);
            }
            
            const buffer = await response.arrayBuffer();
            extractedText = new TextDecoder().decode(buffer);
            console.log(`✅ Text file extracted: ${extractedText.length} characters`);
        }
        else if (isPdf || isRtf) {
            console.log(`📄 Processing ${isPdf ? 'PDF' : 'RTF'} file...`);
            fileType = isPdf ? 'pdf' : 'rtf';
            const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
                file_url,
                json_schema: {
                    type: "object",
                    properties: {
                        text: { type: "string" }
                    }
                }
            });
            
            if (extracted.status === 'success') {
                extractedText = extracted.output?.text || '';
                console.log(`✅ ${fileType.toUpperCase()} file extracted: ${extractedText.length} characters`);
            } else {
                throw new Error(`Extraction failed: ${extracted.details || 'Unknown error'}`);
            }
        }
        else {
            return Response.json({ 
                success: false, 
                error: { 
                    code: 'UNSUPPORTED_FORMAT', 
                    message: 'Unsupported file format. Please upload DOC, DOCX, TXT, PDF, or RTF files.'
                }
            }, { status: 400 });
        }

        // Normalize and return
        const filename = file_url.split('/').pop() || 'unknown';
        
        console.log(`✅ Ingestion complete: ${extractedText.length} characters extracted from ${filename}`);
        
        return Response.json({
            success: true,
            text: extractedText,
            meta: {
                filename,
                filetype: fileType,
                charCount: extractedText.length
            }
        });

    } catch (error) {
        console.error('❌ Ingestion error:', error);
        return Response.json({ 
            success: false,
            error: { 
                code: 'INGESTION_FAILED', 
                message: error.message 
            }
        }, { status: 500 });
    }
});