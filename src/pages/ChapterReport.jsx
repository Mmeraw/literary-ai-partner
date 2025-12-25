import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, FileText } from 'lucide-react';
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
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{chapter.title}</h1>
              <p className="text-slate-600">Chapter Evaluation Report</p>
            </div>
          </div>
        </div>

        {/* Overall Score */}
        <Card className="border-0 shadow-lg mb-6 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">Chapter Score</h3>
                <p className="text-sm text-slate-600">{evaluation.verdict}</p>
              </div>
              <div className="text-5xl font-bold text-indigo-600">
                {evaluation.overallScore}/10
              </div>
            </div>
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
      </div>
    </div>
  );
}