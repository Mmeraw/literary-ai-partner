import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Download, AlertCircle, CheckCircle2, XCircle, Shield, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from "framer-motion";

export default function ResultsGoverned() {
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('projectId');

    const { data: evaluationResult, isLoading, error } = useQuery({
        queryKey: ['evaluationResult', projectId],
        queryFn: async () => {
            const response = await base44.functions.invoke('getEvaluationResultForUI', { projectId });
            return response.data.evaluationResult;
        },
        enabled: !!projectId,
        refetchOnWindowFocus: false
    });

    // LOADING STATE
    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50">
                <div className="max-w-7xl mx-auto px-6 py-12">
                    <div data-testid="results-loading-skeleton" className="space-y-6">
                        <div className="h-12 bg-slate-200 rounded-lg animate-pulse" />
                        <div className="h-32 bg-slate-200 rounded-lg animate-pulse" />
                        <div className="h-48 bg-slate-200 rounded-lg animate-pulse" />
                    </div>
                </div>
            </div>
        );
    }

    // ERROR STATE
    if (error || !evaluationResult) {
        return (
            <div className="min-h-screen bg-slate-50">
                <div className="max-w-4xl mx-auto px-6 py-12">
                    <Card data-testid="results-error-banner" className="border-red-300 bg-red-50">
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-4">
                                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                                <div className="flex-1">
                                    <h2 className="text-xl font-bold text-red-900 mb-2">Unable to load evaluation</h2>
                                    <p className="text-sm text-red-800 mb-4">
                                        Please try again. If the issue persists, contact support.
                                    </p>
                                    <div className="flex gap-3">
                                        <Button 
                                            data-testid="results-error-retry"
                                            onClick={() => window.location.reload()}
                                            className="bg-red-600 hover:bg-red-700"
                                        >
                                            Retry
                                        </Button>
                                        <Link to={createPageUrl('Dashboard')}>
                                            <Button data-testid="results-error-back" variant="outline">
                                                Back to Dashboard
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    const { source, summary, gates = [], assertions = [], artifacts, exports, legacy } = evaluationResult;
    const isGoverned = source === 'governed';
    const isLegacy = source === 'legacy';

    // FLAGS (read from config or default)
    const flags = {
        RG_UI_GOVERNED_ONLY: false, // Set true in production after migration
        RG_LEGACY_FALLBACK_ENABLED: true,
        RG_ELIGIBILITY_REQUIRE_GATES: true,
        RG_RESULTS_SHOW_GATES: true
    };

    // GOVERNED-ONLY ENFORCEMENT (STATE 5)
    if (flags.RG_UI_GOVERNED_ONLY && !isGoverned) {
        return (
            <div className="min-h-screen bg-slate-50">
                <div className="max-w-4xl mx-auto px-6 py-12">
                    <Card data-testid="governed-required-panel" className="border-amber-300 bg-amber-50">
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-4">
                                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0" />
                                <div className="flex-1">
                                    <h2 className="text-xl font-bold text-amber-900 mb-2">Governed Evaluation Required</h2>
                                    <p className="text-sm text-amber-800 mb-4">
                                        This result cannot be displayed as governed evidence. Please run a governed evaluation to produce gates and audit artifacts.
                                    </p>
                                    <div className="flex gap-3">
                                        <Button 
                                            data-testid="governed-required-run"
                                            onClick={async () => {
                                                await base44.functions.invoke('evaluateFullManuscript', { manuscript_id: projectId });
                                                window.location.reload();
                                            }}
                                            className="bg-amber-600 hover:bg-amber-700"
                                        >
                                            Run Governed Evaluation
                                        </Button>
                                        <Link to={createPageUrl('Dashboard')}>
                                            <Button data-testid="governed-required-back" variant="outline">
                                                Back to Dashboard
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // COMPUTE ELIGIBILITY (LOCKED LOGIC)
    const requiredGates = ['readiness', 'coverage', 'integrity'];
    const gateMap = new Map(gates.map(g => [g.gateType, g]));
    const hasAllRequiredGates = requiredGates.every(r => gateMap.has(r));
    const allRequiredGatesPass = requiredGates.every(r => gateMap.get(r)?.status === 'pass');
    
    const isEligible = flags.RG_ELIGIBILITY_REQUIRE_GATES 
        ? (isGoverned && hasAllRequiredGates && allRequiredGatesPass)
        : false;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="mb-8">
                    <Link to={createPageUrl('Dashboard')}>
                        <Button variant="ghost" className="mb-4">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Dashboard
                        </Button>
                    </Link>
                </div>

                {/* GOVERNANCE BANNER */}
                <Card 
                    data-testid="governance-banner"
                    className={`mb-6 ${isGoverned ? 'border-indigo-300 bg-indigo-50' : 'border-amber-300 bg-amber-50'}`}
                >
                    <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-3">
                                    {isGoverned ? (
                                        <>
                                            <Badge data-testid="banner-badge-governed" className="bg-indigo-600">GOVERNED</Badge>
                                            <Badge data-testid="banner-badge-readonly" variant="outline">READ-ONLY SCORE</Badge>
                                        </>
                                    ) : (
                                        <>
                                            <Badge data-testid="banner-badge-legacy" className="bg-amber-600">LEGACY</Badge>
                                            <Badge data-testid="banner-badge-unverified" variant="outline">UNVERIFIED</Badge>
                                        </>
                                    )}
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 mb-2">
                                    {isGoverned ? 'Governed Evaluation Run' : 'Legacy Result (Unverified)'}
                                </h3>
                                <p className="text-sm text-slate-700">
                                    {isGoverned 
                                        ? 'This result is audit-defensible and includes governance gates and assertions.'
                                        : 'This result is display-only and is not audit-defensible. Governance gates and eligibility are not available.'
                                    }
                                </p>
                                {evaluationResult.evaluationRunId && (
                                    <div className="mt-3 flex items-center gap-2">
                                        <span className="text-xs text-slate-600">Evaluation Run ID:</span>
                                        <code 
                                            data-testid="banner-evaluation-run-id"
                                            className="text-xs bg-white px-2 py-1 rounded border border-slate-200"
                                        >
                                            {evaluationResult.evaluationRunId}
                                        </code>
                                    </div>
                                )}
                            </div>
                            {isLegacy && (
                                <Button 
                                    data-testid="banner-rerun-governed"
                                    onClick={async () => {
                                        await base44.functions.invoke('evaluateFullManuscript', { manuscript_id: projectId });
                                        window.location.reload();
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-700"
                                >
                                    Re-run as Governed
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid lg:grid-cols-3 gap-6">
                    {/* SCORE & ELIGIBILITY */}
                    <div className="lg:col-span-2 space-y-6">
                        <Card data-testid="score-card">
                            <CardContent className="pt-6">
                                <div className="flex items-end justify-between mb-4">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 mb-1">Overall Score</h2>
                                        {isLegacy && (
                                            <Badge data-testid="legacy-unverified-tag" variant="outline" className="text-amber-600 border-amber-600">
                                                Legacy / Unverified
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="text-right">
                                        <span 
                                            data-testid="score-value"
                                            className={`text-5xl font-bold ${
                                                summary.overallScore >= 8.0 ? 'text-emerald-600' :
                                                summary.overallScore >= 6.0 ? 'text-amber-600' :
                                                'text-rose-600'
                                            }`}
                                        >
                                            {summary.overallScore?.toFixed(1)}
                                        </span>
                                        <span className="text-slate-400 text-xl">/10</span>
                                    </div>
                                </div>
                                <div data-testid="readiness-band" className="text-sm text-slate-600">
                                    Readiness: <strong>{summary.readinessBand}</strong>
                                </div>
                            </CardContent>
                        </Card>

                        {/* ELIGIBILITY BADGE */}
                        <Card data-testid="eligibility-badge">
                            <CardContent className="pt-6">
                                {isEligible ? (
                                    <div data-testid="eligibility-eligible" className="flex items-start gap-3">
                                        <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                                        <div>
                                            <h3 className="font-bold text-emerald-900 mb-1">StoryGate Eligible</h3>
                                            <p className="text-sm text-emerald-700">All required gates passed.</p>
                                            <div className="mt-3 space-y-1 text-xs text-emerald-600">
                                                <div>✓ Readiness: PASS (≥ 8.0)</div>
                                                <div>✓ Coverage: PASS (≥ 85%)</div>
                                                <div>✓ Integrity: PASS</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div data-testid="eligibility-not-eligible" className="flex items-start gap-3">
                                        <XCircle className="w-6 h-6 text-slate-400 flex-shrink-0" />
                                        <div>
                                            <h3 className="font-bold text-slate-900 mb-1">Not Eligible</h3>
                                            <p className="text-sm text-slate-600">
                                                {isLegacy 
                                                    ? 'Eligibility requires governed gates. Legacy results cannot qualify.'
                                                    : 'Eligibility requires passing all required gates.'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* GOVERNANCE GATES */}
                        {flags.RG_RESULTS_SHOW_GATES && (
                            <Card data-testid="gate-panel">
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Shield className="w-5 h-5" />
                                        Governance Gates
                                    </CardTitle>
                                    <p className="text-sm text-slate-600">
                                        Eligibility is determined only by governed gate outcomes.
                                    </p>
                                </CardHeader>
                                <CardContent>
                                    {gates.length === 0 ? (
                                        <div data-testid="gate-empty" className="text-center py-8">
                                            <Lock className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                                            <p className="font-semibold text-slate-700 mb-1">Gates Not Available</p>
                                            <p className="text-sm text-slate-500">
                                                This result is legacy display-only. Run a governed evaluation to generate gate evidence.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {gates.map((gate, idx) => (
                                                <div 
                                                    key={idx}
                                                    data-testid={`gate-${gate.gateType}`}
                                                    className={`p-4 rounded-lg border-2 ${
                                                        gate.status === 'pass' 
                                                            ? 'bg-emerald-50 border-emerald-300' 
                                                            : 'bg-red-50 border-red-300'
                                                    }`}
                                                >
                                                    <div className="flex items-start justify-between mb-2">
                                                        <h4 className="font-semibold text-slate-900">
                                                            {gate.gateType === 'readiness' && 'Readiness Gate'}
                                                            {gate.gateType === 'coverage' && 'Coverage Gate'}
                                                            {gate.gateType === 'integrity' && 'Integrity Gate'}
                                                        </h4>
                                                        <Badge 
                                                            data-testid={`gate-status-${gate.status.toUpperCase()}`}
                                                            className={gate.status === 'pass' ? 'bg-emerald-600' : 'bg-red-600'}
                                                        >
                                                            {gate.status.toUpperCase()}
                                                        </Badge>
                                                    </div>
                                                    <div className="space-y-2 text-sm">
                                                        {gate.threshold !== null && (
                                                            <div data-testid="gate-threshold" className="flex justify-between">
                                                                <span className="text-slate-600">Threshold:</span>
                                                                <span className="font-medium">{gate.threshold}</span>
                                                            </div>
                                                        )}
                                                        {gate.observed !== null && (
                                                            <div data-testid="gate-observed" className="flex justify-between">
                                                                <span className="text-slate-600">Observed:</span>
                                                                <span className="font-medium">{gate.observed}</span>
                                                            </div>
                                                        )}
                                                        {gate.reasons && gate.reasons.length > 0 && (
                                                            <div data-testid="gate-reasons" className="mt-2">
                                                                <span className="text-slate-600 text-xs font-medium">Reasons:</span>
                                                                <ul className="mt-1 space-y-1">
                                                                    {gate.reasons.map((reason, i) => (
                                                                        <li key={i} className="text-xs text-slate-700">• {reason}</li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}

                        {/* ASSERTIONS PANEL */}
                        <Card data-testid="assertions-panel">
                            <CardHeader>
                                <CardTitle>Governance Assertions</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {assertions.length === 0 ? (
                                    <div data-testid="assertions-empty" className="text-center py-6">
                                        <p className="text-sm text-slate-500">
                                            Legacy results do not include governance assertions.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {assertions.map((assertion, idx) => (
                                            <div 
                                                key={idx}
                                                data-testid={`assertion-${assertion.code}`}
                                                className="flex items-start gap-2 text-sm"
                                            >
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="font-medium text-slate-900">{assertion.code}</span>
                                                    <p className="text-slate-600">{assertion.detail}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* ARTIFACTS */}
                        <Card data-testid="artifacts-section">
                            <CardHeader>
                                <CardTitle>Evaluation Artifacts</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLegacy ? (
                                    <div data-testid="legacy-artifacts-placeholder" className="text-center py-6">
                                        <p className="text-sm text-slate-500 mb-2">Governed Artifacts Not Available</p>
                                        <p className="text-xs text-slate-400">
                                            Legacy results do not include segment evidence or governed synthesis.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="font-semibold text-slate-900 mb-2">Spine Synthesis</h4>
                                            {artifacts?.spineSynthesis ? (
                                                <div className="space-y-2">
                                                    {artifacts.spineSynthesis.sections?.map((section, idx) => (
                                                        <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-200">
                                                            <h5 className="font-medium text-sm text-slate-800">{section.title}</h5>
                                                            <p className="text-xs text-slate-600 mt-1">{section.text}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-500">No synthesis available</p>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-slate-900 mb-2">Segment Evidence</h4>
                                            {artifacts?.segmentEvidence && artifacts.segmentEvidence.length > 0 ? (
                                                <div className="text-sm text-slate-600">
                                                    {artifacts.segmentEvidence.length} segment(s) evaluated
                                                </div>
                                            ) : (
                                                <p className="text-sm text-slate-500">No segment evidence</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* SIDEBAR: EXPORTS */}
                    <div className="lg:col-span-1">
                        <Card data-testid="exports-card">
                            <CardHeader>
                                <CardTitle>Exports</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {exports?.pdfUrl || exports?.txtUrl ? (
                                    <div className="space-y-2">
                                        {exports.pdfUrl && (
                                            <Button data-testid="export-link-pdf" variant="outline" className="w-full">
                                                <Download className="w-4 h-4 mr-2" />
                                                Download PDF
                                            </Button>
                                        )}
                                        {exports.txtUrl && (
                                            <Button data-testid="export-link-txt" variant="outline" className="w-full">
                                                <Download className="w-4 h-4 mr-2" />
                                                Download TXT
                                            </Button>
                                        )}
                                        {isLegacy && (
                                            <p data-testid="exports-legacy-disclaimer" className="text-xs text-amber-600 mt-3">
                                                Exports from legacy results are not audit-defensible.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-slate-500">No exports available</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}