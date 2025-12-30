import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Sparkles, Loader2, FileText, CheckCircle2, Circle, Download, Waves, TrendingUp } from 'lucide-react';
import { toast } from "sonner";
import { createPageUrl } from '@/utils';
import BenchmarkComparisonModal from '@/components/BenchmarkComparisonModal';

export default function ManuscriptDashboard() {
  const [searchParams] = useSearchParams();
  const manuscriptId = searchParams.get('id');
  const [isEvaluatingSpine, setIsEvaluatingSpine] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const queryClient = useQueryClient();

  const { data: manuscript, isLoading: loadingManuscript } = useQuery({
    queryKey: ['manuscript', manuscriptId],
    queryFn: async () => {
      const results = await base44.entities.Manuscript.filter({ id: manuscriptId });
      return results[0];
    },
    enabled: !!manuscriptId,
    refetchInterval: (data) => {
      // Poll every 2 seconds during any evaluation phase or if progress incomplete
      if (!data) return 2000; // Keep polling until data loads
      const isEvaluating = ['uploaded', 'splitting', 'summarizing', 'spine_evaluating', 'evaluating_chapters'].includes(data.status);
      const hasActiveProgress = data.evaluation_progress && data.evaluation_progress.current_phase !== 'finalize';
      const hasIncompleteProgress = data.evaluation_progress?.percent_complete < 100;
      return (isEvaluating || hasActiveProgress || hasIncompleteProgress) ? 2000 : false;
    },
    refetchIntervalInBackground: true,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0
  });

  const { data: chapters = [], isLoading: loadingChapters } = useQuery({
    queryKey: ['chapters', manuscriptId],
    queryFn: async () => {
      return await base44.entities.Chapter.filter({ manuscript_id: manuscriptId }, 'order');
    },
    enabled: !!manuscriptId
  });

  const handleSpineEvaluation = async () => {
    setIsEvaluatingSpine(true);

    // Keep-alive to prevent timeout
    const keepAlive = setInterval(() => {
      console.log('Spine evaluation in progress...');
    }, 5000);

    try {
      toast.info('Evaluating manuscript spine... this may take 30-60 seconds');
      
      await base44.functions.invoke('evaluateSpine', {
        manuscript_id: manuscriptId
      });

      toast.success('Spine evaluation complete!');
      window.location.reload();
    } catch (error) {
      toast.error('Spine evaluation failed. Please try again.');
    } finally {
      clearInterval(keepAlive);
      setIsEvaluatingSpine(false);
    }
  };

  const handleDownloadSpineReport = async () => {
    if (!manuscript?.spine_evaluation) return;
    
    const evaluation = manuscript.spine_evaluation;
    let reportText = `${manuscript.title}\nSpine Evaluation Report\n${'='.repeat(50)}\n\n`;
    
    reportText += `Overall Spine Score: ${evaluation.overallScore}/10\n`;
    reportText += `Verdict: ${evaluation.verdict}\n\n`;
    
    if (evaluation.majorStrengths?.length > 0) {
      reportText += `MAJOR STRENGTHS\n${'-'.repeat(50)}\n`;
      evaluation.majorStrengths.forEach(s => {
        reportText += `✓ ${s}\n`;
      });
      reportText += '\n';
    }
    
    if (evaluation.criticalWeaknesses?.length > 0) {
      reportText += `CRITICAL WEAKNESSES\n${'-'.repeat(50)}\n`;
      evaluation.criticalWeaknesses.forEach(w => {
        reportText += `✗ ${w}\n`;
      });
      reportText += '\n';
    }
    
    reportText += `13 SPINE CRITERIA\n${'='.repeat(50)}\n\n`;
    evaluation.criteria?.forEach(criterion => {
      reportText += `${criterion.name} - ${criterion.score}/10\n${'-'.repeat(50)}\n`;
      
      if (criterion.strengths?.length > 0) {
        reportText += 'Strengths:\n';
        criterion.strengths.forEach(s => reportText += `  • ${s}\n`);
      }
      
      if (criterion.weaknesses?.length > 0) {
        reportText += 'Weaknesses:\n';
        criterion.weaknesses.forEach(w => reportText += `  • ${w}\n`);
      }
      
      if (criterion.notes) {
        reportText += `Notes: ${criterion.notes}\n`;
      }
      
      reportText += '\n';
    });
    
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${manuscript.title.replace(/\s+/g, '_')}_spine_report.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Spine report downloaded');

    // Send email
    try {
      const user = await base44.auth.me();
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: `RevisionGrade: Spine Report for "${manuscript.title}"`,
        body: reportText
      });
      toast.success('Report also sent to your email');
    } catch (error) {
      console.error('Email send failed:', error);
    }
  };

  if (loadingManuscript || loadingChapters) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Show evaluation progress screen (exclude ready_with_errors - that shows results)
  if (['summarizing', 'spine_evaluating', 'evaluating_chapters'].includes(manuscript?.status)) {
    const progress = manuscript.evaluation_progress || {};
    const percentComplete = progress.percent_complete || 0;

    const handleResumeEvaluation = async () => {
      setIsRestarting(true);
      toast.info('Restarting evaluation...');
      try {
        // Trigger backend evaluation (this will reset progress and continue)
        await base44.functions.invoke('evaluateFullManuscript', {
          manuscript_id: manuscriptId
        });

        toast.success('Evaluation restarted');

        // Force reload immediately
        window.location.reload();
      } catch (error) {
        console.error('Resume error:', error);
        toast.error('Failed to restart. Please try again.');
      } finally {
        setIsRestarting(false);
      }
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center">
        <Card className="border-0 shadow-2xl max-w-2xl w-full mx-4">
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-4">
                <Sparkles className="w-8 h-8 text-white animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Evaluating Your Manuscript</h2>
              <p className="text-slate-600">
                Running comprehensive analysis: 13 Agent Criteria + 63 WAVE Checks
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-700">
                  {progress.current_step || 'Starting evaluation...'}
                </span>
                <span className="text-sm font-semibold text-indigo-600">
                  {percentComplete}%
                </span>
              </div>
              <Progress value={percentComplete} className="h-3" />
              <p className="text-xs text-slate-500 mt-2">
                Analyzing structure, pacing, and narrative cohesion across chapters
              </p>
            </div>

            <div className="space-y-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  progress.current_phase === 'summarize' ? 'bg-indigo-500 animate-pulse' :
                  progress.chapters_summarized === progress.chapters_total ? 'bg-green-500' : 'bg-slate-300'
                }`} />
                <span>Chapter Summaries (Structural)</span>
                {progress.chapters_summarized === progress.chapters_total && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  progress.current_phase === 'spine' ? 'bg-indigo-500 animate-pulse' :
                  manuscript.spine_score ? 'bg-green-500' : 'bg-slate-300'
                }`} />
                <span>Spine Evaluation (13 Agent Criteria)</span>
                {manuscript.spine_score && <CheckCircle2 className="w-4 h-4 text-green-500 ml-auto" />}
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  progress.current_phase === 'wave' ? 'bg-indigo-500 animate-pulse' :
                  progress.chapters_wave_done > 0 ? 'bg-green-500' : 'bg-slate-300'
                }`} />
                <span>Chapter-by-Chapter Analysis (WAVE System)</span>
                {progress.chapters_wave_done > 0 && (
                  <span className="text-xs text-slate-500 ml-auto">
                    {progress.chapters_wave_done}/{progress.chapters_total}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-6 p-4 rounded-lg bg-indigo-50 border border-indigo-200">
              <p className="text-xs text-indigo-800 mb-3">
                Stuck at {percentComplete}%? Evaluation runs in background—click below to force restart from current position.
              </p>
              <Button
                onClick={handleResumeEvaluation}
                variant="outline"
                size="sm"
                className="w-full"
                disabled={isRestarting}
              >
                {isRestarting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Restarting...
                  </>
                ) : (
                  'Force Restart Evaluation'
                )}
              </Button>
            </div>
            </CardContent>
            </Card>
            </div>
            );
            }

  if (!manuscript) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-slate-600">Manuscript not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show warning banner if evaluation completed with failures
  const hasEvaluationWarnings = manuscript.status === 'ready_with_errors';
  const failedChapters = manuscript.evaluation_progress?.failed_chapters || [];

  const evaluatedChapters = chapters.filter(ch => ch.status === 'evaluated').length;
  const evaluatedWords = chapters
    .filter(ch => ch.status === 'evaluated')
    .reduce((sum, ch) => sum + (ch.word_count || 0), 0);

  const avgChapterScore = evaluatedChapters > 0
    ? chapters.reduce((sum, ch) => sum + (ch.evaluation_score || 0), 0) / evaluatedChapters
    : 0;

  // Check if any chapters have partial WAVE results (spine done, WAVE incomplete)
  const chaptersWithPartialWave = chapters.filter(ch => 
    ch.status === 'evaluated' && ch.evaluation_result?.partial_wave === true
  ).length;

  // Score gating: only show overall if ≥30% chapters OR ≥25k words evaluated
  const scoreThresholdMet = (evaluatedChapters / chapters.length) >= 0.3 || evaluatedWords >= 25000;

  const globalScore = manuscript.revisiongrade_overall || 
    (manuscript.spine_score && evaluatedChapters > 0
      ? (0.5 * manuscript.spine_score + 0.5 * avgChapterScore)
      : manuscript.spine_score || avgChapterScore);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          {hasEvaluationWarnings && failedChapters.length > 0 && (
            <Card className="mb-6 bg-amber-50 border-amber-200">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center">
                    <span className="text-white text-sm">⚠</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-amber-900 mb-1">
                      Evaluation completed with {failedChapters.length} issue(s)
                    </h3>
                    <p className="text-sm text-amber-800 mb-2">
                      Some chapters could not be fully evaluated due to timeouts or processing errors.
                    </p>
                    <details className="text-sm">
                      <summary className="cursor-pointer text-amber-700 hover:text-amber-900 font-medium">
                        View failed chapters
                      </summary>
                      <ul className="mt-2 space-y-1 text-amber-700">
                        {failedChapters.map((ch, idx) => (
                          <li key={idx}>• {ch.title}: {ch.error || 'Processing timeout'}</li>
                        ))}
                      </ul>
                    </details>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-slate-900">{manuscript.title}</h1>
            <div className="flex gap-2">
              {manuscript.spine_score && (
                <>
                  <Link to={createPageUrl('ComparativeReport?manuscriptId=' + manuscriptId)}>
                    <Button
                      variant="outline"
                      className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                    >
                      <TrendingUp className="w-4 h-4" />
                      Compare to Published Works
                    </Button>
                  </Link>
                  <BenchmarkComparisonModal 
                    manuscriptId={manuscriptId}
                    manuscriptTitle={manuscript.title}
                  />
                  <Button
                    onClick={handleDownloadSpineReport}
                    variant="outline"
                    className="gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download Spine Report
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span>{manuscript.word_count.toLocaleString()} words</span>
            <span>•</span>
            <span>{chapters.length} chapters</span>
            <span>•</span>
            <span>{evaluatedChapters} evaluated</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Overall RevisionGrade™ */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50">
            <CardHeader>
              <CardTitle className="text-2xl">Overall RevisionGrade™</CardTitle>
              <p className="text-sm text-slate-600 mt-1">Story + Craft: 13 Criteria + 63 WAVE Checks</p>
            </CardHeader>
            <CardContent>
              {scoreThresholdMet ? (
                <>
                  <div className="text-6xl font-bold text-indigo-600 mb-4">
                    {globalScore.toFixed(1)}/10
                  </div>
                  <p className="text-sm text-slate-600 mb-4">
                    Based on spine + chapter-level analysis.
                    {evaluatedChapters < chapters.length && ' Score stabilizes as more chapters are evaluated.'}
                  </p>
                </>
              ) : (
                <>
                  <div className="text-5xl font-bold text-slate-400 mb-4">
                    {manuscript.spine_score && evaluatedChapters === 0 ? 'Spine Complete' : 'In Progress'}
                  </div>
                  <p className="text-sm text-slate-700 mb-4">
                    {manuscript.spine_score && evaluatedChapters === 0 ? (
                      <>Spine evaluation: <span className="font-semibold text-indigo-600">{manuscript.spine_score.toFixed(1)}/10</span>. WAVE craft checks needed to unlock full score.</>
                    ) : manuscript.spine_score ? (
                      <>Spine evaluation: <span className="font-semibold text-indigo-600">{manuscript.spine_score.toFixed(1)}/10</span>. Run chapter analysis to unlock your full score.</>
                    ) : (
                      'Complete evaluation to see your overall score.'
                    )}
                  </p>
                  {chaptersWithPartialWave > 0 && (
                    <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                      <p className="text-xs text-amber-800">
                        <span className="font-semibold">Note:</span> {chaptersWithPartialWave} chapter(s) completed with WAVE checks skipped due to timeouts. Story analysis complete, craft scoring unavailable.
                      </p>
                    </div>
                  )}
                </>
              )}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                    <BookOpen className="w-4 h-4" />
                    <span>Story (Spine)</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-800">
                    {manuscript.spine_score?.toFixed(1) || '—'}/10
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                    <Waves className="w-4 h-4" />
                    <span>Craft (WAVE)</span>
                  </div>
                  <div className="text-3xl font-bold text-slate-800">
                    {evaluatedChapters > 0 ? avgChapterScore.toFixed(1) : '—'}/10
                  </div>
                  {chaptersWithPartialWave > 0 && evaluatedChapters > 0 && (
                    <p className="text-xs text-amber-600 mt-1">Partial - {chaptersWithPartialWave} skipped</p>
                  )}
                </div>
              </div>
              {scoreThresholdMet && <Progress value={globalScore * 10} className="h-3 mt-4" />}
            </CardContent>
          </Card>

          {/* Quality Improvement Monitor */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Quality Improvement Progress</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Tracks revision impact on your score</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">Chapters Evaluated</span>
                    <span className="text-sm font-semibold text-slate-900">
                      {evaluatedChapters}/{chapters.length}
                    </span>
                  </div>
                  <Progress value={(evaluatedChapters / chapters.length) * 100} className="h-2" />
                </div>
                
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">Initial Score</span>
                    <span className="text-sm font-semibold text-slate-700">
                      {globalScore.toFixed(1)}/10
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-slate-500">Revised Score</span>
                    <span className="text-sm font-semibold text-slate-400">
                      —/10
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Improvement</span>
                    <span className="text-sm font-semibold text-slate-400">
                      —
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t">
                  <p className="text-xs text-slate-500">
                    Start revising chapters to track your quality improvement
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chapters Table */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Chapters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {chapters.map((chapter) => (
                <div
                  key={chapter.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    {chapter.status === 'evaluated' && chapter.evaluation_score && (
                      <div className={`w-3 h-3 rounded-full ${
                        chapter.evaluation_score >= 8 ? 'bg-green-500' :
                        chapter.evaluation_score >= 6 ? 'bg-amber-500' :
                        'bg-red-500'
                      }`} />
                    )}
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 text-sm font-semibold text-slate-700">
                      {chapter.order}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900">{chapter.title}</h4>
                      <p className="text-sm text-slate-500">{chapter.word_count.toLocaleString()} words</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {chapter.status === 'evaluated' ? (
                      <>
                        <Badge className="bg-green-100 text-green-700">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {chapter.evaluation_score?.toFixed(1)}/10
                        </Badge>
                        <div className="flex gap-2">
                          <Link to={createPageUrl(`ChapterReport?id=${chapter.id}`)}>
                            <Button variant="outline" size="sm">
                              View Report
                            </Button>
                          </Link>
                          <Button 
                            size="sm" 
                            className="bg-purple-600 hover:bg-purple-700"
                            onClick={async () => {
                              const session = await base44.entities.RevisionSession.create({
                                submission_id: chapter.id,
                                title: chapter.title,
                                original_text: chapter.text,
                                current_text: chapter.text,
                                suggestions: [],
                                status: 'in_progress'
                              });
                              window.location.href = createPageUrl(`Revise?session=${session.id}`);
                            }}
                          >
                            <Waves className="w-4 h-4 mr-2" />
                            Start Revision
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <Badge variant="outline">
                          <Circle className="w-3 h-3 mr-1" />
                          Not Evaluated
                        </Badge>
                        <Link to={createPageUrl(`EvaluateChapter?id=${chapter.id}`)}>
                          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700">
                            <Sparkles className="w-4 h-4 mr-2" />
                            Evaluate
                          </Button>
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {manuscript.spine_score && (
          <div className="mt-6 flex justify-center">
            <Button
              onClick={handleDownloadSpineReport}
              variant="outline"
              size="lg"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download Spine Report
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}