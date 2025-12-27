import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, BarChart3, Target, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from "framer-motion";
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

const SIGNAL_FAMILIES = {
  sentence_craft: { label: 'Sentence & Line Craft', color: 'from-blue-500 to-cyan-500' },
  dialogue: { label: 'Dialogue', color: 'from-purple-500 to-pink-500' },
  scene_structure: { label: 'Scene & Structure', color: 'from-emerald-500 to-teal-500' },
  character_voice: { label: 'Character Voice', color: 'from-amber-500 to-orange-500' },
  pacing_flow: { label: 'Pacing & Flow', color: 'from-rose-500 to-red-500' },
  emotional_beats: { label: 'Emotional Beats', color: 'from-indigo-500 to-purple-500' }
};

const ISSUE_CODE_LABELS = {
  FILTERING_LANGUAGE: { label: 'Filtering language overuse', family: 'sentence_craft' },
  WEAK_SCENE_EXIT: { label: 'Weak scene exits', family: 'scene_structure' },
  EXPOSITION_DIALOGUE: { label: 'Expository dialogue', family: 'dialogue' },
  WEAK_VERB_CLUSTERING: { label: 'Weak verb choices', family: 'sentence_craft' },
  PASSIVE_VOICE: { label: 'Passive voice overuse', family: 'sentence_craft' },
  ADVERB_OVERUSE: { label: 'Adverb reliance', family: 'sentence_craft' },
  TELLING_NOT_SHOWING: { label: 'Telling instead of showing', family: 'emotional_beats' },
  DIALOGUE_TAG_ISSUES: { label: 'Dialogue tag problems', family: 'dialogue' },
  SENTENCE_MONOTONY: { label: 'Monotonous sentence structure', family: 'sentence_craft' },
  PACING_DRAG: { label: 'Slow pacing sections', family: 'pacing_flow' }
};

export default function Progress() {
  const [timeRange, setTimeRange] = useState('all'); // all, 90, 30

  const { data: submissions, isLoading } = useQuery({
    queryKey: ['submissions'],
    queryFn: () => base44.entities.Submission.list('-created_date'),
    initialData: []
  });

  const { data: signals, isLoading: signalsLoading } = useQuery({
    queryKey: ['evaluationSignals'],
    queryFn: () => base44.entities.EvaluationSignal.list('-created_date'),
    initialData: []
  });

  // Filter by time range
  const getFilteredSignals = () => {
    if (timeRange === 'all') return signals;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(timeRange));
    return signals.filter(s => new Date(s.created_date) > cutoffDate);
  };

  const filteredSignals = getFilteredSignals();

  // Calculate overall trend
  const calculateTrend = (scores) => {
    if (scores.length < 2) return 'flat';
    const recent = scores.slice(0, Math.min(3, scores.length));
    const older = scores.slice(Math.min(3, scores.length));
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : recentAvg;
    const diff = recentAvg - olderAvg;
    if (diff > 0.3) return 'improving';
    if (diff < -0.3) return 'declining';
    return 'flat';
  };

  const overallScores = filteredSignals.map(s => s.overall_score * 10);
  const averageScore = overallScores.length > 0 
    ? (overallScores.reduce((a, b) => a + b, 0) / overallScores.length).toFixed(0)
    : 0;
  const trend = calculateTrend(overallScores);

  // Calculate signal family trends
  const signalFamilyTrends = {};
  Object.keys(SIGNAL_FAMILIES).forEach(family => {
    const scores = filteredSignals
      .map(s => s.signal_family_scores?.[family])
      .filter(score => score !== undefined && score !== null);
    if (scores.length > 0) {
      signalFamilyTrends[family] = {
        current: scores[0],
        trend: calculateTrend(scores),
        scores: scores.slice(0, 5).reverse()
      };
    }
  });

  // Calculate recurring patterns with time decay
  const calculateRecurringPatterns = () => {
    const issueFrequency = {};
    const now = new Date();
    
    filteredSignals.forEach((signal, index) => {
      const daysOld = (now - new Date(signal.created_date)) / (1000 * 60 * 60 * 24);
      const decayFactor = Math.max(0.3, 1 - (daysOld / 365)); // Decay over a year, min 30%
      
      signal.issue_codes?.forEach(issue => {
        if (!issueFrequency[issue.code]) {
          issueFrequency[issue.code] = {
            count: 0,
            recentCount: 0,
            severities: [],
            positions: []
          };
        }
        issueFrequency[issue.code].count += decayFactor;
        if (index < 10) issueFrequency[issue.code].recentCount++;
        issueFrequency[issue.code].severities.push(issue.severity);
        issueFrequency[issue.code].positions.push(index);
      });
    });

    return Object.entries(issueFrequency)
      .map(([code, data]) => ({
        code,
        frequency: data.count,
        recentCount: data.recentCount,
        trend: data.positions[0] < 5 ? 'persistent' : data.positions.length > 3 ? 'worsening' : 'improving',
        label: ISSUE_CODE_LABELS[code]?.label || code,
        family: ISSUE_CODE_LABELS[code]?.family || 'sentence_craft'
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10);
  };

  const recurringPatterns = calculateRecurringPatterns();

  // Calculate revision effectiveness
  const revisionDeltas = filteredSignals
    .filter(s => s.is_revision && s.original_signal_id)
    .map(revised => {
      const original = signals.find(s => s.id === revised.original_signal_id);
      if (!original) return null;
      
      const improvementsByFamily = {};
      Object.keys(SIGNAL_FAMILIES).forEach(family => {
        const originalScore = original.signal_family_scores?.[family] || 0;
        const revisedScore = revised.signal_family_scores?.[family] || 0;
        const delta = revisedScore - originalScore;
        if (Math.abs(delta) > 0.1) {
          improvementsByFamily[family] = delta;
        }
      });

      return {
        submissionId: revised.submission_id,
        overallDelta: (revised.overall_score - original.overall_score) * 10,
        improvementsByFamily
      };
    })
    .filter(Boolean);

  const getTrendIcon = (trend) => {
    if (trend === 'improving') return <TrendingUp className="w-5 h-5 text-emerald-500" />;
    if (trend === 'declining') return <TrendingDown className="w-5 h-5 text-rose-500" />;
    return <Minus className="w-5 h-5 text-slate-400" />;
  };

  const getTrendColor = (trend) => {
    if (trend === 'improving') return 'text-emerald-600 bg-emerald-50';
    if (trend === 'declining') return 'text-rose-600 bg-rose-50';
    return 'text-slate-600 bg-slate-50';
  };

  if (isLoading || signalsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-600">Loading your progress...</p>
        </div>
      </div>
    );
  }

  if (filteredSignals.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
        <div className="max-w-5xl mx-auto px-6 py-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">Editorial Progress</h1>
          <Card className="border-0 shadow-lg">
            <CardContent className="py-16 text-center">
              <BarChart3 className="w-16 h-16 mx-auto text-slate-300 mb-4" />
              <h3 className="text-xl font-semibold text-slate-800 mb-2">No Data Yet</h3>
              <p className="text-slate-600 mb-6">
                Complete a few evaluations to start tracking your editorial growth
              </p>
              <Link to={createPageUrl('Evaluate')}>
                <Button className="bg-gradient-to-r from-indigo-600 to-purple-600">
                  Start Your First Evaluation
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Editorial Progress</h1>
          <p className="text-slate-600">Track your growth and patterns over time</p>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-8">
          {[
            { value: '30', label: 'Last 30 Days' },
            { value: '90', label: 'Last 90 Days' },
            { value: 'all', label: 'All Time' }
          ].map(option => (
            <Button
              key={option.value}
              variant={timeRange === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeRange(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-6">
          {/* A. Progress Overview */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Progress Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-600 mb-1">Average Score</p>
                    <p className="text-5xl font-bold text-indigo-600">{averageScore}</p>
                  </div>
                  <div className={`px-4 py-3 rounded-xl ${getTrendColor(trend)}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {getTrendIcon(trend)}
                      <span className="font-semibold capitalize">{trend}</span>
                    </div>
                    <p className="text-xs">Based on {filteredSignals.length} evaluations</p>
                  </div>
                </div>
                <div className="mt-6 flex items-end gap-1 h-20">
                  {overallScores.slice(0, 10).reverse().map((score, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-indigo-500 rounded-t opacity-80 hover:opacity-100 transition-opacity"
                      style={{ height: `${(score / 100) * 100}%` }}
                      title={`Score: ${score.toFixed(0)}`}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* B. Signal Family Trends */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  Growth Signals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {Object.entries(signalFamilyTrends).map(([family, data]) => (
                    <div key={family} className="p-4 rounded-lg border border-slate-200 bg-white">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-medium text-slate-800">{SIGNAL_FAMILIES[family].label}</h4>
                          <p className="text-2xl font-bold text-slate-900 mt-1">
                            {(data.current * 10).toFixed(0)}
                          </p>
                        </div>
                        <div className={`p-2 rounded-lg ${getTrendColor(data.trend)}`}>
                          {getTrendIcon(data.trend)}
                        </div>
                      </div>
                      <div className="flex items-end gap-1 h-12">
                        {data.scores.map((score, i) => (
                          <div
                            key={i}
                            className={`flex-1 bg-gradient-to-t ${SIGNAL_FAMILIES[family].color} rounded-t`}
                            style={{ height: `${(score / 10) * 100}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* C. Recurring Focus Areas */}
          {recurringPatterns.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5 text-amber-600" />
                    Recurring Focus Areas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recurringPatterns.slice(0, 5).map((pattern, i) => (
                      <div key={i} className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-slate-900">{pattern.label}</h4>
                            <p className="text-sm text-slate-600 mt-1">
                              Appears in {pattern.recentCount} of last 10 submissions
                            </p>
                            <div className="mt-2">
                              <Badge variant="outline" className="text-xs">
                                {SIGNAL_FAMILIES[pattern.family]?.label}
                              </Badge>
                            </div>
                          </div>
                          <Badge className={`${getTrendColor(pattern.trend)} border-0`}>
                            {pattern.trend}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* D. Revision Effectiveness */}
          {revisionDeltas.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <Card className="border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-teal-50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                    Revision Effectiveness
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 mb-4">
                    When you apply feedback, your scores improve
                  </p>
                  {revisionDeltas.slice(0, 3).map((delta, i) => (
                    <div key={i} className="mb-4 p-4 rounded-lg bg-white border border-emerald-200">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-slate-600">Overall Improvement</span>
                        <span className={`text-2xl font-bold ${
                          delta.overallDelta > 0 ? 'text-emerald-600' : 'text-slate-600'
                        }`}>
                          {delta.overallDelta > 0 ? '+' : ''}{delta.overallDelta.toFixed(0)}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {Object.entries(delta.improvementsByFamily).map(([family, improvement]) => (
                          <div key={family} className="flex items-center justify-between text-sm">
                            <span className="text-slate-600">{SIGNAL_FAMILIES[family]?.label}</span>
                            <span className={improvement > 0 ? 'text-emerald-600 font-medium' : 'text-rose-600 font-medium'}>
                              {improvement > 0 ? '+' : ''}{(improvement * 10).toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}