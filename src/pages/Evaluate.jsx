import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, ArrowRight, BookOpen, Award } from 'lucide-react';
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { createPageUrl } from '@/utils';

import TextEditor from '@/components/submission/TextEditor';
import ProgressTracker from '@/components/evaluation/ProgressTracker';
import ScoreCard from '@/components/evaluation/ScoreCard';
import SuggestionCard from '@/components/evaluation/SuggestionCard';
import CriteriaPanel from '@/components/evaluation/CriteriaPanel';
import FinalOutput from '@/components/evaluation/FinalOutput';
import StyleModeSelector from '@/components/evaluation/StyleModeSelector';
import ThoughtTagCard from '@/components/evaluation/ThoughtTagCard';

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

// Helper to sort WAVE hits by tier and wave number
const sortWaveHits = (hits) => {
    return hits.map(hit => {
        // Extract wave number from category (e.g., "Body-Part Clichés (Wave 1)" -> 1)
        const match = hit.category.match(/Wave (\d+)/i);
        const waveNum = match ? parseInt(match[1]) : 999;
        
        // Assign tier based on wave number
        let tier = 3; // Late by default
        if (waveNum <= 17) tier = 1; // Early
        else if (waveNum <= 49) tier = 2; // Mid
        
        return { ...hit, waveNum, tier };
    }).sort((a, b) => {
        // Sort by tier first, then wave number
        if (a.tier !== b.tier) return a.tier - b.tier;
        return a.waveNum - b.waveNum;
    });
};

export default function Evaluate() {
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [styleMode, setStyleMode] = useState('neutral');
    
    // Load screenplay from session storage if available
    React.useEffect(() => {
        const screenplayText = sessionStorage.getItem('screenplay_text');
        if (screenplayText) {
            setText(screenplayText);
            setTitle('Formatted Screenplay');
            sessionStorage.removeItem('screenplay_text');
        }
    }, []);
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

        const wordCount = text.split(/\s+/).filter(w => w).length;
        
        if (wordCount > 3000) {
            toast.error(
                <div>
                    <div className="font-semibold mb-1">You've reached the preview limit.</div>
                    <div className="text-sm">To evaluate additional chapters or generate a full manuscript score, unlock full analysis.</div>
                </div>,
                { duration: 6000 }
            );
            
            setTimeout(() => {
                window.location.href = createPageUrl('Pricing');
            }, 2000);
            
            return;
        }

        setIsProcessing(true);
        setCurrentStep(2);
        setError(null);

        try {
            const response = await base44.functions.invoke('evaluateQuickSubmission', {
                title,
                text,
                styleMode
            });

            if (!response.data.success) {
                throw new Error(response.data.error || 'Evaluation failed');
            }

            const evaluationResult = response.data.evaluation;
            const submissionId = response.data.submissionId;

            // Set result and advance to step 3
            setEvaluationResult(evaluationResult);
            setSubmission(submissionId ? { id: submissionId } : null);
            setIsProcessing(false);
            setCurrentStep(3);
            toast.success('Analysis complete! Review your evaluation below.');

        } catch (error) {
            console.error('Evaluation error:', error);
            
            // Check if it's a timeout error
            if (error.response?.status === 408 || error.message?.includes('timeout')) {
                setError('Evaluation timed out. Please try with a shorter excerpt.');
                toast.error('Evaluation timed out. Please try with a shorter excerpt.', { duration: 6000 });
            } else {
                const errorMsg = error.response?.data?.error || error.message || 'Failed to evaluate. Please try again.';
                setError(errorMsg);
                toast.error(errorMsg, { duration: 6000 });
            }
            
            setIsProcessing(false);
            // Stay on step 2 to show error, not reset to step 1
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
                        Dual-Layer Professional Evaluation
                    </Badge>
                    <h1 className="text-3xl sm:text-4xl font-bold text-slate-900">
                        Free Evaluation Preview
                    </h1>
                    <p className="mt-3 text-slate-600 max-w-xl mx-auto">
                        Analyze up to 3,000 words to experience how RevisionGrade evaluates structure, pacing, and craft.
                    </p>
                    <p className="mt-3 text-sm text-slate-500 max-w-2xl mx-auto">
                        Scores reflect how your work aligns with agent-level criteria and WAVE standards. This is revision guidance, not a guarantee of representation or publication.
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
                                className="space-y-6"
                            >
                                <TextEditor 
                                    title={title}
                                    setTitle={setTitle}
                                    text={text}
                                    setText={setText}
                                />

                                <div className="p-6 rounded-xl bg-white border border-slate-200">
                                    <StyleModeSelector 
                                        value={styleMode}
                                        onChange={setStyleMode}
                                    />
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        onClick={evaluateText}
                                        disabled={!title.trim() || !text.trim() || text.split(/\s+/).filter(w => w).length > 3000}
                                        size="lg"
                                        className="h-12 px-8 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                    >
                                        <Sparkles className="w-5 h-5 mr-2" />
                                        Evaluate with RevisionGrade
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
                                           Dual-layer evaluation: story structure + line-level craft against professional editorial standards
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
                                        {evaluationResult.styleMode && (
                                            <Badge className="bg-purple-500 text-white border-0">
                                                Style: {evaluationResult.styleMode}
                                            </Badge>
                                        )}
                                        {evaluationResult.manuscriptTier && (
                                            <Badge className={
                                                evaluationResult.manuscriptTier === 'professional' ? 'bg-emerald-500 text-white border-0' :
                                                evaluationResult.manuscriptTier === 'refinement' ? 'bg-amber-500 text-white border-0' :
                                                'bg-slate-500 text-white border-0'
                                            }>
                                                {evaluationResult.manuscriptTier === 'professional' ? '⭐ Professional Tier' :
                                                 evaluationResult.manuscriptTier === 'refinement' ? '🔧 Refinement Tier' :
                                                 '📝 Developmental Tier'}
                                            </Badge>
                                        )}
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
                                            <strong className="text-white">What this score means:</strong>{' '}
                                            {evaluationResult.manuscriptTier === 'professional' 
                                                ? 'Agent-viable craft; feedback focuses on sharpening impact and submission readiness.'
                                                : evaluationResult.manuscriptTier === 'refinement'
                                                ? 'Solid foundations; revision focuses on clarity, pacing, and consistency.'
                                                : 'Developmental draft; revision focuses on structure, stakes, and narrative coherence.'}
                                        </p>
                                    </div>
                                    </div>

                                    {/* Agent Decision Snapshot */}
                                    {evaluationResult.agentSnapshot && (
                                    <div className="p-6 rounded-xl bg-white border border-slate-200">
                                        <div className="flex items-center gap-2 mb-4">
                                            <Badge className="bg-slate-800 text-white">Agent Decision Snapshot</Badge>
                                            <Badge className={
                                                evaluationResult.agentSnapshot.keep_reading === 'High' ? 'bg-emerald-500 text-white' :
                                                evaluationResult.agentSnapshot.keep_reading === 'Medium' ? 'bg-amber-500 text-white' :
                                                'bg-slate-500 text-white'
                                            }>
                                                Keep Reading: {evaluationResult.agentSnapshot.keep_reading}
                                            </Badge>
                                        </div>
                                        <div className="space-y-3 text-sm">
                                            <div>
                                                <span className="font-semibold text-emerald-600">✓ Biggest Strength:</span>
                                                <p className="text-slate-700 mt-1">{evaluationResult.agentSnapshot.biggest_strength}</p>
                                            </div>
                                            <div>
                                                <span className="font-semibold text-rose-600">⚠ Biggest Risk:</span>
                                                <p className="text-slate-700 mt-1">{evaluationResult.agentSnapshot.biggest_risk}</p>
                                            </div>
                                            <div>
                                                <span className="font-semibold text-indigo-600">→ Most Leverage Fix:</span>
                                                <p className="text-slate-700 mt-1">{evaluationResult.agentSnapshot.most_leverage_fix}</p>
                                            </div>
                                        </div>
                                    </div>
                                    )}

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
                                        <h3 className="text-lg font-semibold text-slate-800">12 Story Evaluation Criteria</h3>
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

                                {/* Thought Tag Suggestions (WAVE 1) */}
                                {evaluationResult.thoughtTagSuggestions?.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                            <Badge className="bg-amber-500 text-white">NEW</Badge>
                                            WAVE 1: Interior Attribution Issues ({evaluationResult.thoughtTagSuggestions.length})
                                        </h3>
                                        <p className="text-sm text-slate-600">
                                            Redundant thought-tags weaken your prose. Choose how to revise each one.
                                        </p>
                                        {evaluationResult.thoughtTagSuggestions.map((suggestion, idx) => (
                                            <ThoughtTagCard
                                                key={idx}
                                                suggestion={suggestion}
                                                onApply={(change) => {
                                                    // Update text with the change
                                                    setText(text.replace(change.original, change.replacement));
                                                    toast.success('Change applied! Re-evaluate to see the impact.');
                                                }}
                                            />
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
                                        Evaluate larger sections when possible. The more text RevisionGrade can see, the more accurately it can assess structure, pacing, and character development across the 12 literary-agent criteria.
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-indigo-600">•</span>
                                        Complete scenes or chapters produce more reliable insights than isolated paragraphs.
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-indigo-600">•</span>
                                        Opening chapters receive focused attention on hooks, voice, and setup.
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-indigo-600">•</span>
                                        Dialogue-heavy sections are especially useful for evaluating character voice and interaction.
                                    </li>
                                </ul>
                                <p className="text-xs text-slate-500 mt-4 italic">
                                    Short excerpts are useful for quick feedback, but full scenes or chapters produce the most accurate evaluations.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}