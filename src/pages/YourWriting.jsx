import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, ArrowRight, BookOpen, FileText } from 'lucide-react';
import { toast } from "sonner";
import { createPageUrl } from '@/utils';
import RichTextEditor from '@/components/RichTextEditor';
import TransgressiveModeSelector from '@/components/evaluation/TransgressiveModeSelector';
import LanguageVariantSelector from '@/components/evaluation/LanguageVariantSelector';
import VoicePreservationToggle from '@/components/VoicePreservationToggle';

export default function YourWriting() {
  const [title, setTitle] = useState('');
  const [text, setText] = useState(sessionStorage.getItem('uploadedText') || '');
  const [evaluationMode, setEvaluationMode] = useState('standard');
  const [languageVariant, setLanguageVariant] = useState('en-US');
  const [voicePreservation, setVoicePreservation] = useState('balanced');
  const [isProcessing, setIsProcessing] = useState(false);

  // Clear sessionStorage after loading
  React.useEffect(() => {
    const screenplayText = sessionStorage.getItem('screenplay_text');
    const screenplayMode = sessionStorage.getItem('screenplay_mode');
    if (screenplayText) {
      setText(screenplayText);
      setTitle('Formatted Screenplay');
      sessionStorage.removeItem('screenplay_text');
    }
    if (screenplayMode) {
      setEvaluationMode(screenplayMode);
      sessionStorage.removeItem('screenplay_mode');
    }
    if (sessionStorage.getItem('uploadedText')) {
      sessionStorage.removeItem('uploadedText');
    }
  }, []);

  const handleEvaluate = async () => {
    if (!text.trim()) {
      toast.error('Please provide text to evaluate');
      return;
    }

    const plainText = text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
    const wordCount = plainText.split(/\s+/).filter(w => w).length;

    // Detect format and route accordingly
    const isFullManuscript = wordCount > 10000; // Threshold for full manuscript pipeline

    if (wordCount > 250000) {
      toast.error(
        <div>
          <div className="font-semibold mb-1">You've reached the preview limit.</div>
          <div className="text-sm">To evaluate additional chapters or generate a full manuscript score, unlock full analysis.</div>
        </div>,
        { duration: 6000 }
      );
      setTimeout(() => {
        window.location.href = createPageUrl('Pricing');
      }, 2000);
      return;
    }

    setIsProcessing(true);

    try {
      if (isFullManuscript) {
        // Full Manuscript Pipeline
        const manuscriptTitle = title.trim() || 'Untitled';
        const manuscript = await base44.entities.Manuscript.create({
          title: manuscriptTitle,
          full_text: text,
          word_count: wordCount,
          evaluation_mode: evaluationMode,
          language_variant: languageVariant,
          voice_preservation_level: voicePreservation,
          status: 'splitting'
        });

        toast.info('Splitting manuscript into chapters...');

        await base44.functions.invoke('splitManuscript', {
          manuscript_id: manuscript.id
        });

        const chapters = await base44.entities.Chapter.filter({ manuscript_id: manuscript.id });

        await base44.entities.Manuscript.update(manuscript.id, {
          status: 'summarizing',
          evaluation_progress: {
            chapters_total: chapters.length,
            chapters_summarized: 0,
            chapters_wave_done: 0,
            current_phase: 'summarize',
            percent_complete: 0,
            current_step: 'Starting evaluation...',
            last_updated: new Date().toISOString()
          }
        });

        const startEvaluation = async () => {
          try {
            await base44.functions.invoke('evaluateFullManuscript', {
              manuscript_id: manuscript.id
            });
          } catch (err) {
            console.error('Evaluation error (will auto-retry):', err);
            setTimeout(() => startEvaluation(), 2000);
          }
        };
        startEvaluation();

        toast.success('Evaluation started! Track progress on the next screen.');
        await new Promise(resolve => setTimeout(resolve, 1000));
        window.location.href = createPageUrl(`ManuscriptDashboard?id=${manuscript.id}`);

      } else {
        // Quick Evaluation Pipeline
        if (wordCount > 3000) {
          toast.error(
            <div>
              <div className="font-semibold mb-1">You've reached the preview limit.</div>
              <div className="text-sm">To evaluate additional chapters or generate a full manuscript score, unlock full analysis.</div>
            </div>,
            { duration: 6000 }
          );
          setTimeout(() => {
            window.location.href = createPageUrl('Pricing');
          }, 2000);
          setIsProcessing(false);
          return;
        }

        const response = await base44.functions.invoke('evaluateQuickSubmission', {
          title: title.trim() || 'Untitled',
          text,
          styleMode: 'neutral',
          evaluationMode,
          voicePreservation
        });

        if (!response.data.success) {
          throw new Error(response.data.error || 'Evaluation failed');
        }

        const submissionId = response.data.submissionId;
        toast.success('Analysis complete!');
        
        // Navigate to report
        await new Promise(resolve => setTimeout(resolve, 500));
        window.location.href = createPageUrl(`ViewReport?id=${submissionId}`);
      }

    } catch (error) {
      console.error('Evaluation error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to evaluate. Please try again.';
      toast.error(errorMsg, { duration: 6000 });
      setIsProcessing(false);
    }
  };

  const wordCount = text.split(/\s+/).filter(w => w).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-4">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
            <Sparkles className="w-4 h-4 mr-2" />
            Dual-Layer Professional Evaluation
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
            Your Writing
          </h1>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
            Upload or paste your writing below. Formatting is preserved. We'll automatically determine whether it's a scene, chapter, screenplay, or full manuscript and evaluate it accordingly.
          </p>
          <p className="mt-3 text-sm text-slate-500 max-w-2xl mx-auto">
            Scores reflect how your work aligns with agent-level criteria and WAVE standards. This is revision guidance, not a guarantee of representation or publication.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Writing Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Paste a paragraph, scene, chapter, screenplay, or full manuscript here
                  </label>
                  <RichTextEditor
                    value={text}
                    onChange={setText}
                    placeholder="Formatting (italics, bold, spacing) is preserved..."
                    minHeight="300px"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-slate-500">
                      Word count: {wordCount.toLocaleString()}
                    </p>
                    {wordCount > 250000 && (
                      <p className="text-xs text-red-600 font-medium">
                        Exceeds 250,000 word limit
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-6 rounded-xl bg-white border border-slate-200">
                  <LanguageVariantSelector 
                    value={languageVariant}
                    onChange={setLanguageVariant}
                  />
                </div>

                <div className="p-6 rounded-xl bg-white border border-slate-200">
                  <TransgressiveModeSelector 
                    value={evaluationMode}
                    onChange={setEvaluationMode}
                  />
                </div>

                <div className="p-6 rounded-xl bg-white border border-slate-200">
                  <VoicePreservationToggle 
                    value={voicePreservation}
                    onChange={setVoicePreservation}
                  />
                </div>

                <Button
                  onClick={handleEvaluate}
                  disabled={isProcessing || !text.trim() || wordCount > 250000}
                  className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  size="lg"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5 mr-2" />
                      Evaluate with RevisionGrade
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
              <h3 className="font-semibold text-slate-800 mb-4">How Evaluation Works</h3>
              <div className="space-y-3 text-sm text-slate-600">
                <p>
                  You don't need to choose a format.
                </p>
                <p>
                  RevisionGrade automatically analyzes structure, formatting, and length to determine whether your submission is a scene, chapter, screenplay, or full manuscript.
                </p>
                <p>
                  Shorter submissions are evaluated directly. Full manuscripts are processed in chapters with progress tracking.
                </p>
                <p className="text-xs text-slate-500 italic pt-2 border-t border-slate-200">
                  This ensures accurate scoring and consistent revision guidance.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-100">
              <h3 className="font-semibold text-slate-800 mb-4">Tips for Best Results</h3>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600">•</span>
                  Evaluate larger sections when possible. The more text RevisionGrade can see, the more accurately it can assess structure, pacing, and character development.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600">•</span>
                  Complete scenes or chapters produce more reliable insights than isolated paragraphs.
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-600">•</span>
                  Opening chapters receive focused attention on hooks, voice, and setup.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}