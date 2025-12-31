import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
    Crown, CheckCircle2, Target, Sparkles, ArrowRight,
    Shield, Users, TrendingUp, Star, Loader2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

export default function StoryGate() {
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
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
        why_storygate: ''
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            await base44.entities.StorygateSubmission.create({
                ...formData,
                status: 'pending_review'
            });

            setSubmitted(true);
            toast.success('Application submitted successfully!');
        } catch (error) {
            console.error('Submission error:', error);
            toast.error('Failed to submit application. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const toggleSeeking = (value) => {
        setFormData(prev => ({
            ...prev,
            seeking: prev.seeking.includes(value)
                ? prev.seeking.filter(v => v !== value)
                : [...prev.seeking, value]
        }));
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-950 to-black flex items-center justify-center p-6">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-2xl w-full"
                >
                    <Card className="border-2 border-amber-500 bg-gradient-to-br from-slate-900 to-slate-800 shadow-2xl">
                        <CardContent className="p-12 text-center">
                            <div className="inline-flex p-4 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 mb-6">
                                <CheckCircle2 className="w-12 h-12 text-white" />
                            </div>
                            <h2 className="text-3xl font-bold text-amber-400 mb-4">Application Received</h2>
                            <p className="text-slate-300 text-lg mb-6">
                                Your submission has been received and will be reviewed by our team.
                                We'll contact you within 7-10 business days.
                            </p>
                            <div className="space-y-3 text-sm text-slate-400">
                                <p>• Tier 1 (Auto-decline): Within 48 hours</p>
                                <p>• Tier 2 (Hold): Within 7 days</p>
                                <p>• Tier 3 (Priority review): Within 3-5 days</p>
                            </div>
                            <Link to={createPageUrl('Home')} className="inline-block mt-8">
                                <Button variant="outline" className="border-amber-500 text-amber-400 hover:bg-amber-500 hover:text-white">
                                    Return Home
                                </Button>
                            </Link>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-red-950 to-black">
            {/* Hero Section */}
            <div className="relative overflow-hidden py-20 border-b border-amber-500/20">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-transparent to-transparent" />
                <div className="relative max-w-4xl mx-auto px-6 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <Badge className="mb-6 px-6 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black border-0 text-base font-bold">
                            <Crown className="w-5 h-5 mr-2" />
                            Elite Development Track
                        </Badge>
                        <h1 className="text-5xl sm:text-6xl font-bold mb-6 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                            StoryGate Studio
                        </h1>
                        <p className="text-2xl text-amber-200 mb-4 font-light">
                            Professional Development for Exceptional Work
                        </p>
                        <p className="text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
                            A selective development track for manuscripts and screenplays demonstrating 
                            originality, craft mastery, and commercial readiness—evaluated by professional 
                            standards, developed with strategic editorial support.
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* What It Is */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <div className="grid md:grid-cols-3 gap-8 mb-16">
                    {[
                        {
                            icon: Target,
                            title: "Selective Entry",
                            description: "Not a contest. Not a vanity service. A curated development track for work that shows genuine market potential.",
                            color: "from-red-600 to-rose-600"
                        },
                        {
                            icon: TrendingUp,
                            title: "Professional Standards",
                            description: "Evaluated against the same criteria agents, editors, and producers use—not generic feedback.",
                            color: "from-amber-500 to-amber-600"
                        },
                        {
                            icon: Shield,
                            title: "Strategic Development",
                            description: "Direct editorial guidance to refine positioning, structure, and marketability—not just polish.",
                            color: "from-slate-600 to-slate-700"
                        }
                    ].map((feature, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            viewport={{ once: true }}
                        >
                            <Card className="h-full bg-gradient-to-br from-slate-800 to-slate-900 border-amber-500/20 hover:border-amber-500/40 transition-all">
                                <CardContent className="p-6">
                                    <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} mb-4`}>
                                        <feature.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <h3 className="text-xl font-bold text-amber-400 mb-3">{feature.title}</h3>
                                    <p className="text-slate-300 leading-relaxed">{feature.description}</p>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* How It Works */}
                <Card className="border-2 border-amber-500/30 bg-gradient-to-br from-slate-800 to-slate-900 mb-16">
                    <CardHeader>
                        <CardTitle className="text-2xl text-amber-400">How StoryGate Studio Works</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 text-slate-300">
                        <div className="space-y-4">
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold">1</div>
                                <div>
                                    <h4 className="font-semibold text-amber-300 mb-1">Submit Your Work</h4>
                                    <p>Complete the submission form below with your project details and description (300-500 words recommended).</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold">2</div>
                                <div>
                                    <h4 className="font-semibold text-amber-300 mb-1">Professional Triage</h4>
                                    <p>Internal review using RevisionGrade™ criteria + editorial judgment. Tier 1 (decline), Tier 2 (hold), or Tier 3 (priority review).</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-black font-bold">3</div>
                                <div>
                                    <h4 className="font-semibold text-amber-300 mb-1">Engagement Decision</h4>
                                    <p>If accepted: direct contact, scope definition, and development roadmap. Transparent pricing, no hidden costs.</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Submission Form */}
                <Card className="border-2 border-amber-500 bg-gradient-to-br from-slate-800 to-slate-900">
                    <CardHeader>
                        <CardTitle className="text-2xl text-amber-400">Submit Your Project</CardTitle>
                        <p className="text-slate-400 mt-2">All fields marked with * are required</p>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Contact Information */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold text-amber-300">Contact Information</h3>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            First Name *
                                        </label>
                                        <Input
                                            required
                                            value={formData.first_name}
                                            onChange={(e) => handleChange('first_name', e.target.value)}
                                            className="bg-slate-900/50 border-slate-700 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Last Name *
                                        </label>
                                        <Input
                                            required
                                            value={formData.last_name}
                                            onChange={(e) => handleChange('last_name', e.target.value)}
                                            className="bg-slate-900/50 border-slate-700 text-white"
                                        />
                                    </div>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Email *
                                        </label>
                                        <Input
                                            required
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => handleChange('email', e.target.value)}
                                            className="bg-slate-900/50 border-slate-700 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Phone (optional)
                                        </label>
                                        <Input
                                            value={formData.phone}
                                            onChange={(e) => handleChange('phone', e.target.value)}
                                            className="bg-slate-900/50 border-slate-700 text-white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Project Details */}
                            <div className="space-y-4 border-t border-slate-700 pt-6">
                                <h3 className="text-lg font-semibold text-amber-300">Project Details</h3>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Project Title *
                                    </label>
                                    <Input
                                        required
                                        value={formData.project_title}
                                        onChange={(e) => handleChange('project_title', e.target.value)}
                                        className="bg-slate-900/50 border-slate-700 text-white"
                                    />
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Format *
                                        </label>
                                        <select
                                            required
                                            value={formData.format}
                                            onChange={(e) => handleChange('format', e.target.value)}
                                            className="w-full px-3 py-2 rounded-md bg-slate-900/50 border border-slate-700 text-white"
                                        >
                                            <option value="">Select format</option>
                                            <option value="novel">Novel</option>
                                            <option value="feature_film">Feature Film Screenplay</option>
                                            <option value="series">Series (TV/Streaming)</option>
                                            <option value="memoir">Memoir</option>
                                            <option value="narrative_nonfiction">Narrative Nonfiction</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Primary Genre
                                        </label>
                                        <select
                                            value={formData.genre}
                                            onChange={(e) => handleChange('genre', e.target.value)}
                                            className="w-full px-3 py-2 rounded-md bg-slate-900/50 border border-slate-700 text-white"
                                        >
                                            <option value="">Select genre</option>
                                            <option value="literary_fiction">Literary Fiction</option>
                                            <option value="commercial_upmarket">Commercial/Upmarket Fiction</option>
                                            <option value="thriller_suspense">Thriller/Suspense</option>
                                            <option value="mystery_crime">Mystery/Crime</option>
                                            <option value="science_fiction">Science Fiction</option>
                                            <option value="fantasy">Fantasy</option>
                                            <option value="horror">Horror</option>
                                            <option value="historical_fiction">Historical Fiction</option>
                                            <option value="romance">Romance</option>
                                            <option value="young_adult">Young Adult</option>
                                            <option value="middle_grade">Middle Grade</option>
                                            <option value="nonfiction">Nonfiction</option>
                                            <option value="other_cross_genre">Other/Cross-genre</option>
                                        </select>
                                    </div>
                                </div>

                                {formData.genre === 'other_cross_genre' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-300 mb-2">
                                            Specify Genre/Cross-genre Details
                                        </label>
                                        <Input
                                            value={formData.genre_other}
                                            onChange={(e) => handleChange('genre_other', e.target.value)}
                                            placeholder="e.g., Literary sci-fi with horror elements"
                                            className="bg-slate-900/50 border-slate-700 text-white"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Tone & Style (separate from genre)
                                    </label>
                                    <Input
                                        value={formData.tone}
                                        onChange={(e) => handleChange('tone', e.target.value)}
                                        placeholder="e.g., Dark, lyrical, satirical, visceral"
                                        className="bg-slate-900/50 border-slate-700 text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Project Description * (300-500 words recommended)
                                    </label>
                                    <Textarea
                                        required
                                        value={formData.description}
                                        onChange={(e) => handleChange('description', e.target.value)}
                                        rows={8}
                                        placeholder="Describe your project: premise, characters, themes, what makes it unique..."
                                        className="bg-slate-900/50 border-slate-700 text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Current Stage
                                    </label>
                                    <select
                                        value={formData.project_stage}
                                        onChange={(e) => handleChange('project_stage', e.target.value)}
                                        className="w-full px-3 py-2 rounded-md bg-slate-900/50 border border-slate-700 text-white"
                                    >
                                        <option value="">Select stage</option>
                                        <option value="early_draft">Early Draft (first pass complete)</option>
                                        <option value="revised_draft">Revised Draft (multiple passes)</option>
                                        <option value="near_final">Near-Final (polished, seeking strategic input)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-3">
                                        What are you seeking from StoryGate Studio? (select all that apply)
                                    </label>
                                    <div className="space-y-2">
                                        {[
                                            { value: 'structural', label: 'Structural guidance (arc, pacing, stakes)' },
                                            { value: 'developmental', label: 'Developmental editing (deep revision support)' },
                                            { value: 'positioning', label: 'Positioning & marketability strategy' },
                                            { value: 'professional', label: 'Professional assessment (agent-ready evaluation)' },
                                            { value: 'direction', label: 'Creative direction (where to take this next)' }
                                        ].map(option => (
                                            <label key={option.value} className="flex items-center gap-3 text-slate-300 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.seeking.includes(option.value)}
                                                    onChange={() => toggleSeeking(option.value)}
                                                    className="w-4 h-4"
                                                />
                                                {option.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-2">
                                        Why StoryGate Studio? *
                                    </label>
                                    <Textarea
                                        required
                                        value={formData.why_storygate}
                                        onChange={(e) => handleChange('why_storygate', e.target.value)}
                                        rows={4}
                                        placeholder="Why are you submitting to StoryGate Studio specifically? What do you hope to achieve?"
                                        className="bg-slate-900/50 border-slate-700 text-white"
                                    />
                                </div>
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end pt-4">
                                <Button
                                    type="submit"
                                    disabled={submitting}
                                    className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black font-bold px-8 py-6 text-lg"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        <>
                                            Submit Application
                                            <ArrowRight className="w-5 h-5 ml-2" />
                                        </>
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Footer Disclaimer */}
                <Card className="mt-8 border-slate-700 bg-slate-800/50">
                    <CardContent className="p-6">
                        <p className="text-sm text-slate-400 leading-relaxed">
                            <strong className="text-amber-400">Transparency:</strong> StoryGate Studio is a selective development track. 
                            Submission does not guarantee acceptance, representation, or publication. All applicants receive a response. 
                            Tier 1 (not a fit) responses are automated. Tier 2 and 3 responses include brief feedback. 
                            Accepted projects are offered tailored development packages with transparent pricing.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}