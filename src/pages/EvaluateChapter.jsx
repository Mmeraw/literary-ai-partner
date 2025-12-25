import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { toast } from "sonner";
import { createPageUrl } from '@/utils';

export default function EvaluateChapter() {
  const [searchParams] = useSearchParams();
  const chapterId = searchParams.get('id');
  const [isEvaluating, setIsEvaluating] = useState(false);

  const { data: chapter, isLoading } = useQuery({
    queryKey: ['chapter', chapterId],
    queryFn: async () => {
      const results = await base44.entities.Chapter.filter({ id: chapterId });
      return results[0];
    },
    enabled: !!chapterId
  });

  const handleEvaluate = async () => {
    if (!chapter) return;

    setIsEvaluating(true);

    try {
      toast.info('Evaluating chapter... this may take 20-30 seconds');

      // Use existing evaluation logic (adapted from Evaluate page)
      const agentAnalysis = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a senior literary agent evaluating a manuscript chapter. Analyze this chapter against exactly these 12 criteria, rating each 1-10:

1. The Hook
2. Voice & Narrative Style
3. Characters & Introductions
4. Conflict & Tension
5. Thematic Resonance
6. Pacing & Structural Flow
7. Dialogue & Subtext
8. Worldbuilding & Immersion
9. Stakes & Emotional Investment
10. Line-Level Polish
11. Marketability & Genre Fit
12. Would Agent Keep Reading

CHAPTER: ${chapter.title}

TEXT:
${chapter.text}

For each criterion provide: score (1-10), strengths (array), weaknesses (array), notes (detailed commentary).
Provide overall score (1-10) and verdict.`,
        response_json_schema: {
          type: "object",
          properties: {
            overallScore: { type: "number" },
            verdict: { type: "string" },
            criteria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  score: { type: "number" },
                  strengths: { type: "array", items: { type: "string" } },
                  weaknesses: { type: "array", items: { type: "string" } },
                  notes: { type: "string" }
                },
                required: ["name", "score", "strengths", "weaknesses", "notes"]
              }
            }
          },
          required: ["overallScore", "verdict", "criteria"]
        }
      });

      // Update chapter with evaluation
      await base44.entities.Chapter.update(chapterId, {
        evaluation_score: agentAnalysis.overallScore,
        evaluation_result: agentAnalysis,
        status: 'evaluated'
      });

      toast.success('Chapter evaluation complete!');
      window.location.href = createPageUrl(`ChapterReport?id=${chapterId}`);

    } catch (error) {
      console.error('Evaluation error:', error);
      toast.error('Chapter evaluation failed');
      setIsEvaluating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-6">
          <p className="text-slate-600">Chapter not found</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link to={createPageUrl(`ManuscriptDashboard?id=${chapter.manuscript_id}`)}>
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Manuscript
          </Button>
        </Link>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">{chapter.title}</h1>
          <p className="text-slate-600">{chapter.word_count.toLocaleString()} words</p>
        </div>

        <Card className="border-0 shadow-lg mb-6">
          <div className="p-6">
            <div className="prose prose-slate max-w-none">
              <div className="whitespace-pre-wrap text-slate-700 font-serif leading-relaxed">
                {chapter.text}
              </div>
            </div>
          </div>
        </Card>

        <div className="flex justify-center">
          <Button
            onClick={handleEvaluate}
            disabled={isEvaluating}
            size="lg"
            className="h-14 px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
          >
            {isEvaluating ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Evaluating Chapter...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5 mr-2" />
                Evaluate This Chapter
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}