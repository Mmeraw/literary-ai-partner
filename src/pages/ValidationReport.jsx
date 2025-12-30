import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, TrendingUp, FileCheck } from 'lucide-react';
import { toast } from "sonner";

export default function ValidationReport() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);

  const handleRunValidation = async () => {
    setLoading(true);
    toast.loading('Running gold standard validation...', { id: 'validation' });

    try {
      const response = await base44.functions.invoke('validateGoldStandard', {});
      setResults(response.data);
      toast.success('Validation complete!', { id: 'validation' });
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Validation failed', { id: 'validation' });
    } finally {
      setLoading(false);
    }
  };

  const getAccuracyColor = (accuracy) => {
    const pct = parseFloat(accuracy);
    if (pct >= 95) return 'text-emerald-600';
    if (pct >= 85) return 'text-amber-600';
    return 'text-red-600';
  };

  const getAccuracyBadge = (accuracy) => {
    const pct = parseFloat(accuracy);
    if (pct >= 95) return 'bg-emerald-100 text-emerald-700';
    if (pct >= 85) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Gold Standard Validation</h1>
          <p className="text-slate-600">
            Test Base44's voice/register behavior against labeled training set (Batches 1-7)
          </p>
        </div>

        {!results && (
          <Card className="border-0 shadow-lg">
            <CardContent className="p-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-4">
                <FileCheck className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 mb-2">
                Ready to Validate
              </h2>
              <p className="text-slate-600 mb-6 max-w-md mx-auto">
                This will test the current system against {'{'}gold_bundle_examples{'}'} labeled examples covering register detection, severity calibration, and action classification.
              </p>
              <Button
                onClick={handleRunValidation}
                disabled={loading}
                size="lg"
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Running Validation...
                  </>
                ) : (
                  'Run Validation'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {results && (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="text-sm text-slate-600 mb-1">Total Examples</div>
                  <div className="text-3xl font-bold text-slate-900">{results.total_examples}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-sm text-slate-600 mb-1">Gold Issues</div>
                  <div className="text-3xl font-bold text-slate-900">{results.total_gold_issues}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-sm text-slate-600 mb-1">Comparisons</div>
                  <div className="text-3xl font-bold text-slate-900">{results.comparisons.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6">
                  <div className="text-sm text-slate-600 mb-1">Bundle ID</div>
                  <div className="text-lg font-semibold text-indigo-600">{results.gold_bundle_id}</div>
                </CardContent>
              </Card>
            </div>

            {/* Overall Accuracy */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  Overall Accuracy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-4 gap-6">
                  <div>
                    <div className="text-sm text-slate-600 mb-2">Label Accuracy</div>
                    <div className={`text-4xl font-bold ${getAccuracyColor(results.metrics.overall.label_accuracy)}`}>
                      {results.metrics.overall.label_accuracy}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600 mb-2">Severity Accuracy</div>
                    <div className={`text-4xl font-bold ${getAccuracyColor(results.metrics.overall.severity_accuracy)}`}>
                      {results.metrics.overall.severity_accuracy}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600 mb-2">Action Accuracy</div>
                    <div className={`text-4xl font-bold ${getAccuracyColor(results.metrics.overall.action_accuracy)}`}>
                      {results.metrics.overall.action_accuracy}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-slate-600 mb-2">TP/FP Accuracy</div>
                    <div className={`text-4xl font-bold ${getAccuracyColor(results.metrics.overall.tp_fp_accuracy)}`}>
                      {results.metrics.overall.tp_fp_accuracy}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* By Register */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Accuracy by Register</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(results.metrics.by_register).map(([register, stats]) => (
                    <div key={register} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-900">{register}</span>
                        <Badge variant="outline">{stats.total} examples</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600">Label: </span>
                          <Badge className={getAccuracyBadge(stats.label_accuracy)}>
                            {stats.label_accuracy}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-slate-600">TP/FP: </span>
                          <Badge className={getAccuracyBadge(stats.tp_accuracy)}>
                            {stats.tp_accuracy}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* By Register Lock */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Accuracy by Register Lock</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(results.metrics.by_register_lock).map(([lock, stats]) => (
                    <div key={lock} className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-slate-900">{lock}</span>
                        <Badge variant="outline">{stats.total} examples</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600">Label: </span>
                          <Badge className={getAccuracyBadge(stats.label_accuracy)}>
                            {stats.label_accuracy}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-slate-600">Severity: </span>
                          <Badge className={getAccuracyBadge(stats.severity_accuracy)}>
                            {stats.severity_accuracy}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Mismatches */}
            {results.metrics.top_mismatches.length > 0 && (
              <Card className="border-0 shadow-lg border-amber-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600" />
                    Top Mismatches ({results.metrics.top_mismatches.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {results.metrics.top_mismatches.map((mismatch, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                        <div className="flex items-start justify-between mb-1">
                          <span className="font-mono text-xs text-slate-600">{mismatch.example_id}</span>
                          <Badge className="bg-amber-100 text-amber-800">{mismatch.mismatch_type}</Badge>
                        </div>
                        <div className="text-slate-700">
                          <strong>{mismatch.wave_item}</strong> • {mismatch.register}/{mismatch.register_lock}
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                          <div>
                            <span className="text-slate-500">Gold: </span>
                            <span className="font-medium">{mismatch.gold_label} ({mismatch.gold_severity})</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Base44: </span>
                            <span className="font-medium">{mismatch.base44_label} ({mismatch.base44_severity})</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Pass Criteria Assessment */}
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <CardTitle>Pass Criteria (v1)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                    <span className="text-sm font-medium">Hard-locked dialogue: ≥95% label + severity</span>
                    {results.metrics.by_register_lock.hard?.label_accuracy >= '95.0%' &&
                     results.metrics.by_register_lock.hard?.severity_accuracy >= '95.0%' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                    <span className="text-sm font-medium">Neutral narration: ≥85% TP + severity (high/medium)</span>
                    {results.metrics.by_register.neutral_narration?.tp_accuracy >= '85.0%' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-amber-600" />
                    )}
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                    <span className="text-sm font-medium">Market-risk: Must be MARKET_RISK_REVIEW (no auto-sanitize)</span>
                    <Badge className="bg-slate-200 text-slate-700">Manual Review</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <Button
                onClick={handleRunValidation}
                variant="outline"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Re-running...
                  </>
                ) : (
                  'Re-run Validation'
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}