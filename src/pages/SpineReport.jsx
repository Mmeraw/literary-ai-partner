import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, BookOpen } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function SpineReport() {
  const [searchParams] = useSearchParams();
  const manuscriptId = searchParams.get('id');

  const { data: manuscript, isLoading } = useQuery({
    queryKey: ['manuscript', manuscriptId],
    queryFn: async () => {
      const results = await base44.entities.Manuscript.filter({ id: manuscriptId });
      return results[0];
    },
    enabled: !!manuscriptId
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!manuscript || !manuscript.spine_evaluation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-slate-600">Spine evaluation not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const evaluation = manuscript.spine_evaluation;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <Link to={createPageUrl(`ManuscriptDashboard?id=${manuscriptId}`)}>
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{manuscript.title}</h1>
              <p className="text-slate-600">Spine Evaluation Report</p>
            </div>
          </div>
        </div>

        {/* Overall Score */}
        <Card className="border-0 shadow-lg mb-6 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">Overall Spine Score</h3>
                <p className="text-sm text-slate-600">{evaluation.verdict}</p>
              </div>
              <div className="text-5xl font-bold text-indigo-600">
                {evaluation.overallScore}/10
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Major Strengths */}
        {evaluation.majorStrengths?.length > 0 && (
          <Card className="border-0 shadow-lg mb-6 bg-gradient-to-br from-emerald-50 to-green-50">
            <CardHeader>
              <CardTitle className="text-lg">Major Strengths</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {evaluation.majorStrengths.map((strength, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-700">
                    <span className="text-emerald-600 font-bold">✓</span>
                    {strength}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Critical Weaknesses */}
        {evaluation.criticalWeaknesses?.length > 0 && (
          <Card className="border-0 shadow-lg mb-6 bg-gradient-to-br from-rose-50 to-red-50">
            <CardHeader>
              <CardTitle className="text-lg">Critical Weaknesses</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {evaluation.criticalWeaknesses.map((weakness, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-slate-700">
                    <span className="text-rose-600 font-bold">✗</span>
                    {weakness}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Detailed Criteria */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900">12 Spine Criteria</h2>
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