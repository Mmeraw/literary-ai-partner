import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Target, Zap } from 'lucide-react';

export default function RevisionInsights({ session }) {
  if (!session || !session.suggestions) return null;

  const totalSuggestions = session.suggestions.length;
  const accepted = session.suggestions.filter(s => s.status === 'accepted').length;
  const rejected = session.suggestions.filter(s => s.status === 'rejected').length;
  const acceptanceRate = totalSuggestions > 0 ? Math.round((accepted / totalSuggestions) * 100) : 0;

  // Calculate positive feedback rate
  const suggestionsWithFeedback = session.suggestions.filter(s => s.feedback?.helpful !== undefined);
  const positiveFeedback = suggestionsWithFeedback.filter(s => s.feedback?.helpful === true).length;
  const feedbackRate = suggestionsWithFeedback.length > 0 
    ? Math.round((positiveFeedback / suggestionsWithFeedback.length) * 100) 
    : 0;

  const insights = [
    {
      label: 'Acceptance Rate',
      value: `${acceptanceRate}%`,
      icon: Target,
      color: acceptanceRate >= 70 ? 'text-green-600' : acceptanceRate >= 50 ? 'text-amber-600' : 'text-slate-600'
    },
    {
      label: 'Suggestions Applied',
      value: `${accepted}/${totalSuggestions}`,
      icon: Zap,
      color: 'text-indigo-600'
    },
    {
      label: 'Helpful Rating',
      value: suggestionsWithFeedback.length > 0 ? `${feedbackRate}%` : 'N/A',
      icon: TrendingUp,
      color: feedbackRate >= 70 ? 'text-green-600' : 'text-slate-600'
    }
  ];

  return (
    <Card className="bg-white border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-indigo-600" />
          Revision Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          {insights.map((insight, idx) => (
            <div key={idx} className="text-center">
              <div className="flex items-center justify-center mb-1">
                <insight.icon className={`w-4 h-4 ${insight.color}`} />
              </div>
              <div className={`text-xl font-bold ${insight.color}`}>
                {insight.value}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {insight.label}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}