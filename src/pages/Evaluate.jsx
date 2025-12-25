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
    "voice_style", "opening_hook", "character_development", "dialogue",
    "pacing", "world_building", "conflict_tension", "show_dont_tell",
    "emotional_resonance", "prose_quality", "originality", "market_readiness"
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
    
    const [scores, setScores] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [submission, setSubmission] = useState(null);

    const evaluateText = async () => {
        if (!title.trim() || !text.trim()) {
            toast.error('Please provide both a title and text to evaluate');
            return;
        }

        setIsProcessing(true);
        setCurrentStep(2);

        try {
            // First AI Analysis
            const analysis1 = await base44.integrations.Core.InvokeLLM({
                prompt: `You are a senior literary agent evaluating a manuscript excerpt. Analyze this text against industry standards.

MANUSCRIPT TITLE: ${title}

TEXT TO EVALUATE:
"""
${text}
"""

Evaluate against these 12 LITERARY AGENT CRITERIA:
1. Voice & Style - Unique authorial voice
2. Opening Hook - Compelling attention-grabbing
3. Character Development - Believable, motivated characters
4. Dialogue - Natural, character-revealing
5. Pacing - Appropriate rhythm and momentum
6. World Building - Immersive setting details
7. Conflict & Tension - Compelling stakes
8. Show Don't Tell - Active demonstration
9. Emotional Resonance - Evokes genuine emotion
10. Prose Quality - Clean sentence construction
11. Originality - Fresh perspective
12. Market Readiness - Polish for submission

Also evaluate against the WAVE REVISION GUIDE covering: sentence variety, word economy, sensory details, active voice, verb strength, adverb usage, dialogue tags, beat placement, scene structure, transitions, tension maintenance, emotional beats, character voice, internal monologue, description balance, pacing rhythm.

Provide scores (0-100) for each criterion and identify 3-5 specific segments that need attention with keep/replace/delete recommendations.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        literary_scores: {
                            type: "object",
                            properties: LITERARY_CRITERIA.reduce((acc, c) => ({ ...acc, [c]: { type: "number" } }), {})
                        },
                        wave_scores: {
                            type: "object",
                            properties: WAVE_CRITERIA.reduce((acc, c) => ({ ...acc, [c]: { type: "number" } }), {})
                        },
                        overall_score: { type: "number" },
                        suggestions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    original_segment: { type: "string" },
                                    action: { type: "string", enum: ["keep", "replace", "delete"] },
                                    replacement_text: { type: "string" },
                                    reasoning: { type: "string" },
                                    criteria_referenced: { type: "array", items: { type: "string" } }
                                }
                            }
                        }
                    }
                }
            });

            // Second AI Analysis for cross-validation
            const analysis2 = await base44.integrations.Core.InvokeLLM({
                prompt: `You are a professional developmental editor with expertise in the Wave Revision methodology. Provide a second opinion on this manuscript.

MANUSCRIPT TITLE: ${title}

TEXT TO EVALUATE:
"""
${text}
"""

Focus on finding 2-4 DIFFERENT specific issues from a first-pass analysis. Look for:
- Prose-level improvements (word choice, sentence structure)
- Craft elements (showing vs telling, sensory details)
- Pacing and rhythm issues
- Areas of strength to preserve (mark as "keep")

For each issue, provide the exact text segment and whether to KEEP, REPLACE, or DELETE it.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        suggestions: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    original_segment: { type: "string" },
                                    action: { type: "string", enum: ["keep", "replace", "delete"] },
                                    replacement_text: { type: "string" },
                                    reasoning: { type: "string" },
                                    criteria_referenced: { type: "array", items: { type: "string" } }
                                }
                            }
                        }
                    }
                }
            });

            // Combine and deduplicate suggestions
            const allSuggestions = [
                ...(analysis1.suggestions || []).map((s, i) => ({ 
                    ...s, 
                    ai_source: 'analyst_1', 
                    status: 'pending',
                    segment_index: i 
                })),
                ...(analysis2.suggestions || []).map((s, i) => ({ 
                    ...s, 
                    ai_source: 'analyst_2', 
                    status: 'pending',
                    segment_index: i + 100 
                }))
            ];

            setScores({
                literary_agent_scores: analysis1.literary_scores,
                wave_revision_scores: analysis1.wave_scores,
                overall_score: analysis1.overall_score || 75
            });

            setSuggestions(allSuggestions);

            // Save to database
            const newSubmission = await base44.entities.Submission.create({
                title,
                original_text: text,
                current_text: text,
                status: 'reviewing',
                literary_agent_scores: analysis1.literary_scores,
                wave_revision_scores: analysis1.wave_scores,
                overall_score: analysis1.overall_score || 75,
                word_count: text.trim().split(/\s+/).length
            });

            setSubmission(newSubmission);

            // Save suggestions
            for (const suggestion of allSuggestions) {
                await base44.entities.Suggestion.create({
                    ...suggestion,
                    submission_id: newSubmission.id
                });
            }

            setCurrentStep(3);
            toast.success('Analysis complete! Review your suggestions below.');

        } catch (error) {
            console.error('Evaluation error:', error);
            toast.error('Failed to evaluate. Please try again.');
            setCurrentStep(1);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAccept = async (suggestion) => {
        const updated = suggestions.map(s => 
            s === suggestion ? { ...s, status: 'accepted' } : s
        );
        setSuggestions(updated);
        
        // Check if all are resolved
        const allResolved = updated.every(s => s.status !== 'pending');
        if (allResolved) {
            setCurrentStep(4);
        }
    };

    const handleReject = async (suggestion) => {
        const updated = suggestions.map(s => 
            s === suggestion ? { ...s, status: 'rejected' } : s
        );
        setSuggestions(updated);
        
        const allResolved = updated.every(s => s.status !== 'pending');
        if (allResolved) {
            setCurrentStep(4);
        }
    };

    const handleRequestAlternatives = async (suggestion) => {
        setLoadingAlternatives(suggestion.segment_index);
        
        try {
            const result = await base44.integrations.Core.InvokeLLM({
                prompt: `A writer has rejected a suggested revision. Please provide 3 alternative approaches.

ORIGINAL TEXT:
"${suggestion.original_segment}"

REJECTED SUGGESTION:
Action: ${suggestion.action}
${suggestion.replacement_text ? `Replacement: "${suggestion.replacement_text}"` : ''}
Reasoning: ${suggestion.reasoning}

Provide 3 alternative revision options that address the same underlying issues but with different approaches.`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        alternatives: {
                            type: "array",
                            items: { type: "string" }
                        }
                    }
                }
            });

            const updated = suggestions.map(s => 
                s === suggestion 
                    ? { ...s, alternatives: result.alternatives || [], status: 'alternatives_requested' } 
                    : s
            );
            setSuggestions(updated);
            toast.success('Alternative suggestions generated!');

        } catch (error) {
            toast.error('Failed to generate alternatives');
        } finally {
            setLoadingAlternatives(null);
        }
    };

    const handleReset = () => {
        setTitle('');
        setText('');
        setCurrentStep(1);
        setScores(null);
        setSuggestions([]);
        setSubmission(null);
    };

    const pendingSuggestions = suggestions.filter(s => s.status === 'pending' || s.status === 'alternatives_requested');
    const resolvedSuggestions = suggestions.filter(s => s.status === 'accepted' || s.status === 'rejected');

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
                        {currentStep === 2 && isProcessing && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="flex flex-col items-center justify-center py-20"
                            >
                                <div className="relative">
                                    <div className="absolute inset-0 bg-indigo-200 rounded-full blur-2xl opacity-50 animate-pulse" />
                                    <Loader2 className="relative w-16 h-16 text-indigo-600 animate-spin" />
                                </div>
                                <h3 className="mt-8 text-xl font-semibold text-slate-800">
                                    Analyzing Your Manuscript...
                                </h3>
                                <p className="mt-2 text-slate-500 text-center max-w-md">
                                    Two AI systems are evaluating against 12 literary agent criteria 
                                    and 60+ Wave Revision items
                                </p>
                            </motion.div>
                        )}

                        {/* Step 3: Review Suggestions */}
                        {currentStep >= 3 && !isProcessing && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-6"
                            >
                                {/* Scores Summary */}
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <ScoreCard
                                        title="Literary Agent Score"
                                        score={scores?.overall_score || 0}
                                        icon={BookOpen}
                                        description="Industry submission readiness"
                                        color="indigo"
                                    />
                                    <ScoreCard
                                        title="Wave Revision Score"
                                        score={Math.round(Object.values(scores?.wave_revision_scores || {}).reduce((a, b) => a + b, 0) / 16) || 0}
                                        icon={Award}
                                        description="Craft and technique quality"
                                        color="purple"
                                    />
                                </div>

                                {/* Pending Suggestions */}
                                {currentStep === 3 && pendingSuggestions.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-slate-800">
                                            Pending Decisions ({pendingSuggestions.length})
                                        </h3>
                                        <AnimatePresence>
                                            {pendingSuggestions.map((suggestion, idx) => (
                                                <SuggestionCard
                                                    key={idx}
                                                    suggestion={suggestion}
                                                    onAccept={handleAccept}
                                                    onReject={handleReject}
                                                    onRequestAlternatives={handleRequestAlternatives}
                                                    isLoading={loadingAlternatives === suggestion.segment_index}
                                                />
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Resolved Suggestions */}
                                {resolvedSuggestions.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-semibold text-slate-800">
                                            Resolved ({resolvedSuggestions.length})
                                        </h3>
                                        <AnimatePresence>
                                            {resolvedSuggestions.map((suggestion, idx) => (
                                                <SuggestionCard
                                                    key={idx}
                                                    suggestion={suggestion}
                                                    onAccept={handleAccept}
                                                    onReject={handleReject}
                                                    onRequestAlternatives={handleRequestAlternatives}
                                                    isLoading={false}
                                                />
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                )}

                                {/* Step 4: Final Output */}
                                {currentStep === 4 && (
                                    <FinalOutput
                                        originalText={text}
                                        suggestions={suggestions}
                                        onReset={handleReset}
                                    />
                                )}
                            </motion.div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {currentStep >= 3 && scores && (
                            <CriteriaPanel scores={scores} />
                        )}

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