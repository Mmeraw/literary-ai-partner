/**
 * Test Query Letter Generation Endpoint - Post-Refactor Validation
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        console.log('🧪 Testing Query Letter Generation Endpoint...');

        // Create test manuscript
        const testManuscript = 'Chapter One\n\n'.repeat(2500); // ~50k words
        
        // Upload test file
        const fileBlob = new Blob([testManuscript], { type: 'text/plain' });
        const uploadResponse = await base44.integrations.Core.UploadFile({
            file: fileBlob
        });
        
        const fileUrl = uploadResponse.file_url;
        console.log('✅ Test file uploaded:', fileUrl);

        // Call Query Letter Generation
        console.log('🔄 Calling generateQueryLetterPackage...');
        const startTime = Date.now();
        
        try {
            const result = await base44.functions.invoke('generateQueryLetterPackage', {
                file_url: fileUrl,
                bio: 'Test author with extensive writing background',
                synopsis_mode: 'auto',
                comps_mode: 'auto',
                genre: 'Literary Fiction',
                voiceIntensity: 'house'
            });

            const elapsed = Date.now() - startTime;
            
            return Response.json({
                success: true,
                message: '✅ Query Letter Generation Working!',
                elapsed_ms: elapsed,
                response: {
                    status: result.status,
                    query_letter_length: result.data?.query_letter?.length || 0,
                    agents_count: result.data?.suggested_agents?.length || 0,
                    metadata: result.data?.metadata
                },
                validation: {
                    has_query_letter: !!result.data?.query_letter,
                    has_agents: !!result.data?.suggested_agents,
                    has_metadata: !!result.data?.metadata,
                    preflight_passed: !!result.data?.metadata?.matrix_preflight
                }
            });

        } catch (functionError) {
            const elapsed = Date.now() - startTime;
            
            console.error('❌ Function invocation failed:', functionError);
            
            return Response.json({
                success: false,
                message: '❌ Query Letter Generation Failed',
                elapsed_ms: elapsed,
                error: {
                    message: functionError.message,
                    status: functionError.response?.status,
                    data: functionError.response?.data,
                    headers: functionError.response?.headers
                },
                diagnostics: {
                    error_type: functionError.constructor.name,
                    stack: functionError.stack?.split('\n').slice(0, 5)
                }
            }, { status: 500 });
        }

    } catch (error) {
        console.error('Test setup error:', error);
        return Response.json({ 
            error: 'Test setup failed',
            details: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});