import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ArrowRight, BookOpen, Award } from 'lucide-react';
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

import TextEditor from '@/components/submission/TextEditor';
import ProgressTracker from '@/components/evaluation/ProgressTracker';
import ScoreCard from '@/components/evaluation/ScoreCard';
import SuggestionCard from '@/components/evaluation/SuggestionCard';
import CriteriaPanel from '@/components/evaluation/CriteriaPanel';
import FinalOutput from '@/components/evaluation/FinalOutput';

const LITERARY_CRITERIA = [
    "the_hook", "voice_narrative_style", "characters_introductions", "conflict_tension",
    "thematic_resonance", "pacing_structural_flow", "dialogue_subtext", "worldbuilding_immersion",
    "stakes_emotional_investment", "line_level_polish", "marketability_genre_fit", "agent_keep_reading"
];

const WAVE_CRITERIA = [
    "sentence_variety", "word_economy", "sensory_details", "active_voice",
    "verb_strength", "adverb_reduction", "dialogue_tags", "beat_placement",
    "scene_structure", "transition_flow", "tension_maintenance", "emotional_beats",
    "character_voice", "internal_monologue", "description_balance", "pacing_rhythm"
];

export default function Evaluate() {
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [currentStep, setCurrentStep] = useState(1);
    const [isProcessing, setIsProcessing] = useState(false);
    const [loadingAlternatives, setLoadingAlternatives] = useState(null);
    
    const [evaluationResult, setEvaluationResult] = useState(null);
    const [submission, setSubmission] = useState(null);
    const [error, setError] = useState(null);

    const evaluateText = async () => {
        if (!title.trim() || !text.trim()) {
            toast.error('Please provide both a title and text to evaluate');
            return;
        }

        setIsProcessing(true);
        setCurrentStep(2);
        setError(null);

        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `You are a senior literary agent and developmental editor using the proprietary WAVE Revision System (60+ craft items). Analyze this manuscript excerpt with professional precision.

MANUSCRIPT TITLE: ${title}

TEXT TO EVALUATE:
"""
${text}
"""

Evaluate against these 12 LITERARY AGENT CRITERIA:
1. The Hook - First page and first 5 pages pull reader in immediately with intrigue, tension, or unique voice
2. Voice & Narrative Style - Distinct, engaging voice that matches story tone with fresh, vivid, intentional prose
3. Characters & Introductions - Visceral character feel with actions, dialogue, and thoughts showing personality and motivations
4. Conflict & Tension - Strong driving tension in every scene with escalating conflicts and difficult choices
5. Thematic Resonance - Deep, layered themes woven naturally into character actions without being preachy
6. Pacing & Structural Flow - Every chapter ends with momentum, scenes are tight and purposeful with good mix of pace
7. Dialogue & Subtext - Authentic dialogue with distinct rhythms, revealing more than it states with unspoken meaning
8. Worldbuilding & Immersion - World revealed organically with sensory details and lived-in atmosphere
9. Stakes & Emotional Investment - Clear stakes with urgency in choices and reader emotional connection to character fate
10. Line-Level Polish - Tight, evocative prose with proper sentence rhythm matching scene intensity
11. Marketability & Genre Fit - Fresh and original while fitting genre and being marketable with clear comp titles
12. Would Agent Keep Reading - High tension/intrigue at page 50 with clear forward momentum making agent request more

Also apply the WAVE REVISION SYSTEM covering 60+ items including: sentence variety, word economy, sensory details, active voice, verb strength, adverb reduction, dialogue tags, beat placement, scene structure, transition flow, tension maintenance, emotional beats, character voice consistency, internal monologue clarity, description balance, pacing rhythm, showing vs telling, and more.

Provide detailed, actionable analysis with specific examples and precise scores.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        overall_score: {
                            type: "number",
                            description: "Overall score from 0-10"
                        },
                        criteria_scores: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    score: { type: "number", description: "Score from 0-10" },
                                    why: { type: "string", description: "Detailed reasoning for the score" },
                                    fixes: { type: "string", description: "Specific actionable improvements with examples" }
                                }
                            }
                        },
                        wave_hits: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    wave_item: { type: "string" },
                                    severity: { type: "string", enum: ["minor", "moderate", "major"] },
                                    evidence_quote: { type: "string" },
                                    fix: { type: "string" }
                                }
                            }
                        },
                        strengths: {
                            type: "array",
                            items: { type: "string" }
                        },
                        missing: {
                            type: "array",
                            items: { type: "string" }
                        },
                        verdict: {
                            type: "string",
                            description: "Overall agent verdict in a short paragraph"
                        }
                    }
                }
            });

            setEvaluationResult(result);

            // Save to database
            const newSubmission = await base44.entities.Submission.create({
                title,
                text,
                result_json: result,
                overall_score: result.overall_score,
                status: 'reviewed'
            });

            setSubmission(newSubmission);
            setCurrentStep(3);
            toast.success('Analysis complete! Review your evaluation below.');

        } catch (error) {
            console.error('Evaluation error:', error);
            setError(error.message || 'Failed to evaluate. Please try again.');
            toast.error('Failed to evaluate. Please try again.');
            setCurrentStep(1);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFinalize = () => {
        setCurrentStep(4);
    };

    const handleReset = () => {
        setTitle('');
        setText('');
        setCurrentStep(1);
        setEvaluationResult(null);
        setSubmission(null);
        setError(null);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Dual AI Analysis
                    </Badge>
                    <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
                        Evaluate Your Manuscript
                    </h1>
                    <p className="mt-3 text-slate-600 max-w-xl mx-auto">
                        Submit your draft for comprehensive evaluation against literary agent standards
                    </p>
                </div>

                {/* Progress Tracker */}
                <div className="mb-10">
                    <ProgressTracker currentStep={currentStep} isProcessing={isProcessing} />
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Content Area */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Step 1: Input */}
                        {currentStep === 1 && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                            >
                                <TextEditor 
                                    title={title}
                                    setTitle={setTitle}
                                    text={text}
                                    setText={setText}
                                />
                                <div className="mt-6 flex justify-end">
                                    <Button
                                        onClick={evaluateText}
                                        disabled={!title.trim() || !text.trim()}
                                        size="lg"
                                        className="h-12 px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                    >
                                        <Sparkles className="w-5 h-5 mr-2" />
                                        Evaluate with AI
                                        <ArrowRight className="w-5 h-5 ml-2" />
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 2: Processing */}
                        {currentStep === 2 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-20"
                            >
                                {isProcessing ? (
                                    <>
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-indigo-200 rounded-full blur-2xl opacity-50 animate-pulse" />
                                            <Loader2 className="relative w-16 h-16 text-indigo-600 animate-spin" />
                                        </div>
                                        <h3 className="mt-8 text-xl font-semibold text-slate-800">
                                            Analyzing Your Manuscript...
                                        </h3>
                                        <p className="mt-2 text-slate-500 text-center max-w-md">
                                            Applying 12 literary agent criteria and 60+ Wave Revision items
                                        </p>
                                    </>
                                ) : error ? (
                                    <div className="text-center">
                                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
                                            <span className="text-2xl">⚠️</span>
                                        </div>
                                        <h3 className="text-xl font-semibold text-red-600 mb-2">
                                            Evaluation Failed
                                        </h3>
                                        <p className="text-slate-600 mb-6">{error}</p>
                                        <Button onClick={() => setCurrentStep(1)}>
                                            Try Again
                                        </Button>
                                    </div>
                                ) : null}
                            </motion.div>
                        )}

                        {/* Step 3: Review Results */}
                        {currentStep === 3 && evaluationResult && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-6"
                            >
                                {/* Overall Score */}
                                <ScoreCard
                                    title="Overall Agent Score"
                                    score={evaluationResult.overall_score * 10}
                                    icon={BookOpen}
                                    description="Industry submission readiness"
                                    color="indigo"
                                />

                                {/* Verdict */}
                                {evaluationResult.verdict && (
                                    <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200">
                                        <h3 className="text-lg font-semibold text-slate-800 mb-3">Agent Verdict</h3>
                                        <p className="text-slate-700 leading-relaxed">{evaluationResult.verdict}</p>
                                    </div>
                                )}

                                {/* Criteria Scores */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-slate-800">12 Literary Agent Criteria</h3>
                                        <Badge>{evaluationResult.criteria_scores?.length || 0}/12</Badge>
                                    </div>
                                    {evaluationResult.criteria_scores?.map((criterion, idx) => (
                                        <div key={idx} className="p-5 rounded-xl bg-white border border-slate-200 hover:border-indigo-200 transition-all">
                                            <div className="flex items-start justify-between mb-3">
                                                <h4 className="font-semibold text-slate-800">{criterion.name}</h4>
                                                <span className={`font-bold text-lg ${
                                                    criterion.score >= 9 ? 'text-emerald-600' :
                                                    criterion.score >= 7 ? 'text-amber-600' : 'text-rose-600'
                                                }`}>
                                                    {criterion.score}/10
                                                </span>
                                            </div>
                                            <div className="space-y-3 text-sm">
                                                <div>
                                                    <span className="font-medium text-slate-600">Why:</span>
                                                    <p className="text-slate-600 mt-1">{criterion.why}</p>
                                                </div>
                                                {criterion.fixes && (
                                                    <div>
                                                        <span className="font-medium text-indigo-600">Actionable Fixes:</span>
                                                        <p className="text-slate-700 mt-1">{criterion.fixes}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Wave Hits */}
                                {evaluationResult.wave_hits?.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-slate-800">Wave Revision Items ({evaluationResult.wave_hits.length})</h3>
                                        {evaluationResult.wave_hits.map((hit, idx) => (
                                            <div key={idx} className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                                                <div className="flex items-start justify-between mb-2">
                                                    <span className="font-semibold text-slate-800">{hit.wave_item}</span>
                                                    <Badge className={
                                                        hit.severity === 'major' ? 'bg-red-100 text-red-700' :
                                                        hit.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }>
                                                        {hit.severity}
                                                    </Badge>
                                                </div>
                                                <div className="text-sm space-y-2">
                                                    <div>
                                                        <span className="font-medium text-slate-600">Evidence:</span>
                                                        <p className="text-slate-600 italic mt-1">"{hit.evidence_quote}"</p>
                                                    </div>
                                                    <div>
                                                        <span className="font-medium text-indigo-600">Fix:</span>
                                                        <p className="text-slate-700 mt-1">{hit.fix}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Strengths & Missing */}
                                <div className="grid md:grid-cols-2 gap-4">
                                    {evaluationResult.strengths?.length > 0 && (
                                        <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200">
                                            <h4 className="font-semibold text-emerald-800 mb-3">✅ Strengths</h4>
                                            <ul className="space-y-2">
                                                {evaluationResult.strengths.map((s, idx) => (
                                                    <li key={idx} className="text-sm text-slate-700">• {s}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {evaluationResult.missing?.length > 0 && (
                                        <div className="p-5 rounded-xl bg-rose-50 border border-rose-200">
                                            <h4 className="font-semibold text-rose-800 mb-3">⚠️ Missing</h4>
                                            <ul className="space-y-2">
                                                {evaluationResult.missing.map((m, idx) => (
                                                    <li key={idx} className="text-sm text-slate-700">• {m}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                {/* Action Buttons */}
                                <div className="flex gap-4">
                                    <Button onClick={handleFinalize} className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600">
                                        Finalize & Export
                                    </Button>
                                    <Button onClick={handleReset} variant="outline">
                                        New Submission
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {/* Step 4: Final Output */}
                        {currentStep === 4 && (
                            <FinalOutput
                                title={title}
                                originalText={text}
                                evaluationResult={evaluationResult}
                                submission={submission}
                                onReset={handleReset}
                            />
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {currentStep === 1 && (
                            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100">
                                <h3 className="font-semibold text-slate-800 mb-4">Tips for Best Results</h3>
                                <ul className="space-y-3 text-sm text-slate-600">
                                    <li className="flex items-start gap-2">
                                        <span className="text-indigo-600">•</span>
                                        Submit polished drafts for more nuanced feedback
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-indigo-600">•</span>
                                        Include complete scenes for better pacing analysis
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-indigo-600">•</span>
                                        Opening chapters get special attention on hooks
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-indigo-600">•</span>
                                        Dialogue-heavy sections reveal character voice
                                    </li>
                                </ul>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}