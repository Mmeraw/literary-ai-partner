import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Sparkles, Loader2, FileText, CheckCircle2, Circle, Download } from 'lucide-react';
import { toast } from "sonner";
import { createPageUrl } from '@/utils';

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

  const handleDownloadSpineReport = () => {
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
  const avgChapterScore = chapters.length > 0
    ? chapters.reduce((sum, ch) => sum + (ch.evaluation_score || 0), 0) / chapters.length
    : 0;

  const globalScore = manuscript.spine_score
    ? (0.5 * manuscript.spine_score + 0.5 * avgChapterScore)
    : avgChapterScore;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-slate-900">{manuscript.title}</h1>
            {manuscript.spine_score && (
              <Button
                onClick={handleDownloadSpineReport}
                variant="outline"
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Download Spine Report
              </Button>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600">
            <span>{manuscript.word_count.toLocaleString()} words</span>
            <span>•</span>
            <span>{chapters.length} chapters</span>
            <span>•</span>
            <span>{evaluatedChapters} evaluated</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          {/* Global Score */}
          <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50">
            <CardHeader>
              <CardTitle className="text-lg">Overall RevisionGrade™</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-indigo-600 mb-2">
                {globalScore.toFixed(1)}/10
              </div>
              <Progress value={globalScore * 10} className="h-2" />
            </CardContent>
          </Card>

          {/* Spine Score */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Whole-Manuscript (Spine) Evaluation
              </CardTitle>
              <p className="text-xs text-slate-500 mt-1">12 Agent Criteria</p>
            </CardHeader>
            <CardContent>
              {manuscript.spine_score ? (
                <>
                  <div className="text-3xl font-bold text-slate-900 mb-2">
                    {manuscript.spine_score.toFixed(1)}/10
                  </div>
                  <Link to={createPageUrl(`SpineReport?id=${manuscriptId}`)}>
                    <Button variant="outline" size="sm" className="w-full">
                      View Full Report
                    </Button>
                  </Link>
                </>
              ) : (
                <Button
                  onClick={handleSpineEvaluation}
                  disabled={isEvaluatingSpine}
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                  {isEvaluatingSpine ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Evaluate Spine
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Chapter Progress */}
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-lg">Chapter Progress</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Evaluate chapters to update your Overall RevisionGrade™</p>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900 mb-2">
                {evaluatedChapters}/{chapters.length}
              </div>
              <Progress value={(evaluatedChapters / chapters.length) * 100} className="h-2" />
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
                        <Link to={createPageUrl(`ChapterReport?id=${chapter.id}`)}>
                          <Button variant="outline" size="sm">
                            View Report
                          </Button>
                        </Link>
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