import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, FileText, Download, BookOpen, Waves } from 'lucide-react';
import { toast } from "sonner";
import { createPageUrl } from '@/utils';

export default function ChapterReport() {
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get('id');

  const { data: chapter, isLoading } = useQuery({
    queryKey: ['chapter', chapterId],
    queryFn: async () => {
      const results = await base44.entities.Chapter.filter({ id: chapterId });
      return results[0];
    },
    enabled: !!chapterId
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!chapter || !chapter.evaluation_result) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-slate-600">Chapter evaluation not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const evaluation = chapter.evaluation_result;

  const handleDownloadClean = () => {
    const blob = new Blob([chapter.text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(chapter.title || 'chapter').replace(/\s+/g, '_')}_clean.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Chapter downloaded');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link to={createPageUrl(`ManuscriptDashboard?id=${chapter.manuscript_id}`)}>
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Manuscript
          </Button>
        </Link>

        <div className="mb-8">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">{chapter.title}</h1>
                <p className="text-slate-600">Chapter Evaluation Report</p>
              </div>
            </div>
            <Button onClick={handleDownloadClean} className="bg-indigo-600 hover:bg-indigo-700">
              <Download className="w-4 h-4 mr-2" />
              Download Clean Chapter
            </Button>
          </div>
        </div>

        {/* Overall Score */}
        <Card className="border-0 shadow-lg mb-6 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">Overall Quality Score</h3>
                <p className="text-sm text-slate-600">Story + Craft Combined</p>
              </div>
              <div className="text-5xl font-bold text-indigo-600">
                {evaluation.combinedScore?.toFixed(1) || evaluation.overallScore}/10
              </div>
            </div>
            <p className="text-slate-700 mb-4">{evaluation.verdict}</p>
            {evaluation.agentScore && evaluation.waveScore && (
              <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                <div>
                  <div className="flex items-center gap-1 text-xs text-slate-600 mb-1">
                    <BookOpen className="w-3 h-3" />
                    <span>Story (12 Criteria)</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{evaluation.agentScore.toFixed(1)}/10</div>
                </div>
                <div>
                  <div className="flex items-center gap-1 text-xs text-slate-600 mb-1">
                    <Waves className="w-3 h-3" />
                    <span>Craft (WAVE)</span>
                  </div>
                  <div className="text-2xl font-bold text-slate-800">{evaluation.waveScore.toFixed(1)}/10</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Criteria */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">12 Literary Agent Criteria</h2>
          {evaluation.criteria?.map((criterion, idx) => (
            <Card key={idx} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{criterion.name}</CardTitle>
                  <Badge className={
                    criterion.score >= 9 ? 'bg-emerald-100 text-emerald-700' :
                    criterion.score >= 7 ? 'bg-amber-100 text-amber-700' :
                    'bg-rose-100 text-rose-700'
                  }>
                    {criterion.score}/10
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {criterion.strengths?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-emerald-600 mb-2">Strengths</h4>
                    <ul className="space-y-1">
                      {criterion.strengths.map((s, i) => (
                        <li key={i} className="text-sm text-slate-600">• {s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {criterion.weaknesses?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-rose-600 mb-2">Weaknesses</h4>
                    <ul className="space-y-1">
                      {criterion.weaknesses.map((w, i) => (
                        <li key={i} className="text-sm text-slate-600">• {w}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {criterion.notes && (
                  <div>
                    <h4 className="text-sm font-semibold text-indigo-600 mb-2">Notes</h4>
                    <p className="text-sm text-slate-700">{criterion.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* WAVE Revision Analysis */}
        {evaluation.waveAnalysis && (
          <div className="space-y-4 mt-8">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Waves className="w-6 h-6 text-purple-600" />
                WAVE Revision Analysis
              </h3>
              <Badge className="bg-purple-100 text-purple-700">
                {evaluation.waveAnalysis.waveHits?.length || 0} Issues Found
              </Badge>
            </div>

            {/* Strength Areas */}
            {evaluation.waveAnalysis.strengthAreas?.length > 0 && (
              <Card className="border-0 shadow-md bg-emerald-50">
                <CardHeader>
                  <CardTitle className="text-lg text-emerald-900">Craft Strengths</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {evaluation.waveAnalysis.strengthAreas.map((strength, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-emerald-800">
                        <span className="text-emerald-600 font-bold mt-1">✓</span>
                        <span>{strength}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Critical Issues */}
            {evaluation.waveAnalysis.criticalIssues?.length > 0 && (
              <Card className="border-0 shadow-md bg-amber-50">
                <CardHeader>
                  <CardTitle className="text-lg text-amber-900">Critical Craft Issues</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {evaluation.waveAnalysis.criticalIssues.map((issue, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-amber-800">
                        <span className="text-amber-600 font-bold mt-1">!</span>
                        <span>{issue}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* WAVE Hits Details */}
            {evaluation.waveAnalysis.waveHits?.map((hit, idx) => (
              <Card key={idx} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{hit.category}</CardTitle>
                      <p className="text-sm text-slate-600 mt-1">{hit.description}</p>
                    </div>
                    <Badge className={
                      hit.severity === 'High' ? 'bg-red-100 text-red-700' :
                      hit.severity === 'Medium' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }>
                      {hit.severity}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="text-sm font-medium text-slate-600">Example:</span>
                    <p className="text-sm text-slate-700 italic mt-1 p-2 bg-slate-50 rounded border border-slate-200">
                      "{hit.example_quote}"
                    </p>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-indigo-600">Fix Suggestion:</span>
                    <p className="text-sm text-slate-700 mt-1">{hit.fix_suggestion}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}