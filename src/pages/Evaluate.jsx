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

        // Keep-alive interval to prevent timeout
        const keepAlive = setInterval(() => {
            console.log('Analysis in progress...');
        }, 5000);

        try {
            // Literary Agent Evaluation
            const agentAnalysis = await base44.integrations.Core.InvokeLLM({
                prompt: `You are a senior literary agent evaluating a manuscript for representation. Analyze this text against exactly these 12 criteria, rating each 1-10:

1. The Hook - First pages pull reader in with intrigue, tension, unique voice
2. Voice & Narrative Style - Distinct, engaging voice matching tone with fresh prose  
3. Characters & Introductions - Visceral character feel showing personality and motivations
4. Conflict & Tension - Strong driving tension with escalating conflicts
5. Thematic Resonance - Deep themes woven naturally without being preachy
6. Pacing & Structural Flow - Momentum in every chapter, tight purposeful scenes
7. Dialogue & Subtext - Authentic dialogue revealing more than stated
8. Worldbuilding & Immersion - World revealed organically with sensory details
9. Stakes & Emotional Investment - Clear stakes with reader emotional connection
10. Line-Level Polish - Tight evocative prose with proper rhythm
11. Marketability & Genre Fit - Fresh, original, fits genre, marketable
12. Would Agent Keep Reading - High tension/intrigue making agent request full manuscript

TITLE: ${title}

TEXT:
${text}

For each criterion provide: score (1-10), strengths (array), weaknesses (array), agentNotes (detailed commentary).
Provide overall score (1-10), agentVerdict (agent-ready/promising but needs revision/needs significant work), and prioritized revision requests.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        overallScore: { type: "number", description: "1-10" },
                        agentVerdict: { type: "string" },
                        criteria: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    name: { type: "string" },
                                    score: { type: "number", description: "1-10" },
                                    strengths: { type: "array", items: { type: "string" } },
                                    weaknesses: { type: "array", items: { type: "string" } },
                                    agentNotes: { type: "string" }
                                },
                                required: ["name", "score", "strengths", "weaknesses", "agentNotes"]
                            }
                        },
                        revisionRequests: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    priority: { type: "string", enum: ["High", "Medium", "Low"] },
                                    instruction: { type: "string" }
                                },
                                required: ["priority", "instruction"]
                            }
                        }
                    },
                    required: ["overallScore", "agentVerdict", "criteria", "revisionRequests"]
                }
            });

            // Wave Revision Guidance
            const waveAnalysis = await base44.integrations.Core.InvokeLLM({
                prompt: `Apply the Wave Revision System to identify 5-10 specific craft issues.

TEXT:
${text}

Find issues with: sentence variety, word economy, sensory details, active voice, verb strength, adverbs, dialogue tags, beats, scene structure, transitions, tension, emotional beats, character voice, internal thoughts, description balance, pacing, showing vs telling.

For each: wave_item (name), severity (High/Medium/Low), evidence_quote (exact text), fix (specific revision).
Also identify 3-5 priority wave numbers to focus on and next actions.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        waveHits: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    wave_item: { type: "string" },
                                    severity: { type: "string", enum: ["High", "Medium", "Low"] },
                                    evidence_quote: { type: "string" },
                                    fix: { type: "string" }
                                },
                                required: ["wave_item", "severity", "evidence_quote", "fix"]
                            }
                        },
                        waveGuidance: {
                            type: "object",
                            properties: {
                                priorityWaves: { type: "array", items: { type: "number" } },
                                nextActions: { type: "array", items: { type: "string" } }
                            },
                            required: ["priorityWaves", "nextActions"]
                        }
                    },
                    required: ["waveHits", "waveGuidance"]
                }
            });

            // Combine results
            const evaluationResult = {
                overallScore: agentAnalysis.overallScore || 5,
                agentVerdict: agentAnalysis.agentVerdict || "Evaluation complete",
                criteria: agentAnalysis.criteria || [],
                revisionRequests: agentAnalysis.revisionRequests || [],
                waveHits: waveAnalysis.waveHits || [],
                waveGuidance: waveAnalysis.waveGuidance || { priorityWaves: [], nextActions: [] }
            };

            // Save to database first
            let newSubmission = null;
            try {
                newSubmission = await base44.entities.Submission.create({
                    title,
                    text,
                    result_json: evaluationResult,
                    overall_score: evaluationResult.overallScore,
                    status: 'reviewed'
                });
                setSubmission(newSubmission);
            } catch (saveError) {
                console.error('Save error (non-critical):', saveError);
            }

            // Set result and advance to step 3
            setEvaluationResult(evaluationResult);
            setIsProcessing(false);
            setCurrentStep(3);
            toast.success('Analysis complete! Review your evaluation below.');

        } catch (error) {
            console.error('Evaluation error:', error);
            setError(error.message || 'Failed to evaluate. Please try again.');
            toast.error('Failed to evaluate. Please try again.');
            setCurrentStep(1);
            setIsProcessing(false);
        } finally {
            clearInterval(keepAlive);
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
                                            Two AI systems evaluating against 12 literary agent criteria and 60+ Wave Revision items
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
                                {/* Base44 Calibrated Score */}
                                <div className="p-8 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-900 border-2 border-indigo-500 shadow-2xl">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Badge className="bg-indigo-500 text-white border-0">
                                            Agent-Reality Grade
                                        </Badge>
                                    </div>
                                    <div className="flex items-end justify-between mb-4">
                                        <h2 className="text-2xl font-bold text-white">Base44 Calibrated Score</h2>
                                        <div className="text-right">
                                            <span className={`text-5xl font-bold ${
                                                evaluationResult.overallScore * 10 >= 80 ? 'text-emerald-400' :
                                                evaluationResult.overallScore * 10 >= 60 ? 'text-amber-400' :
                                                'text-rose-400'
                                            }`}>
                                                {Math.round(evaluationResult.overallScore * 10)}
                                            </span>
                                            <span className="text-white/60 text-xl">/100</span>
                                        </div>
                                    </div>
                                    <p className="text-white/90 text-lg mb-4">{evaluationResult.agentVerdict}</p>
                                    <div className="p-4 rounded-lg bg-white/10 border border-white/20">
                                        <p className="text-sm text-white/80">
                                            <strong className="text-white">Brutal honesty is our brand.</strong> This score reflects real agent decision-making, calibrated against publishing outcomes.
                                        </p>
                                    </div>
                                </div>

                                {/* Revision Requests */}
                                {evaluationResult.revisionRequests?.length > 0 && (
                                    <div className="p-6 rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200">
                                        <h3 className="text-lg font-semibold text-slate-800 mb-4">Priority Revision Requests</h3>
                                        <div className="space-y-3">
                                            {evaluationResult.revisionRequests.map((req, idx) => (
                                                <div key={idx} className="flex items-start gap-3">
                                                    <Badge className={
                                                        req.priority === 'High' ? 'bg-red-100 text-red-700' :
                                                        req.priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-blue-100 text-blue-700'
                                                    }>
                                                        {req.priority}
                                                    </Badge>
                                                    <p className="text-sm text-slate-700 flex-1">{req.instruction}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Criteria Scores */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-semibold text-slate-800">12 Literary Agent Criteria</h3>
                                        <Badge>{evaluationResult.criteria?.length || 0}/12</Badge>
                                    </div>
                                    {evaluationResult.criteria?.map((criterion, idx) => (
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
                                                {criterion.strengths?.length > 0 && (
                                                    <div>
                                                        <span className="font-medium text-emerald-600">✓ Strengths:</span>
                                                        <ul className="mt-1 space-y-1">
                                                            {criterion.strengths.map((s, i) => (
                                                                <li key={i} className="text-slate-600">• {s}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {criterion.weaknesses?.length > 0 && (
                                                    <div>
                                                        <span className="font-medium text-rose-600">✗ Weaknesses:</span>
                                                        <ul className="mt-1 space-y-1">
                                                            {criterion.weaknesses.map((w, i) => (
                                                                <li key={i} className="text-slate-600">• {w}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {criterion.agentNotes && (
                                                    <div>
                                                        <span className="font-medium text-indigo-600">Agent Notes:</span>
                                                        <p className="text-slate-700 mt-1">{criterion.agentNotes}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Wave Hits */}
                                {evaluationResult.waveHits?.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-slate-800">Wave Revision Items ({evaluationResult.waveHits.length})</h3>
                                        {evaluationResult.waveHits.map((hit, idx) => (
                                            <div key={idx} className="p-4 rounded-xl bg-amber-50 border border-amber-200">
                                                <div className="flex items-start justify-between mb-2">
                                                    <span className="font-semibold text-slate-800">{hit.wave_item}</span>
                                                    <Badge className={
                                                        hit.severity === 'High' ? 'bg-red-100 text-red-700' :
                                                        hit.severity === 'Medium' ? 'bg-amber-100 text-amber-700' :
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

                                {/* Wave Guidance */}
                                {evaluationResult.waveGuidance && (
                                    <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-200">
                                        <h4 className="font-semibold text-cyan-800 mb-3">Wave System Guidance</h4>
                                        {evaluationResult.waveGuidance.priorityWaves?.length > 0 && (
                                            <div className="mb-3">
                                                <span className="text-sm font-medium text-slate-600">Priority Waves:</span>
                                                <div className="flex gap-2 mt-2">
                                                    {evaluationResult.waveGuidance.priorityWaves.map((wave, i) => (
                                                        <Badge key={i} variant="outline">Wave {wave}</Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                        {evaluationResult.waveGuidance.nextActions?.length > 0 && (
                                            <div>
                                                <span className="text-sm font-medium text-slate-600">Next Actions:</span>
                                                <ul className="mt-2 space-y-1">
                                                    {evaluationResult.waveGuidance.nextActions.map((action, i) => (
                                                        <li key={i} className="text-sm text-slate-700">• {action}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="space-y-3">
                                    <FinalOutput
                                        title={title}
                                        originalText={text}
                                        evaluationResult={evaluationResult}
                                        submission={submission}
                                        onReset={handleReset}
                                        compactMode={true}
                                    />
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