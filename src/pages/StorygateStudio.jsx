import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { 
    Sparkles, 
    CheckCircle2, 
    X, 
    Loader2,
    AlertCircle
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function StorygateStudio() {
    const [formData, setFormData] = useState({
        project_title: '',
        format: '',
        genre_tone: '',
        description: '',
        project_stage: '',
        seeking: [],
        why_storygate: '',
        acknowledgment: false
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleSeekingToggle = (value) => {
        setFormData(prev => ({
            ...prev,
            seeking: prev.seeking.includes(value)
                ? prev.seeking.filter(v => v !== value)
                : [...prev.seeking, value]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.project_title.trim()) {
            toast.error('Project title is required');
            return;
        }

        if (!formData.description.trim() || formData.description.split(/\s+/).length < 50) {
            toast.error('Description must be at least 300 words');
            return;
        }

        if (!formData.why_storygate.trim()) {
            toast.error('Please explain why you are submitting to Storygate Studio');
            return;
        }

        if (!formData.acknowledgment) {
            toast.error('Please acknowledge the submission terms');
            return;
        }

        setIsSubmitting(true);

        try {
            // Store submission (you'll need to create a StorygateSubmission entity)
            await base44.entities.StorygateSubmission.create({
                project_title: formData.project_title,
                format: formData.format,
                genre_tone: formData.genre_tone,
                description: formData.description,
                project_stage: formData.project_stage,
                seeking: formData.seeking,
                why_storygate: formData.why_storygate,
                status: 'pending_review'
            });

            setSubmitted(true);
            toast.success('Submission received');
        } catch (error) {
            console.error('Submission error:', error);
            toast.error('Failed to submit. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-screen" style={{ backgroundColor: '#0E0E0E' }}>
                <div className="max-w-2xl mx-auto px-6 py-24 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" style={{ backgroundColor: '#7A1E1E' }}>
                        <CheckCircle2 className="w-8 h-8" style={{ color: '#F2EFEA' }} />
                    </div>
                    <h1 className="text-3xl font-bold mb-4" style={{ color: '#7A1E1E' }}>
                        Submission Received
                    </h1>
                    <p className="text-lg mb-8" style={{ color: '#F2EFEA' }}>
                        Your project has been submitted to Storygate Studio. If your work aligns with our 
                        current focus, you may be contacted for next steps.
                    </p>
                    <p className="text-sm" style={{ color: '#7B7B7B' }}>
                        Due to volume, we cannot respond to all submissions.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen" style={{ backgroundColor: '#0E0E0E' }}>
            {/* Hero Section */}
            <div className="relative overflow-hidden py-20 border-b" style={{ borderColor: '#A98E4A' }}>
                <div className="relative max-w-4xl mx-auto px-6 text-center">
                    <Badge className="mb-4 px-4 py-2" style={{ backgroundColor: 'rgba(122, 30, 30, 0.1)', color: '#A98E4A', borderColor: '#A98E4A' }}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        By RevisionGrade™
                    </Badge>
                    <h1 className="text-5xl font-bold mb-4" style={{ color: '#7A1E1E' }}>
                        Storygate Studio™
                    </h1>
                    <p className="text-2xl mb-6" style={{ color: '#F2EFEA' }}>
                        A Selective Development Track for Exceptional Work
                    </p>
                    <p className="text-lg max-w-2xl mx-auto" style={{ color: '#7B7B7B' }}>
                        An invitation-based extension of RevisionGrade, created for projects that demonstrate 
                        unusual promise, originality, or depth.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* What It Is */}
                <Card className="mb-8" style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                    <CardContent className="pt-6 space-y-4" style={{ color: '#F2EFEA' }}>
                        <p style={{ color: '#7B7B7B' }} className="italic">
                            It is not a general submission service.
                        </p>
                        <p style={{ color: '#F2EFEA' }} className="font-semibold">
                            It is a curated environment for serious creative work.
                        </p>
                    </CardContent>
                </Card>

                {/* How It Works */}
                <Card className="mb-8" style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                    <CardHeader>
                        <CardTitle style={{ color: '#7A1E1E' }}>How It Works</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4" style={{ color: '#F2EFEA' }}>
                        <p>
                            Submissions are reviewed internally.
                        </p>
                        <p>
                            A small number may be invited into further consideration.
                        </p>
                        <p style={{ color: '#7B7B7B' }} className="italic text-sm mt-4">
                            Due to volume and the nature of the process, not all submissions receive a response.
                        </p>
                    </CardContent>
                </Card>

                {/* What It Is / Is Not */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <Card style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                        <CardHeader>
                            <CardTitle style={{ color: '#A98E4A' }} className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5" />
                                What Storygate Studio Is
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2" style={{ color: '#F2EFEA' }}>
                            <p>• A focused development pathway for high-potential work</p>
                            <p>• A professional review layer beyond automated analysis</p>
                            <p>• A bridge between promising material and deeper creative evaluation</p>
                        </CardContent>
                    </Card>

                    <Card style={{ borderColor: '#7A1E1E', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                        <CardHeader>
                            <CardTitle style={{ color: '#7A1E1E' }} className="flex items-center gap-2">
                                <X className="w-5 h-5" />
                                What It Is Not
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2" style={{ color: '#F2EFEA' }}>
                            <p>• A general editing or critique service</p>
                            <p>• A guarantee of representation or publication</p>
                            <p>• A paid shortcut to access</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Review Pathways */}
                <Card className="mb-8" style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                    <CardHeader>
                        <CardTitle style={{ color: '#7A1E1E' }}>Review Pathways</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4" style={{ color: '#F2EFEA' }}>
                        <div>
                            <p className="font-semibold" style={{ color: '#F2EFEA' }}>Initial Submission</p>
                            <p className="text-sm" style={{ color: '#7B7B7B' }}>All submissions are reviewed internally.</p>
                        </div>
                        <div>
                            <p className="font-semibold" style={{ color: '#F2EFEA' }}>Storygate Review Pass</p>
                            <p className="text-sm" style={{ color: '#7B7B7B' }}>Select projects may be invited into a structured review phase.</p>
                        </div>
                        <div>
                            <p className="font-semibold" style={{ color: '#F2EFEA' }}>Development Track</p>
                            <p className="text-sm" style={{ color: '#7B7B7B' }}>A limited number of projects may be invited into deeper collaboration.</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Pricing */}
                <Card className="mb-8" style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                    <CardHeader>
                        <CardTitle style={{ color: '#7A1E1E' }}>Pricing & Engagement</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3" style={{ color: '#F2EFEA' }}>
                        <p>
                            <strong style={{ color: '#F2EFEA' }}>Submission to Storygate Studio is free.</strong>
                        </p>
                        <p className="text-sm" style={{ color: '#7B7B7B' }}>
                            If a project is selected for further consideration, an optional paid engagement may be offered. 
                            All terms are discussed in advance.
                        </p>
                    </CardContent>
                </Card>

                {/* Final Note */}
                <Card className="mb-8" style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                    <CardContent className="pt-6">
                        <p style={{ color: '#F2EFEA' }} className="text-center italic">
                            Storygate Studio exists for work that is already reaching toward something more.
                        </p>
                    </CardContent>
                </Card>

                {/* Submission Form */}
                <Card style={{ borderColor: '#7A1E1E', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                    <CardHeader>
                        <CardTitle style={{ color: '#7A1E1E' }}>Submit Your Project</CardTitle>
                        <p className="text-sm mt-2" style={{ color: '#7B7B7B' }}>
                            Each submission is reviewed internally. If your project aligns with our current focus, 
                            you may be contacted for next steps.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Project Title */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                    Project Title *
                                </label>
                                <Input
                                    value={formData.project_title}
                                    onChange={(e) => setFormData({...formData, project_title: e.target.value})}
                                    style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                    required
                                />
                            </div>

                            {/* Format */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Format *
                                </label>
                                <Select 
                                    value={formData.format} 
                                    onValueChange={(value) => setFormData({...formData, format: value})}
                                >
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                        <SelectValue placeholder="Select format" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="novel">Novel</SelectItem>
                                        <SelectItem value="feature_film">Feature Film</SelectItem>
                                        <SelectItem value="series">Series</SelectItem>
                                        <SelectItem value="memoir">Memoir</SelectItem>
                                        <SelectItem value="narrative_nonfiction">Narrative Nonfiction</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Genre / Tone */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Genre / Tone
                                </label>
                                <Input
                                    value={formData.genre_tone}
                                    onChange={(e) => setFormData({...formData, genre_tone: e.target.value})}
                                    placeholder="e.g., Literary thriller, Psychological drama, Magical realism"
                                    className="bg-slate-800 border-slate-700 text-white"
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Brief Description (300–500 words) *
                                </label>
                                <Textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="Describe the project, its themes, and what makes it distinct."
                                    className="bg-slate-800 border-slate-700 text-white min-h-[200px]"
                                    required
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    Word count: {formData.description.split(/\s+/).filter(w => w).length}
                                </p>
                            </div>

                            {/* Project Stage */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    What stage is this project in? *
                                </label>
                                <Select 
                                    value={formData.project_stage} 
                                    onValueChange={(value) => setFormData({...formData, project_stage: value})}
                                >
                                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                        <SelectValue placeholder="Select stage" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="early_draft">Early draft</SelectItem>
                                        <SelectItem value="revised_draft">Revised draft</SelectItem>
                                        <SelectItem value="near_final">Near-final / submission-ready</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* What Are You Seeking */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    What are you seeking? (Check all that apply)
                                </label>
                                <div className="space-y-2">
                                    {[
                                        { value: 'structural', label: 'Structural evaluation' },
                                        { value: 'developmental', label: 'Developmental insight' },
                                        { value: 'positioning', label: 'Market / positioning guidance' },
                                        { value: 'professional', label: 'Professional feedback' },
                                        { value: 'direction', label: 'Unsure — seeking direction' }
                                    ].map(option => (
                                        <label key={option.value} className="flex items-center gap-2 text-slate-300 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={formData.seeking.includes(option.value)}
                                                onChange={() => handleSeekingToggle(option.value)}
                                                className="rounded border-slate-700 bg-slate-800 text-indigo-600"
                                            />
                                            {option.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Why Storygate */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Why are you submitting to Storygate Studio, specifically? *
                                </label>
                                <p className="text-xs text-slate-500 mb-2">
                                    (This helps us understand your goals and whether this is the right environment for your work.)
                                </p>
                                <Textarea
                                    value={formData.why_storygate}
                                    onChange={(e) => setFormData({...formData, why_storygate: e.target.value})}
                                    placeholder="What kind of collaboration are you seeking? Be honest."
                                    className="bg-slate-800 border-slate-700 text-white min-h-[120px]"
                                    required
                                />
                            </div>

                            {/* Acknowledgment */}
                            <div className="p-4 rounded-lg bg-amber-900/20 border border-amber-800/50">
                                <label className="flex items-start gap-3 text-slate-300 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.acknowledgment}
                                        onChange={(e) => setFormData({...formData, acknowledgment: e.target.checked})}
                                        className="mt-1 rounded border-slate-700 bg-slate-800 text-indigo-600"
                                        required
                                    />
                                    <span className="text-sm">
                                        I understand that Storygate Studio cannot respond to all submissions and that 
                                        submission does not guarantee review or feedback.
                                    </span>
                                </label>
                            </div>

                            {/* Submit Button */}
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full h-12 hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: '#7A1E1E', color: '#F2EFEA' }}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    'Submit to Storygate Studio'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Final Note */}
                <Card className="mt-8" style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#7B7B7B' }} />
                            <p className="text-sm" style={{ color: '#7B7B7B' }}>
                                Due to volume, we cannot respond to all submissions. If your project aligns with our 
                                current focus, you will be contacted directly. Thank you for your understanding.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}