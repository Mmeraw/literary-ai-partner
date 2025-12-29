import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import mammoth from 'npm:mammoth@1.8.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ 
                success: false,
                error: '🔒 Please sign in to upload documents',
                errorType: 'auth'
            }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file');

        if (!file) {
            return Response.json({ 
                success: false,
                error: '📄 No document selected. Please choose a .DOCX file.',
                errorType: 'validation'
            }, { status: 400 });
        }

        // Validate file type
        const fileName = file.name?.toLowerCase() || '';
        if (!fileName.endsWith('.docx')) {
            return Response.json({ 
                success: false,
                error: '⚠️ Only .DOCX files supported. For older .DOC files, save as .DOCX first or paste text directly.',
                errorType: 'format'
            }, { status: 400 });
        }

        // Convert to ArrayBuffer for mammoth
        const arrayBuffer = await file.arrayBuffer();

        // Extract raw text AND HTML for preview
        const [textResult, htmlResult] = await Promise.all([
            mammoth.extractRawText({ arrayBuffer }),
            mammoth.convertToHtml({ arrayBuffer })
        ]);

        const text = textResult.value;
        const html = htmlResult.value;
        const messages = htmlResult.messages || [];

        // Count words
        const wordCount = text.split(/\s+/).filter(w => w).length;

        if (wordCount === 0) {
            return Response.json({ 
                success: false,
                error: '📭 Document appears empty. Please check the file or try pasting text directly.',
                errorType: 'empty'
            }, { status: 400 });
        }

        if (wordCount > 250000) {
            return Response.json({ 
                success: false,
                error: `📊 Document too large: ${wordCount.toLocaleString()} words (max 250,000). Consider submitting chapters separately.`,
                errorType: 'size'
            }, { status: 400 });
        }

        // Analyze extraction quality
        const warnings = messages.filter(m => m.type === 'warning');
        const italicsCount = (html.match(/<em>/g) || []).length;
        const boldCount = (html.match(/<strong>/g) || []).length;
        const footnoteCount = (html.match(/<sup>/g) || []).length;

        // Build quality metrics
        const extractionQuality = {
            wordCount,
            italicsPreserved: italicsCount,
            boldPreserved: boldCount,
            footnotesDetected: footnoteCount,
            warnings: warnings.length,
            hasComplexFormatting: warnings.length > 5
        };

        // Generate preview with formatting indicators
        const htmlPreview = html.substring(0, 3000) + (html.length > 3000 ? '...' : '');
        const textPreview = text.substring(0, 2000) + (text.length > 2000 ? '...' : '');

        return Response.json({
            success: true,
            text: text,
            html: htmlPreview,
            wordCount: wordCount,
            preview: textPreview,
            quality: extractionQuality,
            message: warnings.length > 5 
                ? `⚠️ Complex formatting detected (${warnings.length} style warnings). Text extracted successfully—minor formatting may differ.`
                : `✓ Document converted cleanly. ${italicsCount + boldCount + footnoteCount > 0 ? `Preserved: ${italicsCount} italics, ${boldCount} bold, ${footnoteCount} footnotes.` : ''}`
        });

    } catch (error) {
        console.error('DOCX conversion error:', error);
        
        // Premium error message based on error type
        let errorMessage = '🔄 Conversion issue detected. ';
        
        if (error.message?.includes('zip') || error.message?.includes('corrupt')) {
            errorMessage += 'File may be corrupted. Try re-saving as .DOCX or paste text directly.';
        } else if (error.message?.includes('password') || error.message?.includes('encrypt')) {
            errorMessage += 'Document appears password-protected. Remove protection and try again.';
        } else {
            errorMessage += 'Complex document structure. Paste text for fastest results.';
        }

        return Response.json({ 
            success: false,
            error: errorMessage,
            errorType: 'conversion',
            fallback: 'paste'
        }, { status: 500 });
    }
});