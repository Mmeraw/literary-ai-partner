/**
 * Test generateQueryLetterPackage with minimal payload
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        console.log('🧪 Testing generateQueryLetterPackage integration...');

        // Create a test manuscript file
        const testManuscript = 'This is a test manuscript. '.repeat(5000); // ~40k+ words
        
        // Upload test file
        const fileBlob = new Blob([testManuscript], { type: 'text/plain' });
        const uploadResponse = await base44.integrations.Core.UploadFile({
            file: fileBlob
        });
        
        const fileUrl = uploadResponse.file_url;
        console.log('✅ Test file uploaded:', fileUrl);

        // Test query letter generation
        console.log('🔄 Calling generateQueryLetterPackage...');
        
        try {
            const result = await base44.functions.invoke('generateQueryLetterPackage', {
                file_url: fileUrl,
                bio: 'Test author bio',
                synopsis_mode: 'auto',
                comps_mode: 'auto',
                genre: 'Literary Fiction',
                voiceIntensity: 'house'
            });

            console.log('✅ generateQueryLetterPackage succeeded!');
            
            return Response.json({
                success: true,
                message: '✅ Integration test PASSED - generateQueryLetterPackage working correctly',
                result: {
                    query_letter_length: result.data?.query_letter?.length || 0,
                    agents_count: result.data?.suggested_agents?.length || 0,
                    metadata: result.data?.metadata
                }
            });

        } catch (error) {
            console.error('❌ generateQueryLetterPackage failed:', error);
            
            return Response.json({
                success: false,
                message: '❌ Integration test FAILED',
                error: error.message,
                stack: error.stack,
                details: 'Check if matrixPreflight and governanceVersion service functions are accessible'
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