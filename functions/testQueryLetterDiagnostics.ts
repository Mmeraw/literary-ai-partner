/**
 * Query Letter Endpoint Diagnostics - Capture Full Failure Details
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        console.log('🔍 Query Letter Endpoint Diagnostics Started');
        
        // Use existing manuscript file or create simple text
        const testText = Array(25000).fill('word').join(' '); // ~50k words
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('file', new Blob([testText], { type: 'text/plain' }), 'test-manuscript.txt');
        
        // Upload via Core.UploadFile integration
        console.log('📤 Uploading test manuscript...');
        let fileUrl;
        try {
            const uploadResult = await base44.integrations.Core.UploadFile({
                file: new Blob([testText], { type: 'text/plain' })
            });
            fileUrl = uploadResult.file_url;
            console.log('✅ File uploaded:', fileUrl);
        } catch (uploadError) {
            return Response.json({
                stage: 'FILE_UPLOAD',
                error: uploadError.message,
                details: uploadError.response?.data,
                stack: uploadError.stack
            }, { status: 500 });
        }

        // Call Query Letter Generation
        console.log('🔄 Invoking generateQueryLetterPackage...');
        const startTime = Date.now();
        
        try {
            const response = await base44.asServiceRole.functions.invoke('generateQueryLetterPackage', {
                file_url: fileUrl,
                bio: 'Award-winning author with 10+ years writing literary fiction.',
                synopsis_mode: 'auto',
                comps_mode: 'auto',
                genre: 'Literary Fiction',
                voiceIntensity: 'house'
            });

            const elapsed = Date.now() - startTime;
            
            console.log('✅ Query Letter Generation Succeeded');
            
            return Response.json({
                success: true,
                stage: 'COMPLETE',
                elapsed_ms: elapsed,
                response: {
                    status: response.status,
                    data_keys: Object.keys(response.data || {}),
                    query_letter_length: response.data?.query_letter?.length || 0,
                    agents_count: response.data?.suggested_agents?.length || 0,
                    has_metadata: !!response.data?.metadata,
                    preflight_data: response.data?.metadata?.matrix_preflight
                },
                headers: response.headers || {},
                diagnostics: {
                    request_id: response.headers?.['x-request-id'] || 'N/A',
                    correlation_id: response.headers?.['x-correlation-id'] || 'N/A',
                    base44_trace: response.headers?.['x-base44-trace'] || 'N/A'
                }
            });

        } catch (functionError) {
            const elapsed = Date.now() - startTime;
            
            console.error('❌ Query Letter Generation Failed');
            console.error('Error:', functionError.message);
            console.error('Response:', functionError.response?.data);
            
            return Response.json({
                success: false,
                stage: 'QUERY_LETTER_GENERATION',
                elapsed_ms: elapsed,
                error: {
                    message: functionError.message,
                    type: functionError.constructor.name,
                    http_status: functionError.response?.status,
                    response_body: functionError.response?.data,
                    response_text: functionError.response?.statusText
                },
                headers: {
                    request_id: functionError.response?.headers?.['x-request-id'] || 'N/A',
                    correlation_id: functionError.response?.headers?.['x-correlation-id'] || 'N/A',
                    base44_trace: functionError.response?.headers?.['x-base44-trace'] || 'N/A',
                    all_headers: functionError.response?.headers || {}
                },
                diagnostics: {
                    stack_trace: functionError.stack?.split('\n').slice(0, 10),
                    invoked_function: 'generateQueryLetterPackage',
                    payload_sent: {
                        file_url: fileUrl.substring(0, 100) + '...',
                        bio_length: 'Award-winning author with 10+ years writing literary fiction.'.length,
                        has_genre: true,
                        has_modes: true
                    }
                },
                next_steps: [
                    'Check response_body for specific error message',
                    'Share request_id with Base44 Support',
                    'Review generateQueryLetterPackage function logs',
                    'Verify service function invocations (governanceVersion, matrixPreflight)'
                ]
            }, { status: 500 });
        }

    } catch (error) {
        console.error('💥 Test Framework Error:', error);
        return Response.json({ 
            stage: 'TEST_SETUP',
            error: 'Test framework error',
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 10)
        }, { status: 500 });
    }
});