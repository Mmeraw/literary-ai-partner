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
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
                <div className="max-w-2xl mx-auto px-6 py-24 text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 mb-6">
                        <CheckCircle2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-4">
                        Submission Received
                    </h1>
                    <p className="text-lg text-slate-300 mb-8">
                        Your project has been submitted to Storygate Studio. If your work aligns with our 
                        current focus, you may be contacted for next steps.
                    </p>
                    <p className="text-sm text-slate-400">
                        Due to volume, we cannot respond to all submissions.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900">
            {/* Hero Section */}
            <div className="relative overflow-hidden py-20 border-b border-slate-800">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/20 via-transparent to-transparent" />
                <div className="relative max-w-4xl mx-auto px-6 text-center">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-900/50 text-indigo-200 border-indigo-700">
                        <Sparkles className="w-4 h-4 mr-2" />
                        By RevisionGrade™
                    </Badge>
                    <h1 className="text-5xl font-bold text-white mb-4">
                        Storygate Studio™
                    </h1>
                    <p className="text-2xl text-slate-300 mb-6">
                        Selective Development for Exceptional Work
                    </p>
                    <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                        A curated development space for writers working on ambitious, high-potential projects 
                        across fiction, screen, and narrative nonfiction.
                    </p>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* What It Is */}
                <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm mb-8">
                    <CardContent className="pt-6 space-y-4 text-slate-300">
                        <p>
                            We work with a <strong className="text-white">limited number of creators each cycle</strong>, 
                            focusing on projects that demonstrate originality, craft, and the potential for meaningful 
                            advancement—whether toward publication, representation, or deeper structural refinement.
                        </p>
                        <p className="text-slate-400 italic">
                            Storygate Studio is not an open workshop or general feedback service.
                        </p>
                        <p className="text-white font-semibold">
                            It is a selective review and development pathway for work that shows clear promise.
                        </p>
                    </CardContent>
                </Card>

                {/* How It Works */}
                <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm mb-8">
                    <CardHeader>
                        <CardTitle className="text-white">How It Works</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-slate-300">
                        <p>
                            Every submission is screened by the Storygate team.
                        </p>
                        <p>Some projects may receive:</p>
                        <ul className="list-disc ml-6 space-y-2">
                            <li>Structural or narrative evaluation</li>
                            <li>Targeted developmental feedback</li>
                            <li>Strategic positioning insights</li>
                            <li>In select cases, connection to representation or production contacts</li>
                        </ul>
                        <p className="text-slate-400 italic text-sm mt-4">
                            Due to volume and the nature of the work, responses are limited to projects that 
                            align with current review capacity.
                        </p>
                    </CardContent>
                </Card>

                {/* What It Is / Is Not */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <Card className="border-green-900/50 bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-green-400 flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5" />
                                What Storygate Studio Is
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-slate-300">
                            <p>• A curated entry point for serious creative work</p>
                            <p>• A signal of readiness for deeper development</p>
                            <p>• A bridge between early drafts and professional-level positioning</p>
                        </CardContent>
                    </Card>

                    <Card className="border-red-900/50 bg-slate-900/50 backdrop-blur-sm">
                        <CardHeader>
                            <CardTitle className="text-red-400 flex items-center gap-2">
                                <X className="w-5 h-5" />
                                What It Is Not
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-slate-300">
                            <p>• A guarantee of representation, publication, or production</p>
                            <p>• A general critique service</p>
                            <p>• An open workshop or peer forum</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Who Should Submit */}
                <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm mb-8">
                    <CardHeader>
                        <CardTitle className="text-white">Who Should Submit</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-slate-300">
                        <p>Storygate Studio is best suited for creators who:</p>
                        <ul className="list-disc ml-6 space-y-2 mt-4">
                            <li>Have a complete or near-complete project</li>
                            <li>Are seeking informed, strategic insight rather than line edits</li>
                            <li>Understand that selection is competitive and limited</li>
                            <li>Are prepared to receive honest, professional feedback</li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Submission Form */}
                <Card className="border-indigo-800 bg-slate-900/50 backdrop-blur-sm">
                    <CardHeader>
                        <CardTitle className="text-white">Submit Your Project</CardTitle>
                        <p className="text-slate-400 text-sm mt-2">
                            Each submission is reviewed internally. If your project aligns with our current focus, 
                            you may be contacted for next steps.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Project Title */}
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">
                                    Project Title *
                                </label>
                                <Input
                                    value={formData.project_title}
                                    onChange={(e) => setFormData({...formData, project_title: e.target.value})}
                                    className="bg-slate-800 border-slate-700 text-white"
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
                                className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
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
                <Card className="border-slate-800 bg-slate-900/50 backdrop-blur-sm mt-8">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-slate-400">
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