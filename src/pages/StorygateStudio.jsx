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
    AlertCircle,
    Upload
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
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        project_title: '',
        format: '',
        genre: '',
        genre_other: '',
        tone: '',
        description: '',
        project_stage: '',
        seeking: [],
        evaluation_source: '',
        revisiongrade_score: '',
        evaluator_type: '',
        evaluator_name: '',
        evaluation_date: '',
        evaluation_summary: '',
        evaluation_file: null,
        presentation_package: null,
        why_storygate: '',
        upload_file: null,
        acknowledgment_studio: false,
        acknowledgment_rights: false
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

        if (!formData.first_name.trim()) {
            toast.error('First name is required');
            return;
        }

        if (!formData.last_name.trim()) {
            toast.error('Last name is required');
            return;
        }

        if (!formData.email.trim()) {
            toast.error('Email is required');
            return;
        }

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

        if (!formData.acknowledgment_studio) {
            toast.error('Please acknowledge the studio submission terms');
            return;
        }

        if (!formData.acknowledgment_rights) {
            toast.error('Please confirm rights ownership');
            return;
        }

        setIsSubmitting(true);

        try {
            // Store submission
            await base44.entities.StorygateSubmission.create({
                first_name: formData.first_name,
                last_name: formData.last_name,
                email: formData.email,
                phone: formData.phone,
                project_title: formData.project_title,
                format: formData.format,
                genre: formData.genre,
                genre_other: formData.genre_other,
                tone: formData.tone,
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
            <div className="relative overflow-hidden py-10 sm:py-20 border-b" style={{ borderColor: '#A98E4A' }}>
                <div className="relative max-w-4xl mx-auto px-6 text-center">
                    <Badge className="mb-2 px-4 py-2" style={{ backgroundColor: 'rgba(122, 30, 30, 0.1)', color: '#A98E4A', borderColor: '#A98E4A' }}>
                        <Sparkles className="w-4 h-4 mr-2" />
                        By RevisionGrade™
                    </Badge>
                    <h1 className="text-5xl font-bold mb-6" style={{ color: '#7A1E1E' }}>
                        Storygate Studio
                    </h1>
                    <p className="text-2xl mb-6" style={{ color: '#F2EFEA' }}>
                        A Selective Development Track for Exceptional Work
                    </p>
                    <p className="text-lg max-w-2xl mx-auto mb-6" style={{ color: '#D4D4D4' }}>
                        An invitation-based extension of RevisionGrade, created for projects that demonstrate 
                        unusual promise, originality, or depth.
                    </p>
                    <p className="text-base max-w-2xl mx-auto mb-8" style={{ color: '#D4D4D4' }}>
                        We work with high-potential projects across fiction, screen, and narrative nonfiction—whether aimed at traditional publishing, film/TV adaptation, or both.
                    </p>
                    <Button
                        onClick={() => document.getElementById('submission-form')?.scrollIntoView({ behavior: 'smooth' })}
                        className="h-12 px-8 hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: '#7A1E1E', color: '#F2EFEA' }}
                    >
                        Submit for Consideration
                    </Button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* What It Is */}
                <Card className="mb-8" style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
                    <CardContent className="pt-6 space-y-4" style={{ color: '#F2EFEA' }}>
                        <p style={{ color: '#7B7B7B' }} className="italic">
                            It is not a general submission service.
                        </p>
                        <p style={{ color: '#D4D4D4' }} className="font-semibold">
                            It is a curated environment for serious creative work.
                        </p>
                    </CardContent>
                </Card>

                {/* How It Works */}
                <Card className="mb-8" style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
                    <CardHeader>
                        <CardTitle style={{ color: '#7A1E1E' }}>How It Works</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4" style={{ color: '#D4D4D4' }}>
                        <p>
                            Submissions are reviewed internally.
                        </p>
                        <p>
                            A small number may be invited into further consideration.
                        </p>
                    </CardContent>
                </Card>

                {/* What It Is / Is Not */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    <Card style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
                        <CardHeader>
                            <CardTitle style={{ color: '#A98E4A' }} className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5" />
                                What Storygate Studio Is
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2" style={{ color: '#D4D4D4' }}>
                            <p>• A focused development pathway for high-potential work</p>
                            <p>• A professional review layer beyond automated analysis</p>
                            <p>• A bridge between promising material and deeper creative evaluation</p>
                        </CardContent>
                    </Card>

                    <Card style={{ borderColor: '#7A1E1E', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
                        <CardHeader>
                            <CardTitle style={{ color: '#7A1E1E' }} className="flex items-center gap-2">
                                <X className="w-5 h-5" />
                                What It Is Not
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2" style={{ color: '#D4D4D4' }}>
                            <p>• A general editing or critique service</p>
                            <p>• A guarantee of representation or publication</p>
                            <p>• A paid shortcut to access</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Review Pathways */}
                <Card className="mb-8" style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
                    <CardHeader>
                        <CardTitle style={{ color: '#7A1E1E' }}>Review Pathways</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4" style={{ color: '#D4D4D4' }}>
                        <div>
                            <p className="font-semibold" style={{ color: '#D4D4D4' }}>Initial Submission</p>
                            <p className="text-sm" style={{ color: '#7B7B7B' }}>All submissions are reviewed internally.</p>
                        </div>
                        <div>
                            <p className="font-semibold" style={{ color: '#D4D4D4' }}>Storygate Review Pass</p>
                            <p className="text-sm" style={{ color: '#7B7B7B' }}>Select projects may be invited into a structured review phase.</p>
                        </div>
                        <div>
                            <p className="font-semibold" style={{ color: '#D4D4D4' }}>Development Track</p>
                            <p className="text-sm" style={{ color: '#7B7B7B' }}>A limited number of projects may be invited into deeper collaboration.</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Pricing */}
                <Card className="mb-8" style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
                    <CardHeader>
                        <CardTitle style={{ color: '#7A1E1E' }}>Pricing & Engagement</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3" style={{ color: '#D4D4D4' }}>
                        <p>
                            <strong style={{ color: '#D4D4D4' }}>Submission to Storygate Studio is free.</strong>
                        </p>
                        <p className="text-sm" style={{ color: '#7B7B7B' }}>
                            All submissions are reviewed internally. A small number may be invited into further consideration. 
                            For selected projects, Storygate Studio may offer a paid engagement tailored to the scope and needs of the work. 
                            Pricing and terms are discussed only after a project has been reviewed.
                        </p>
                    </CardContent>
                </Card>

                {/* Final Note */}
                <Card className="mb-8" style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
                    <CardContent className="pt-6">
                        <p style={{ color: '#D4D4D4' }} className="text-center italic">
                            Storygate Studio exists for work that is already reaching toward something more.
                        </p>
                    </CardContent>
                </Card>

                {/* Submission Form */}
                <Card id="submission-form" style={{ borderColor: '#7A1E1E', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
                    <CardHeader>
                        <CardTitle style={{ color: '#7A1E1E' }}>Submit Your Project</CardTitle>
                        <p className="text-sm mt-2" style={{ color: '#7B7B7B' }}>
                            Each submission is reviewed internally. If your project aligns with our current focus, 
                            you may be contacted for next steps.
                        </p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Contact Information */}
                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                        First Name *
                                    </label>
                                    <Input
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                                        style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                        Last Name *
                                    </label>
                                    <Input
                                        value={formData.last_name}
                                        onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                                        style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                        Email *
                                    </label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                        style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                        Phone (Optional)
                                    </label>
                                    <Input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                        style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                    />
                                </div>
                            </div>

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
                                <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                    Format *
                                </label>
                                <Select 
                                    value={formData.format} 
                                    onValueChange={(value) => setFormData({...formData, format: value})}
                                >
                                    <SelectTrigger style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}>
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

                            {/* Primary Genre */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                    Primary Genre *
                                </label>
                                <Select 
                                    value={formData.genre} 
                                    onValueChange={(value) => setFormData({...formData, genre: value})}
                                >
                                    <SelectTrigger style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}>
                                        <SelectValue placeholder="Select primary genre" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="literary_fiction">Literary fiction</SelectItem>
                                        <SelectItem value="commercial_upmarket">Commercial / upmarket</SelectItem>
                                        <SelectItem value="thriller_suspense">Thriller / suspense</SelectItem>
                                        <SelectItem value="mystery_crime">Mystery / crime</SelectItem>
                                        <SelectItem value="science_fiction">Science fiction</SelectItem>
                                        <SelectItem value="fantasy">Fantasy</SelectItem>
                                        <SelectItem value="horror">Horror</SelectItem>
                                        <SelectItem value="historical_fiction">Historical fiction</SelectItem>
                                        <SelectItem value="romance">Romance</SelectItem>
                                        <SelectItem value="young_adult">Young adult (YA)</SelectItem>
                                        <SelectItem value="middle_grade">Middle grade (MG)</SelectItem>
                                        <SelectItem value="nonfiction">Nonfiction (memoir, narrative, essays, etc.)</SelectItem>
                                        <SelectItem value="other_cross_genre">Other / Cross-genre</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Genre Other (conditional) */}
                            {formData.genre === 'other_cross_genre' && (
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                        Please specify genre *
                                    </label>
                                    <Input
                                        value={formData.genre_other}
                                        onChange={(e) => setFormData({...formData, genre_other: e.target.value})}
                                        placeholder="e.g., Cli-fi thriller, Afrofuturism, etc."
                                        style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                        required
                                    />
                                </div>
                            )}

                            {/* Tone (optional) */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                    Tone (Optional)
                                </label>
                                <Input
                                    value={formData.tone}
                                    onChange={(e) => setFormData({...formData, tone: e.target.value})}
                                    placeholder="e.g., Dark, lyrical, satirical, intimate"
                                    style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                />
                                <p className="text-xs mt-1" style={{ color: '#7B7B7B' }}>
                                    Genre and tone are evaluated separately. Tone does not affect eligibility.
                                </p>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                    Brief Description (300–500 words) *
                                </label>
                                <Textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="Describe the project, its themes, and what makes it distinct."
                                    style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                    className="min-h-[200px]"
                                    required
                                />
                                <p className="text-xs mt-1" style={{ color: '#7B7B7B' }}>
                                    Word count: {formData.description.split(/\s+/).filter(w => w).length}
                                </p>
                            </div>

                            {/* Project Stage */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                    What stage is this project in? *
                                </label>
                                <Select 
                                    value={formData.project_stage} 
                                    onValueChange={(value) => setFormData({...formData, project_stage: value})}
                                >
                                    <SelectTrigger style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}>
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
                                <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
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
                                        <label key={option.value} className="flex items-center gap-2 cursor-pointer" style={{ color: '#D4D4D4' }}>
                                            <input
                                                type="checkbox"
                                                checked={formData.seeking.includes(option.value)}
                                                onChange={() => handleSeekingToggle(option.value)}
                                                className="rounded"
                                                style={{ borderColor: '#7B7B7B', backgroundColor: 'rgba(14, 14, 14, 0.6)' }}
                                            />
                                            {option.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Evaluation & Readiness */}
                            <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgba(169, 142, 74, 0.05)', borderWidth: '1px', borderColor: '#A98E4A' }}>
                                <h3 className="text-lg font-semibold mb-3" style={{ color: '#7A1E1E' }}>Evaluation & Readiness</h3>
                                <p className="text-sm mb-4" style={{ color: '#7B7B7B' }}>
                                    Storygate Studio prioritizes projects that meet a clear readiness threshold. You may qualify using a RevisionGrade evaluation or an equivalent professional evaluation.
                                </p>
                                
                                <div className="mb-4">
                                    <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                        Evaluation Source *
                                    </label>
                                    <Select 
                                        value={formData.evaluation_source} 
                                        onValueChange={(value) => setFormData({...formData, evaluation_source: value})}
                                    >
                                        <SelectTrigger style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}>
                                            <SelectValue placeholder="Select evaluation source" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="revisiongrade">RevisionGrade evaluation</SelectItem>
                                            <SelectItem value="external">External professional evaluation</SelectItem>
                                            <SelectItem value="none">No formal evaluation yet</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {formData.evaluation_source === 'revisiongrade' && (
                                    <div>
                                        <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                            RevisionGrade Score (0.0–10.0) *
                                        </label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="10"
                                            value={formData.revisiongrade_score}
                                            onChange={(e) => setFormData({...formData, revisiongrade_score: e.target.value})}
                                            style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                            required
                                        />
                                        <p className="text-xs mt-2" style={{ color: '#7B7B7B' }}>
                                            Projects with a RevisionGrade score of 8.0 or higher are prioritized for Storygate consideration.
                                        </p>
                                        {formData.revisiongrade_score && parseFloat(formData.revisiongrade_score) < 8.0 && (
                                            <div className="mt-2 p-3 rounded" style={{ backgroundColor: 'rgba(122, 30, 30, 0.1)', borderWidth: '1px', borderColor: '#7A1E1E' }}>
                                                <p className="text-xs flex items-start gap-2" style={{ color: '#7A1E1E' }}>
                                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                                    <span>Projects below 8.0/10 are considered not yet ready; you may still submit, but they are unlikely to advance at this time.</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {formData.evaluation_source === 'external' && (
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                                Evaluator Type *
                                            </label>
                                            <Input
                                                value={formData.evaluator_type}
                                                onChange={(e) => setFormData({...formData, evaluator_type: e.target.value})}
                                                placeholder="e.g., agent, editor, producer, third-party service"
                                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                                Evaluator Name or Organization *
                                            </label>
                                            <Input
                                                value={formData.evaluator_name}
                                                onChange={(e) => setFormData({...formData, evaluator_name: e.target.value})}
                                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                                Evaluation Date *
                                            </label>
                                            <Input
                                                type="date"
                                                value={formData.evaluation_date}
                                                onChange={(e) => setFormData({...formData, evaluation_date: e.target.value})}
                                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                                Summary Outcome *
                                            </label>
                                            <Textarea
                                                value={formData.evaluation_summary}
                                                onChange={(e) => setFormData({...formData, evaluation_summary: e.target.value})}
                                                placeholder="Brief summary of the evaluation outcome"
                                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                                className="min-h-[100px]"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                                Upload Evaluation PDF or Report (Optional but Recommended)
                                            </label>
                                            <div className="relative">
                                               <Input
                                                   type="file"
                                                   accept=".pdf"
                                                   onChange={(e) => {
                                                       const file = e.target.files?.[0];
                                                       if (file && file.size > 10 * 1024 * 1024) {
                                                           toast.error('File size must be less than 10MB');
                                                           e.target.value = '';
                                                           return;
                                                       }
                                                       setFormData({...formData, evaluation_file: file});
                                                   }}
                                                   style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                               />
                                               <Upload className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: '#A98E4A' }} />
                                            </div>
                                            <p className="text-xs mt-2" style={{ color: '#7B7B7B' }}>
                                                Equivalent professional evaluations should assess structure, readiness, clarity, and viability using a transparent, defensible methodology, and produce a clearly articulated evaluative outcome suitable for comparison.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {formData.evaluation_source === 'none' && (
                                    <div className="p-3 rounded" style={{ backgroundColor: 'rgba(169, 142, 74, 0.1)', borderWidth: '1px', borderColor: '#A98E4A' }}>
                                        <p className="text-sm" style={{ color: '#D4D4D4' }}>
                                            You can submit without a formal evaluation, but projects with a RevisionGrade score of 8.0+ or an equivalent professional evaluation are prioritized for deeper consideration.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Presentation Package */}
                            <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgba(169, 142, 74, 0.05)', borderWidth: '1px', borderColor: '#A98E4A' }}>
                                <h3 className="text-lg font-semibold mb-3" style={{ color: '#7A1E1E' }}>Presentation Package</h3>
                                <p className="text-sm mb-4" style={{ color: '#7B7B7B' }}>
                                    If available, upload a single professional presentation package (Film Adaptation Pitch Deck or equivalent) in PDF format. 
                                    This document is a development artifact, not a substitute for your full manuscript or script; 
                                    its purpose is to demonstrate clarity of concept, narrative cohesion, and industry awareness.
                                </p>
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                        Upload Presentation Package (PDF, Optional)
                                    </label>
                                    <div className="relative">
                                        <Input
                                            type="file"
                                            accept=".pdf"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file && file.size > 10 * 1024 * 1024) {
                                                    toast.error('File size must be less than 10MB');
                                                    e.target.value = '';
                                                    return;
                                                }
                                                setFormData({...formData, presentation_package: file});
                                            }}
                                            style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                        />
                                        <Upload className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: '#A98E4A' }} />
                                    </div>
                                </div>
                            </div>

                            {/* Why Storygate */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                    Why are you submitting to Storygate Studio, specifically? *
                                </label>
                                <p className="text-xs mb-2" style={{ color: '#7B7B7B' }}>
                                    (This helps us understand your goals and whether this is the right environment for your work.)
                                </p>
                                <Textarea
                                    value={formData.why_storygate}
                                    onChange={(e) => setFormData({...formData, why_storygate: e.target.value})}
                                    placeholder="What kind of collaboration are you seeking? Be honest."
                                    style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                    className="min-h-[120px]"
                                    required
                                />
                            </div>

                            {/* Optional Upload */}
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                    Optional Upload (Excerpt or Sample)
                                </label>
                                <p className="text-xs mb-2" style={{ color: '#7B7B7B' }}>
                                    Upload a writing sample, excerpt, or relevant document (PDF, DOC, DOCX, RTF, or TXT - max 10MB)
                                </p>
                                <div className="relative">
                                    <Input
                                        type="file"
                                        accept=".pdf,.doc,.docx,.rtf,.txt"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file && file.size > 10 * 1024 * 1024) {
                                                toast.error('File size must be less than 10MB');
                                                e.target.value = '';
                                                return;
                                            }
                                            setFormData({...formData, upload_file: file});
                                        }}
                                        style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                    />
                                    <Upload className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none" style={{ color: '#A98E4A' }} />
                                </div>
                            </div>

                            {/* Acknowledgment & Rights */}
                            <div className="p-6 rounded-lg space-y-4" style={{ backgroundColor: 'rgba(169, 142, 74, 0.1)', borderWidth: '1px', borderColor: '#A98E4A' }}>
                                <h3 className="text-sm font-semibold" style={{ color: '#7A1E1E' }}>Acknowledgment & Rights</h3>
                                <label className="flex items-start gap-3 cursor-pointer" style={{ color: '#D4D4D4' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.acknowledgment_studio}
                                        onChange={(e) => setFormData({...formData, acknowledgment_studio: e.target.checked})}
                                        className="mt-1 rounded"
                                        style={{ borderColor: '#7B7B7B', backgroundColor: 'rgba(14, 14, 14, 0.6)' }}
                                        required
                                    />
                                    <span className="text-sm">
                                        I understand that Storygate Studio cannot respond to all submissions and that 
                                        submission does not guarantee review, feedback, representation, publication, or production. *
                                    </span>
                                </label>
                                <label className="flex items-start gap-3 cursor-pointer" style={{ color: '#D4D4D4' }}>
                                    <input
                                        type="checkbox"
                                        checked={formData.acknowledgment_rights}
                                        onChange={(e) => setFormData({...formData, acknowledgment_rights: e.target.checked})}
                                        className="mt-1 rounded"
                                        style={{ borderColor: '#7B7B7B', backgroundColor: 'rgba(14, 14, 14, 0.6)' }}
                                        required
                                    />
                                    <span className="text-sm">
                                        I confirm that I own or control the rights to this work and am authorized to share it for professional consideration. *
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
            </div>
        </div>
    );
}