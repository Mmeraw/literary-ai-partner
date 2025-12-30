import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Info, CheckCircle } from 'lucide-react';

export default function TransgressiveRiskPanel({ transgressiveAnalysis, marketPath }) {
    if (!transgressiveAnalysis) return null;

    const { dimensions, intent_detection, risk_flags } = transgressiveAnalysis;

    const getSeverityConfig = (severity) => {
        switch (severity) {
            case 'blocker':
                return { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
            case 'warn':
                return { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' };
            default:
                return { icon: Info, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
        }
    };

    const getIntentClassification = (classification) => {
        switch (classification) {
            case 'transgressive_craft':
                return { label: 'Transgressive Craft', color: 'bg-green-100 text-green-800', icon: CheckCircle };
            case 'mixed':
                return { label: 'Mixed Intent', color: 'bg-amber-100 text-amber-800', icon: AlertTriangle };
            case 'high_liability':
                return { label: 'High Liability', color: 'bg-red-100 text-red-800', icon: AlertTriangle };
            default:
                return { label: 'Unknown', color: 'bg-slate-100 text-slate-800', icon: Info };
        }
    };

    const intentClass = getIntentClassification(intent_detection?.classification);
    const IntentIcon = intentClass.icon;

    return (
        <div className="space-y-6">
            {/* Intent Detection Summary */}
            <Card className="border-0 shadow-lg">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <IntentIcon className="w-5 h-5" />
                        Intent & Control Analysis
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Classification</span>
                        <Badge className={intentClass.color}>
                            {intentClass.label}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Intent Likelihood</span>
                        <div className="flex items-center gap-2">
                            <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-purple-600 transition-all"
                                    style={{ width: `${intent_detection?.intent_likelihood || 0}%` }}
                                />
                            </div>
                            <span className="text-sm font-semibold text-slate-700">
                                {intent_detection?.intent_likelihood || 0}%
                            </span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Transgressive Dimensions */}
            {dimensions && (
                <Card className="border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-lg">Craft Dimensions</CardTitle>
                        <p className="text-xs text-slate-500 mt-1">
                            These evaluate effectiveness, not appropriateness
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {Object.entries(dimensions).map(([key, score]) => {
                                const label = key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                                const scoreColor = score >= 8 ? 'text-green-600' :
                                                 score >= 6 ? 'text-amber-600' :
                                                 'text-red-600';
                                return (
                                    <div key={key} className="flex items-center justify-between">
                                        <span className="text-sm text-slate-700">{label}</span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full transition-all ${
                                                        score >= 8 ? 'bg-green-600' :
                                                        score >= 6 ? 'bg-amber-600' :
                                                        'bg-red-600'
                                                    }`}
                                                    style={{ width: `${(score / 10) * 100}%` }}
                                                />
                                            </div>
                                            <span className={`text-sm font-semibold ${scoreColor} w-8 text-right`}>
                                                {score.toFixed(1)}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Risk & Market Notes */}
            {risk_flags && risk_flags.length > 0 && (
                <Card className="border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-lg">Risk & Market Notes (Informational)</CardTitle>
                        <p className="text-xs text-slate-500 mt-1">
                            These notes don't change your score. They highlight potential agent, retailer, 
                            or platform friction points and ways to preserve impact while reducing avoidable 
                            rejection triggers.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {risk_flags.map((flag, idx) => {
                                const config = getSeverityConfig(flag.severity);
                                const Icon = config.icon;
                                return (
                                    <div 
                                        key={idx}
                                        className={`p-3 rounded-lg border ${config.border} ${config.bg}`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <Icon className={`w-4 h-4 ${config.color} mt-0.5 flex-shrink-0`} />
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="outline" className="text-xs">
                                                        {flag.code}
                                                    </Badge>
                                                    <Badge variant="outline" className="text-xs">
                                                        {flag.severity}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-slate-700">
                                                    {flag.message}
                                                </p>
                                                {flag.craft_vs_risk && (
                                                    <p className="text-xs text-slate-600 italic">
                                                        {flag.craft_vs_risk}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Market Path Context */}
            <Card className="border-0 shadow-lg bg-slate-50">
                <CardContent className="p-4">
                    <p className="text-xs text-slate-600">
                        <strong>Market Path: {marketPath || 'mainstream_agent_ready'}</strong>
                        {marketPath === 'transgressive_niche' ? (
                            <> — Risk notes calibrated for transgressive fiction market (literary horror, extreme noir, transgressive lit).</>
                        ) : marketPath === 'literary_extreme' ? (
                            <> — Risk notes calibrated for literary extreme market (independent/small press, niche audiences).</>
                        ) : (
                            <> — Risk notes calibrated for mainstream commercial market. Consider "transgressive_niche" for less restrictive guidance.</>
                        )}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}