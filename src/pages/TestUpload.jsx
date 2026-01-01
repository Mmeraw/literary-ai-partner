import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function TestUpload() {
    const [uploadResult, setUploadResult] = useState(null);
    const [uploading, setUploading] = useState(false);

    const handleFileChange = async (e) => {
        console.log('═══════════════════════════════════════');
        console.log('🎯 FILE INPUT CHANGE EVENT FIRED');
        console.log('Event:', e);
        console.log('Files:', e.target.files);
        
        const file = e.target.files?.[0];
        
        if (!file) {
            console.error('❌ No file selected');
            return;
        }
        
        console.log('✅ File detected:', {
            name: file.name,
            size: file.size,
            type: file.type
        });

        setUploading(true);
        try {
            console.log('📤 Calling base44.integrations.Core.UploadFile...');
            const result = await base44.integrations.Core.UploadFile({ file });
            console.log('✅ Upload success:', result);
            
            setUploadResult(result);
            toast.success(`File uploaded: ${file.name}`);
        } catch (error) {
            console.error('❌ Upload failed:', error);
            toast.error(`Upload failed: ${error.message}`);
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-12">
            <div className="max-w-2xl mx-auto">
                <Card>
                    <CardHeader>
                        <CardTitle>File Upload Test</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Test 1: Hidden input + label */}
                        <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg">
                            <h3 className="font-semibold mb-2">Test 1: Hidden Input + Label</h3>
                            <input
                                type="file"
                                id="test-upload-1"
                                onChange={handleFileChange}
                                className="hidden"
                                accept=".txt,.pdf,.doc,.docx"
                            />
                            <label htmlFor="test-upload-1" style={{ cursor: 'pointer' }}>
                                <Button type="button" variant="outline" disabled={uploading}>
                                    <Upload className="w-4 h-4 mr-2" />
                                    {uploading ? 'Uploading...' : 'Choose File (Pattern 1)'}
                                </Button>
                            </label>
                        </div>

                        {/* Test 2: Visible input (no styling) */}
                        <div className="p-4 border-2 border-dashed border-slate-300 rounded-lg">
                            <h3 className="font-semibold mb-2">Test 2: Native File Input</h3>
                            <input
                                type="file"
                                onChange={handleFileChange}
                                accept=".txt,.pdf,.doc,.docx"
                                disabled={uploading}
                                className="block"
                            />
                        </div>

                        {/* Results */}
                        {uploadResult && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                                    <div>
                                        <div className="font-semibold text-green-900">Upload Successful!</div>
                                        <div className="text-sm text-green-700 mt-1 break-all">
                                            URL: {uploadResult.file_url}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="text-sm text-slate-600 space-y-1">
                            <p>✅ Open Console to see detailed logs</p>
                            <p>✅ Open Network tab to verify API calls</p>
                            <p>✅ Try both upload methods above</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}