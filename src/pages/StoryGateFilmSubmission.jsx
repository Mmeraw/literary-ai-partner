import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Film, Upload, CheckCircle2, Loader2, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function StoryGateFilmSubmission() {
    const [formData, setFormData] = useState({
        project_title: '',
        project_type: '',
        primary_genre: '',
        secondary_genre: '',
        creator_name: '',
        creator_email: '',
        linkedin_url: '',
        logline: '',
        synopsis: '',
        evaluation_type: '',
        intended_outcome: '',
        submission_file_url: null
    });
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [confirmations, setConfirmations] = useState({
        rights: false,
        selective: false,
        standards: false
    });

    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!validTypes.includes(file.type)) {
            toast.error('Please upload PDF or DOCX files only');
            return;
        }

        if (file.size > 25 * 1024 * 1024) {
            toast.error('File must be under 25MB');
            return;
        }

        setUploading(true);
        try {
            const { file_url } = await base44.integrations.Core.UploadFile({ file });
            setFormData(prev => ({ 
                ...prev, 
                submission_file_url: file_url,
                file_mime_type: file.type,
                file_size_mb: (file.size / (1024 * 1024)).toFixed(2)
            }));
            toast.success('File uploaded successfully');
        } catch (error) {
            toast.error('File upload failed');
        } finally {
            setUploading(false);
        }
    };

    const validateForm = () => {
        if (!formData.project_title || formData.project_title.length < 3) {
            toast.error('Project title must be at least 3 characters');
            return false;
        }

        if (!formData.logline || formData.logline.length < 40) {
            toast.error('Logline must be at least 40 characters');
            return false;
        }

        if (!formData.synopsis || formData.synopsis.length < 300) {
            toast.error('Synopsis must be at least 300 characters');
            return false;
        }

        if (!confirmations.rights || !confirmations.selective || !confirmations.standards) {
            toast.error('Please confirm all acknowledgments');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setSubmitting(true);
        try {
            const { data } = await base44.functions.invoke('submitStoryGateFilm', formData);

            if (data.success) {
                setSubmitted(true);
                toast.success('Submission received');
            } else {
                toast.error(data.error || 'Submission failed');
            }
        } catch (error) {
            toast.error('Failed to submit');
        } finally {
            setSubmitting(false);
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
                        Your project has been received. You will be notified if it advances to the next review stage.
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
            {/* Header */}
            <div className="relative overflow-hidden py-10 sm:py-16 border-b" style={{ borderColor: '#A98E4A' }}>
                <div className="relative max-w-4xl mx-auto px-6 text-center">
                    <Badge className="mb-2 px-4 py-2" style={{ backgroundColor: 'rgba(122, 30, 30, 0.1)', color: '#A98E4A', borderColor: '#A98E4A' }}>
                        <Film className="w-4 h-4 mr-2" />
                        Film Adaptation Submission
                    </Badge>
                    <h1 className="text-4xl font-bold mb-4" style={{ color: '#7A1E1E' }}>
                        StoryGate Film Submission
                    </h1>
                    <p className="text-lg max-w-2xl mx-auto" style={{ color: '#D4D4D4' }}>
                        Submit a professionally prepared film or series project for curated review under StoryGate evaluation standards.
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto px-6 py-12 space-y-8">
                {/* Section 1: Project Identification */}
                <Card style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
                    <CardHeader>
                        <CardTitle style={{ color: '#7A1E1E' }}>Project Identification</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                Project Title *
                            </label>
                            <Input
                                value={formData.project_title}
                                onChange={(e) => setFormData({...formData, project_title: e.target.value})}
                                placeholder="Enter your project title"
                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                Project Type *
                            </label>
                            <Select value={formData.project_type} onValueChange={(value) => setFormData({...formData, project_type: value})}>
                                <SelectTrigger style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}>
                                    <SelectValue placeholder="Select project type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Feature Film">Feature Film</SelectItem>
                                    <SelectItem value="Limited Series">Limited Series</SelectItem>
                                    <SelectItem value="Series">Series (Multi-Season)</SelectItem>
                                    <SelectItem value="Narrative Nonfiction">Narrative Nonfiction</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                    Primary Genre *
                                </label>
                                <Input
                                    value={formData.primary_genre}
                                    onChange={(e) => setFormData({...formData, primary_genre: e.target.value})}
                                    placeholder="e.g., Crime Thriller"
                                    style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                    Secondary Genre (Optional)
                                </label>
                                <Input
                                    value={formData.secondary_genre}
                                    onChange={(e) => setFormData({...formData, secondary_genre: e.target.value})}
                                    placeholder="e.g., Prestige Drama"
                                    style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Section 2: Creator Information */}
                <Card style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
                    <CardHeader>
                        <CardTitle style={{ color: '#7A1E1E' }}>Creator Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                    Name *
                                </label>
                                <Input
                                    value={formData.creator_name}
                                    onChange={(e) => setFormData({...formData, creator_name: e.target.value})}
                                    style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                    Email *
                                </label>
                                <Input
                                    type="email"
                                    value={formData.creator_email}
                                    onChange={(e) => setFormData({...formData, creator_email: e.target.value})}
                                    style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                LinkedIn Profile URL (Optional)
                            </label>
                            <p className="text-xs mb-2" style={{ color: '#7B7B7B' }}>
                                Used only to verify professional background. No data is shared publicly.
                            </p>
                            <Input
                                value={formData.linkedin_url}
                                onChange={(e) => setFormData({...formData, linkedin_url: e.target.value})}
                                placeholder="https://www.linkedin.com/in/yourprofile"
                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Section 3: Core Materials */}
                <Card style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
                    <CardHeader>
                        <CardTitle style={{ color: '#7A1E1E' }}>Project Materials</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                Logline (40-400 characters) *
                            </label>
                            <p className="text-xs mb-2" style={{ color: '#7B7B7B' }}>
                                A concise 1-2 sentence summary of the core story or concept.
                            </p>
                            <Textarea
                                value={formData.logline}
                                onChange={(e) => setFormData({...formData, logline: e.target.value})}
                                placeholder="When a [protagonist] must [challenge/goal], they [obstacle/choice] to [stakes/outcome]."
                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                className="min-h-[100px]"
                                required
                            />
                            <p className="text-xs mt-1" style={{ color: '#7B7B7B' }}>
                                {formData.logline.length} characters
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                Synopsis (300-2000 characters) *
                            </label>
                            <p className="text-xs mb-2" style={{ color: '#7B7B7B' }}>
                                Provide a clear, structured overview of the narrative, major turns, and scope.
                            </p>
                            <Textarea
                                value={formData.synopsis}
                                onChange={(e) => setFormData({...formData, synopsis: e.target.value})}
                                placeholder="Describe story progression, character arcs, and thematic resonance..."
                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                className="min-h-[200px]"
                                required
                            />
                            <p className="text-xs mt-1" style={{ color: '#7B7B7B' }}>
                                {formData.synopsis.length} characters
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                Upload Supporting File (Optional)
                            </label>
                            <p className="text-xs mb-2" style={{ color: '#7B7B7B' }}>
                                Upload a pitch deck, treatment, or manuscript excerpt (PDF, DOC, DOCX, RTF, or TXT - max 25MB).
                            </p>
                            <input
                                type="file"
                                accept=".pdf,.doc,.docx,.rtf,.txt"
                                onChange={handleFileUpload}
                                className="hidden"
                                id="file-upload"
                                disabled={uploading}
                            />
                            <label htmlFor="file-upload">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={uploading}
                                    asChild
                                    className="w-full"
                                    style={{ borderColor: '#A98E4A', color: '#F2EFEA', backgroundColor: 'transparent' }}
                                >
                                    <span className="cursor-pointer flex items-center justify-center">
                                        {uploading ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Uploading...
                                            </>
                                        ) : formData.submission_file_url ? (
                                            <>
                                                <CheckCircle2 className="w-4 h-4 mr-2" style={{ color: '#A98E4A' }} />
                                                File Uploaded
                                            </>
                                        ) : (
                                            <>
                                                <Upload className="w-4 h-4 mr-2" />
                                                Choose File
                                            </>
                                        )}
                                    </span>
                                </Button>
                            </label>
                        </div>
                    </CardContent>
                </Card>

                {/* Section 4: Evaluation Context */}
                <Card style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
                    <CardHeader>
                        <CardTitle style={{ color: '#7A1E1E' }}>Evaluation Context</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                Evaluation Type *
                            </label>
                            <Select value={formData.evaluation_type} onValueChange={(value) => setFormData({...formData, evaluation_type: value})}>
                                <SelectTrigger style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}>
                                    <SelectValue placeholder="Select evaluation type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Film Adaptation">Film Adaptation</SelectItem>
                                    <SelectItem value="Series Development">Series Development</SelectItem>
                                    <SelectItem value="Narrative Review">Narrative Review</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                Intended Outcome *
                            </label>
                            <Select value={formData.intended_outcome} onValueChange={(value) => setFormData({...formData, intended_outcome: value})}>
                                <SelectTrigger style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}>
                                    <SelectValue placeholder="Select intended outcome" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Film">Film Development</SelectItem>
                                    <SelectItem value="Television">Television Development</SelectItem>
                                    <SelectItem value="Publishing">Publishing Consideration</SelectItem>
                                    <SelectItem value="Cross-Platform">Cross-Media Adaptation</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Section 5: Confirmation */}
                <Card style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(169, 142, 74, 0.1)', borderRadius: '0.5rem' }}>
                    <CardHeader>
                        <CardTitle style={{ color: '#7A1E1E' }}>Confirmation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <label className="flex items-start gap-3 cursor-pointer" style={{ color: '#D4D4D4' }}>
                            <input
                                type="checkbox"
                                checked={confirmations.rights}
                                onChange={(e) => setConfirmations({...confirmations, rights: e.target.checked})}
                                className="mt-1"
                                required
                            />
                            <span className="text-sm">
                                I confirm this work is original or I hold the rights to submit it for evaluation.
                            </span>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer" style={{ color: '#D4D4D4' }}>
                            <input
                                type="checkbox"
                                checked={confirmations.selective}
                                onChange={(e) => setConfirmations({...confirmations, selective: e.target.checked})}
                                className="mt-1"
                                required
                            />
                            <span className="text-sm">
                                I understand this is a selective review process and submission does not guarantee representation, feedback, or response.
                            </span>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer" style={{ color: '#D4D4D4' }}>
                            <input
                                type="checkbox"
                                checked={confirmations.standards}
                                onChange={(e) => setConfirmations({...confirmations, standards: e.target.checked})}
                                className="mt-1"
                                required
                            />
                            <span className="text-sm">
                                I agree to evaluation under StoryGate professional standards and criteria.
                            </span>
                        </label>
                    </CardContent>
                </Card>

                {/* Submit Button */}
                <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-12 hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#7A1E1E', color: '#F2EFEA' }}
                >
                    {submitting ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Submitting...
                        </>
                    ) : (
                        <>
                            <Shield className="w-5 h-5 mr-2" />
                            Submit for Review
                        </>
                    )}
                </Button>
            </form>
        </div>
    );
}