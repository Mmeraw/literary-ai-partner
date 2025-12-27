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
  const [text, setText] = useState(sessionStorage.getItem('uploadedText') || '');
  const [isUploading, setIsUploading] = useState(false);

  // Clear sessionStorage after loading
  React.useEffect(() => {
    if (sessionStorage.getItem('uploadedText')) {
      sessionStorage.removeItem('uploadedText');
    }
  }, []);

  const handleUpload = async () => {
    if (!text.trim()) {
      toast.error('Please provide manuscript text');
      return;
    }

    setIsUploading(true);

    try {
      const wordCount = text.split(/\s+/).length;
      const manuscriptTitle = title.trim() || 'Untitled';

      // Create manuscript
      const manuscript = await base44.entities.Manuscript.create({
        title: manuscriptTitle,
        full_text: text,
        word_count: wordCount,
        status: 'splitting'
      });

      toast.info('Splitting manuscript into chapters...');

      // Split into chapters
      await base44.functions.invoke('splitManuscript', {
        manuscript_id: manuscript.id
      });

      // Set status to evaluating so progress screen shows
      await base44.entities.Manuscript.update(manuscript.id, {
        status: 'spine_evaluating',
        evaluation_progress: {
          total_chapters: 0,
          completed_chapters: 0,
          current_step: 'Starting evaluation...'
        }
      });

      // Start evaluation in background (don't wait)
      base44.functions.invoke('evaluateFullManuscript', {
        manuscript_id: manuscript.id
      }).catch(err => console.error('Evaluation error:', err));

      toast.success('Evaluation started! Track progress on the next screen.');
      
      // Navigate to manuscript dashboard immediately
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        <div className="text-center mb-4 sm:mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-2 sm:mb-4">
            <BookOpen className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Upload Your Writing</h1>
          <p className="mt-1 sm:mt-2 text-sm sm:text-base text-slate-600">
              Analyze a page, a chapter, or your entire manuscript
          </p>
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-500 max-w-2xl mx-auto">
              Scores reflect how your work aligns with agent-level criteria and WAVE standards. This is revision guidance, not a guarantee of representation or publication.
          </p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Manuscript Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 sm:mb-2">
                Project Title (optional)
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Helps you organize your submissions"
                className="text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1 sm:mb-2">
                Paste your writing below
              </label>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste a paragraph, scene, chapter, or full manuscript here..."
                className="min-h-[300px] sm:min-h-[400px] font-mono text-sm"
              />
              <p className="mt-1 text-xs sm:text-sm text-slate-500">
                Word count: {wordCount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                You can submit partial drafts, excerpts, or complete works. Your text is never shared or published.
              </p>
            </div>

            <div className="p-3 sm:p-4 rounded-lg bg-indigo-50 border border-indigo-200">
              <h4 className="font-semibold text-indigo-900 mb-1 sm:mb-2 text-sm sm:text-base">What happens next:</h4>
              <ul className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-indigo-800">
                <li>• Text evaluated for structure, pacing, and craft</li>
                <li>• Longer works automatically split into chapters</li>
                <li>• Scored against 12 agent criteria and 60+ WAVE checks</li>
                <li>• Receive your RevisionGrade™ score and detailed feedback</li>
              </ul>
            </div>

            <Button
              onClick={handleUpload}
              disabled={isUploading || !text.trim()}
              className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              size="lg"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Starting Evaluation...
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  Start Your Evaluation
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}