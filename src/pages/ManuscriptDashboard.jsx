import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Sparkles, Loader2, FileText, CheckCircle2, Circle, Download, Waves } from 'lucide-react';
import { toast } from "sonner";
import { createPageUrl } from '@/utils';
import BenchmarkComparisonModal from '@/components/BenchmarkComparisonModal';

export default function ManuscriptDashboard() {
  const [searchParams] = useSearchParams();
  const manuscriptId = searchParams.get('id');
  const [isEvaluatingSpine, setIsEvaluatingSpine] = useState(false);

  const { data: manuscript, isLoading: loadingManuscript } = useQuery({
    queryKey: ['manuscript', manuscriptId],
    queryFn: async () => {
      const results = await base44.entities.Manuscript.filter({ id: manuscriptId });
      return results[0];
    },
    enabled: !!manuscriptId
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
    
    reportText += `12 SPINE CRITERIA\n${'='.repeat(50)}\n\n`;
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

  const evaluatedChapters = chapters.filter(ch => ch.status === 'evaluated').length;
  const avgChapterScore = evaluatedChapters > 0
    ? chapters.reduce((sum, ch) => sum + (ch.evaluation_score || 0), 0) / evaluatedChapters
    : 0;

  const globalScore = manuscript.spine_score && evaluatedChapters > 0
    ? (0.5 * manuscript.spine_score + 0.5 * avgChapterScore)
    : manuscript.spine_score || avgChapterScore;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-slate-900">{manuscript.title}</h1>
            <div className="flex gap-2">
              {manuscript.spine_score && (
                <>
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
              <p className="text-sm text-slate-600 mt-1">Story + Craft: 12 Criteria + 60+ WAVE Checks</p>
            </CardHeader>
            <CardContent>
              <div className="text-6xl font-bold text-indigo-600 mb-4">
                {globalScore.toFixed(1)}/10
              </div>
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
                </div>
              </div>
              <Progress value={globalScore * 10} className="h-3 mt-4" />
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
                              window.location.href = createPageUrl(`Revise?sessionId=${session.id}`);
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