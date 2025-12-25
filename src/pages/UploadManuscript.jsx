import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Loader2, BookOpen, FileText } from 'lucide-react';
import { toast } from "sonner";
import { createPageUrl } from '@/utils';

export default function UploadManuscript() {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!title.trim() || !text.trim()) {
      toast.error('Please provide both title and manuscript text');
      return;
    }

    setIsUploading(true);

    try {
      const wordCount = text.split(/\s+/).length;

      // Create manuscript
      const manuscript = await base44.entities.Manuscript.create({
        title,
        full_text: text,
        word_count: wordCount,
        status: 'splitting'
      });

      toast.info('Splitting manuscript into chapters...');

      // Split into chapters
      await base44.functions.invoke('splitManuscript', {
        manuscript_id: manuscript.id
      });

      toast.success('Manuscript uploaded successfully!');
      
      // Navigate to manuscript dashboard
      window.location.href = createPageUrl(`ManuscriptDashboard?id=${manuscript.id}`);

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload manuscript');
      setIsUploading(false);
    }
  };

  const wordCount = text.split(/\s+/).filter(w => w).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Upload Full Manuscript</h1>
          <p className="mt-2 text-slate-600">
            Get comprehensive spine evaluation + chapter-by-chapter analysis
          </p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Manuscript Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Title
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter your manuscript title"
                className="text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Full Manuscript Text
              </label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your complete manuscript here..."
                className="min-h-[400px] font-mono text-sm"
              />
              <p className="mt-2 text-sm text-slate-500">
                Word count: {wordCount.toLocaleString()}
              </p>
            </div>

            <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200">
              <h4 className="font-semibold text-indigo-900 mb-2">What happens next:</h4>
              <ul className="space-y-1 text-sm text-indigo-800">
                <li>• Manuscript split into chapters automatically</li>
                <li>• Spine evaluation analyzes plot, arc, and theme</li>
                <li>• Each chapter can be evaluated with WAVE Revision</li>
                <li>• Get aggregate RevisionGrade score</li>
              </ul>
            </div>

            <Button
              onClick={handleUpload}
              disabled={isUploading || !title.trim() || !text.trim()}
              className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              size="lg"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Uploading Manuscript...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Upload & Analyze Manuscript
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}