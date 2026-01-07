import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, ArrowRight, BookOpen, FileText, Upload } from 'lucide-react';
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
  const [isUploading, setIsUploading] = useState(false);
  const [workTypeDetection, setWorkTypeDetection] = useState(null);
  const [showWorkTypeConfirm, setShowWorkTypeConfirm] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);

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

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'application/pdf',
      'text/plain'
    ];

    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload a .docx, .doc, .pdf, or .txt file');
      return;
    }

    setIsUploading(true);
    toast.info('Extracting text from file...');

    try {
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      
      const extractResponse = await base44.functions.invoke('ingestUploadedFileToText', {
        file_url: uploadResult.file_url
      });

      if (extractResponse.data?.text) {
        setText(extractResponse.data.text);
        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, ''));
        }
        toast.success('File uploaded successfully');
      } else {
        throw new Error('No text extracted from file');
      }
    } catch (error) {
      console.error('File upload error:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to extract text from file');
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleDetectWorkType = async () => {
    if (!text.trim()) {
      toast.error('Please provide text to evaluate');
      return;
    }

    setIsDetecting(true);
    try {
      const response = await base44.functions.invoke('detectWorkType', {
        text,
        title: title || 'Untitled'
      });

      setWorkTypeDetection(response.data);
      setShowWorkTypeConfirm(true);
    } catch (error) {
      console.error('Work Type detection error:', error);
      toast.error('Failed to detect Work Type. Please try again.');
    } finally {
      setIsDetecting(false);
    }
  };

  const handleConfirmWorkType = (finalWorkType, userAction, userProvidedWorkType = null) => {
    setWorkTypeDetection({
      ...workTypeDetection,
      final_work_type_used: finalWorkType,
      user_action: userAction,
      user_provided_work_type: userProvidedWorkType
    });
    setShowWorkTypeConfirm(false);
    proceedWithEvaluation(finalWorkType, userAction, userProvidedWorkType);
  };

  const proceedWithEvaluation = async (finalWorkType, userAction, userProvidedWorkType) => {
    setIsProcessing(true);
    
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
          voicePreservation,
          final_work_type_used: finalWorkType,
          detected_work_type: workTypeDetection?.detected_work_type,
          detection_confidence: workTypeDetection?.detection_confidence,
          user_action: userAction,
          user_provided_work_type: userProvidedWorkType
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

  const handleEvaluate = async () => {
    if (!text.trim()) {
      toast.error('Please provide text to evaluate');
      return;
    }

    // First, detect Work Type
    await handleDetectWorkType();
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
            Upload or paste your writing below. Formatting is preserved. We'll automatically determine what you've submitted and evaluate it accordingly.
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
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">
                      Paste a paragraph, scene, chapter, screenplay, or full manuscript here
                    </label>
                    <div>
                      <input
                        type="file"
                        id="file-upload"
                        className="hidden"
                        accept=".docx,.doc,.pdf,.txt"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                      />
                      <label htmlFor="file-upload">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUploading}
                          onClick={() => document.getElementById('file-upload').click()}
                          className="cursor-pointer"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Upload File
                            </>
                          )}
                        </Button>
                      </label>
                    </div>
                  </div>
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
                  <p className="mt-1 text-xs text-slate-500">
                    Upload .docx, .pdf, or .txt files, or paste directly
                  </p>
                </div>

                <div className="p-6 rounded-xl bg-white border border-slate-200">
                  <LanguageVariantSelector 
                    value={languageVariant}
                    onChange={setLanguageVariant}
                  />
                </div>

                <div className="p-6 rounded-xl bg-white border border-slate-200">
                  <p className="text-sm text-slate-600 mb-4 pb-4 border-b border-slate-200">
                    You don't need to choose a format. Evaluation Mode affects how your writing is analyzed—not what it's categorized as.
                  </p>
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
                  disabled={isProcessing || isDetecting || !text.trim() || wordCount > 250000}
                  className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                  size="lg"
                >
                  {isDetecting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Detecting Work Type...
                    </>
                  ) : isProcessing ? (
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

                {/* Work Type Confirmation Dialog */}
                {showWorkTypeConfirm && workTypeDetection && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8">
                      <h3 className="text-2xl font-bold text-slate-900 mb-4">Confirm Work Type</h3>
                      <div className="p-4 rounded-lg bg-indigo-50 border border-indigo-200 mb-6">
                        <p className="text-sm text-slate-700 mb-2">
                          <strong>Detected:</strong> {workTypeDetection.work_type_label}
                        </p>
                        <p className="text-sm text-slate-600">
                          <strong>Confidence:</strong> {workTypeDetection.detection_confidence}
                        </p>
                      </div>
                      <p className="text-sm text-slate-600 mb-4">
                        Work Type determines which evaluation criteria apply to your writing. Some criteria may not be applicable (N/A) based on your format.
                      </p>
                      <div className="flex gap-3">
                        <Button
                          onClick={() => handleConfirmWorkType(workTypeDetection.detected_work_type, 'confirm')}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                        >
                          Confirm
                        </Button>
                        <Button
                          onClick={() => setShowWorkTypeConfirm(false)}
                          variant="outline"
                          className="flex-1"
                        >
                          Choose Different Type
                        </Button>
                      </div>
                      {workTypeDetection.all_work_types && (
                        <details className="mt-4">
                          <summary className="text-sm text-slate-600 cursor-pointer hover:text-slate-900">
                            View all Work Types
                          </summary>
                          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                            {workTypeDetection.all_work_types.map((wt) => (
                              <button
                                key={wt.id}
                                onClick={() => handleConfirmWorkType(wt.id, 'override', wt.id)}
                                className="w-full text-left p-3 rounded-lg hover:bg-slate-100 border border-slate-200"
                              >
                                <p className="text-sm font-medium text-slate-900">{wt.label}</p>
                                <p className="text-xs text-slate-600">{wt.family}</p>
                              </button>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
              <h3 className="font-bold text-slate-900 mb-4 text-base">How Evaluation Works</h3>
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