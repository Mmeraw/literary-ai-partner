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
    Upload,
    HelpCircle
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import DocumentSelector from '@/components/DocumentSelector';
import StorygateStudioFAQ from '@/components/storygate/StorygateStudioFAQ';

export default function StorygateStudio() {
    const [selectedDocumentId, setSelectedDocumentId] = useState(null);
    const [primaryPath, setPrimaryPath] = useState('');
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
        evaluationSource: '',
        evaluationScore: '',
        evaluationReportId: '',
        evaluatorType: '',
        evaluatorName: '',
        evaluationDate: '',
        evaluationSummary: '',
        queryLetterText: '',
        synopsisText: '',
        authorBioText: '',
        marketNotesText: '',
        loglineText: '',
        adaptationPitchText: '',
        filmDeckFile: null,
        sourceWorkType: '',
        sourceMaterialFile: null,
        why_storygate: '',
        acknowledgment_studio: false,
        acknowledgment_rights: false
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [screeningResult, setScreeningResult] = useState(null);

    const handleDocumentSelect = async (docId) => {
        setSelectedDocumentId(docId);
        const doc = await base44.entities.Document.get(docId);
        if (doc.content_reference_id) {
            const manuscript = await base44.entities.Manuscript.get(doc.content_reference_id);
            setFormData(prev => ({
                ...prev,
                project_title: manuscript.title || '',
                description: manuscript.spine_evaluation?.logline || '',
                evaluationSource: 'RevisionGrade',
                evaluationScore: manuscript.revisiongrade_overall?.toString() || manuscript.spine_score?.toString() || '',
                evaluationReportId: manuscript.id
            }));
            toast.success('Manuscript loaded from Dashboard');
        }
    };



    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!primaryPath) {
            toast.error('Please select a submission track (Manuscript or Screen)');
            return;
        }

        if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.email.trim()) {
            toast.error('Contact information is required');
            return;
        }

        if (!formData.project_title.trim()) {
            toast.error('Project title is required');
            return;
        }

        if (!formData.evaluationSource) {
            toast.error('Evaluation source is required');
            return;
        }

        if (!formData.evaluationScore) {
            toast.error('Evaluation score is required');
            return;
        }

        if (formData.evaluationSource === 'Equivalent' && !formData.evaluationReportId?.trim()) {
            toast.error('Evaluation Report ID/Link is required for external evaluations');
            return;
        }

        if (!formData.why_storygate.trim()) {
            toast.error('Please explain why you are submitting to Storygate Studio');
            return;
        }

        // Track-specific validation
        if (primaryPath === 'MANUSCRIPT') {
            if (!formData.queryLetterText || !formData.synopsisText || !formData.authorBioText) {
                toast.error('Manuscript track requires: Query Letter, Synopsis, and Author Bio');
                return;
            }
        } else if (primaryPath === 'SCREEN') {
            if (!formData.loglineText || !formData.adaptationPitchText || !formData.authorBioText || !formData.sourceWorkType) {
                toast.error('Screen track requires: Logline, Adaptation Pitch, Author Bio, and Source Work Type');
                return;
            }
            if (!formData.filmDeckFile) {
                toast.error('Screen track requires a Film/TV Pitch Deck');
                return;
            }
        }

        if (!formData.acknowledgment_studio || !formData.acknowledgment_rights) {
            toast.error('Please acknowledge all required terms');
            return;
        }

        setIsSubmitting(true);

        try {
            // Upload files if present
            let filmDeckFileId = null;
            let sourceMaterialFileId = null;

            if (formData.filmDeckFile) {
                const { file_url } = await base44.integrations.Core.UploadFile({ file: formData.filmDeckFile });
                filmDeckFileId = file_url;
            }

            if (formData.sourceMaterialFile) {
                const { file_url } = await base44.integrations.Core.UploadFile({ file: formData.sourceMaterialFile });
                sourceMaterialFileId = file_url;
            }

            // Create submission
            const submission = await base44.entities.StorygateSubmission.create({
                primaryPath,
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
                why_storygate: formData.why_storygate,
                evaluationSource: formData.evaluationSource,
                evaluationScore: parseFloat(formData.evaluationScore),
                evaluationReportId: formData.evaluationReportId,
                evaluatorType: formData.evaluatorType,
                evaluatorName: formData.evaluatorName,
                evaluationDate: formData.evaluationDate,
                evaluationSummary: formData.evaluationSummary,
                queryLetterText: formData.queryLetterText,
                synopsisText: formData.synopsisText,
                authorBioText: formData.authorBioText,
                marketNotesText: formData.marketNotesText,
                loglineText: formData.loglineText,
                adaptationPitchText: formData.adaptationPitchText,
                filmDeckFileId,
                sourceWorkType: formData.sourceWorkType,
                sourceMaterialFileId,
                status: 'pending_review'
            });

            // Run screening
            const screeningResponse = await base44.functions.invoke('screenStorygateSubmission', {
                submission_id: submission.id
            });

            const result = screeningResponse.data;
            setScreeningResult(result);
            setSubmitted(true);

        } catch (error) {
            console.error('Submission error:', error);
            toast.error('Failed to submit. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (submitted && screeningResult) {
        const isDeclined = screeningResult.screeningStatus === 'AUTO_DECLINED';
        
        return (
            <div className="min-h-screen" style={{ backgroundColor: '#0E0E0E' }}>
                <div className="max-w-2xl mx-auto px-6 py-24">
                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" 
                             style={{ backgroundColor: isDeclined ? '#7B7B7B' : '#7A1E1E' }}>
                            {isDeclined ? (
                                <AlertCircle className="w-8 h-8" style={{ color: '#F2EFEA' }} />
                            ) : (
                                <CheckCircle2 className="w-8 h-8" style={{ color: '#F2EFEA' }} />
                            )}
                        </div>
                        <h1 className="text-3xl font-bold mb-4" style={{ color: '#7A1E1E' }}>
                            {isDeclined ? 'Not Advanced to Review' : 'Submission Received'}
                        </h1>
                    </div>

                    {isDeclined ? (
                        <Card style={{ borderColor: '#7A1E1E', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                            <CardContent className="pt-6 space-y-4">
                                <div>
                                    <p className="font-semibold mb-2" style={{ color: '#F2EFEA' }}>
                                        Status: Not advanced to internal Storygate review
                                    </p>
                                    <div className="space-y-2">
                                        {screeningResult.feedbackMessages?.map((msg, idx) => (
                                            <p key={idx} className="text-sm" style={{ color: '#D4D4D4' }}>
                                                • {msg}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                                {screeningResult.disclaimer && (
                                    <div className="pt-4 border-t" style={{ borderColor: '#7B7B7B' }}>
                                        <p className="text-sm italic" style={{ color: '#7B7B7B' }}>
                                            {screeningResult.disclaimer}
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="text-center space-y-4">
                            <p className="text-lg" style={{ color: '#F2EFEA' }}>
                                Your submission has been received and is eligible for internal consideration.
                            </p>
                            <p className="text-sm" style={{ color: '#7B7B7B' }}>
                                Storygate Studio cannot respond to all eligible submissions. Internal review and follow-up communication are not guaranteed.
                            </p>
                            <p className="text-sm" style={{ color: '#7B7B7B' }}>
                                Your submission status is independent of your subscription. Downgrading or canceling your RevisionGrade subscription does not affect your Storygate Studio submission.
                            </p>
                        </div>
                    )}
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
                            <p>• A guarantee of representation, publication, or production</p>
                            <p>• A paid shortcut to access or visibility</p>
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
                            <p className="font-semibold" style={{ color: '#D4D4D4' }}>Automatic Screening</p>
                            <p className="text-sm" style={{ color: '#7B7B7B' }}>All submissions are screened automatically. Submissions that meet the readiness threshold (8.0/10 or higher) enter the eligible queue, and a limited number may be invited to the Storygate Review Pass. Submissions below this threshold are declined without human review; some may receive brief, structured feedback derived from existing evaluation data, but no bespoke commentary will be provided.</p>
                        </div>
                        <div>
                            <p className="font-semibold" style={{ color: '#D4D4D4' }}>Storygate Review Pass</p>
                            <p className="text-sm italic mb-1" style={{ color: '#7B7B7B' }}>(Internal human review; no guarantee of response)</p>
                            <p className="text-sm" style={{ color: '#7B7B7B' }}>A limited number of eligible projects may be invited into a structured internal review phase. Internal review and follow-up communication are not guaranteed.</p>
                        </div>
                        <div>
                            <p className="font-semibold" style={{ color: '#D4D4D4' }}>Development Track</p>
                            <p className="text-sm italic mb-1" style={{ color: '#7B7B7B' }}>(Invitation-only collaboration; may involve paid engagement)</p>
                            <p className="text-sm" style={{ color: '#7B7B7B' }}>A very small number of projects may be invited into deeper collaboration or development. Participation is by invitation only.</p>
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
                            Evaluation, revision, and development tools (including RevisionGrade analysis and Film/TV adaptation packages) are separate paid services and are not required to maintain a Storygate Studio submission.
                        </p>
                        <p className="text-sm" style={{ color: '#7B7B7B' }}>
                            For projects invited into deeper engagement, Storygate Studio may offer a paid development arrangement tailored to the scope of the work. Pricing and terms are discussed only after a project has been selected for internal human review.
                        </p>
                        <p className="text-sm" style={{ color: '#7B7B7B' }}>
                            A Storygate Studio submission remains on file regardless of subscription status (until the user removes it); subscriptions apply to tools and services, not to waiting or continued eligibility.
                        </p>
                    </CardContent>
                </Card>

                {/* Human Review Disclosure */}
                <Card className="mb-8" style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
                    <CardContent className="pt-6 space-y-4">
                        <div>
                            <p className="text-sm font-semibold mb-2" style={{ color: '#7A1E1E' }}>Human Review Disclosure</p>
                            <p className="text-sm mb-3" style={{ color: '#D4D4D4' }}>
                                Storygate Studio is the only environment within RevisionGrade where human reviewers may read submitted work.
                            </p>
                            <p className="text-sm" style={{ color: '#7B7B7B' }}>
                                Human review occurs only after:
                            </p>
                            <ul className="text-sm mt-2 space-y-1" style={{ color: '#7B7B7B' }}>
                                <li>• The author explicitly submits to Storygate Studio, and</li>
                                <li>• The submission meets the readiness threshold and is selected for internal human review.</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                {/* Submission Form */}
                <Card id="submission-form" style={{ borderColor: '#7A1E1E', backgroundColor: 'rgba(14, 14, 14, 0.8)', borderRadius: '0.5rem' }}>
                    <CardHeader>
                        <CardTitle style={{ color: '#7A1E1E' }}>Submit Your Project</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Evaluation & Readiness (MOVED UP - Critical Gate) */}
                            <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgba(169, 142, 74, 0.05)', borderWidth: '2px', borderColor: '#A98E4A' }}>
                                <h3 className="text-lg font-semibold mb-3" style={{ color: '#7A1E1E' }}>Evaluation & Readiness *</h3>
                                <p className="text-sm mb-4" style={{ color: '#7B7B7B' }}>
                                    Storygate Studio eligibility requires a verified readiness score of 8.0/10 or higher from RevisionGrade or an accepted professional evaluation. Submissions below this threshold are declined automatically. Projects above this threshold enter the eligible queue, though invitation to human review is not guaranteed.
                                </p>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                            Evaluation Source *
                                        </label>
                                        <Select 
                                            value={formData.evaluationSource} 
                                            onValueChange={(value) => setFormData({...formData, evaluationSource: value})}
                                        >
                                            <SelectTrigger style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}>
                                                <SelectValue placeholder="Select evaluation source" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="RevisionGrade">RevisionGrade evaluation</SelectItem>
                                                <SelectItem value="Equivalent">External professional evaluation</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                            Overall Readiness Score (0.0–10.0) *
                                        </label>
                                        <Input
                                            type="number"
                                            step="0.1"
                                            min="0"
                                            max="10"
                                            value={formData.evaluationScore}
                                            onChange={(e) => setFormData({...formData, evaluationScore: e.target.value})}
                                            style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                            required
                                        />
                                        <p className="text-xs mt-2" style={{ color: '#7B7B7B' }}>
                                            Score of 8.0+ required for consideration.
                                        </p>
                                        {formData.evaluationScore && parseFloat(formData.evaluationScore) < 8.0 && (
                                            <div className="mt-2 p-3 rounded" style={{ backgroundColor: 'rgba(122, 30, 30, 0.1)', borderWidth: '1px', borderColor: '#7A1E1E' }}>
                                                <p className="text-xs flex items-start gap-2" style={{ color: '#7A1E1E' }}>
                                                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                                    <span>Projects below 8.0/10 will be automatically declined.</span>
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {formData.evaluationSource === 'Equivalent' && (
                                        <div className="space-y-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(14, 14, 14, 0.3)', borderWidth: '1px', borderColor: '#7B7B7B' }}>
                                            <div>
                                                <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                                    Evaluator Type *
                                                </label>
                                                <Input
                                                    value={formData.evaluatorType}
                                                    onChange={(e) => setFormData({...formData, evaluatorType: e.target.value})}
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
                                                    value={formData.evaluatorName}
                                                    onChange={(e) => setFormData({...formData, evaluatorName: e.target.value})}
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
                                                    value={formData.evaluationDate}
                                                    onChange={(e) => setFormData({...formData, evaluationDate: e.target.value})}
                                                    style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                                    Summary Outcome *
                                                </label>
                                                <Textarea
                                                    value={formData.evaluationSummary}
                                                    onChange={(e) => setFormData({...formData, evaluationSummary: e.target.value})}
                                                    placeholder="Brief summary of the evaluation outcome"
                                                    style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                                    className="min-h-[100px]"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    )}

                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-medium mb-2" style={{ color: formData.evaluationSource === 'Equivalent' ? '#F2EFEA' : '#D4D4D4' }}>
                                            Evaluation Report ID / Link {formData.evaluationSource === 'Equivalent' ? '*' : '(Optional)'}
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <HelpCircle className="w-4 h-4 cursor-help" style={{ color: '#7B7B7B' }} />
                                                    </TooltipTrigger>
                                                    <TooltipContent className="max-w-xs" style={{ backgroundColor: 'rgba(14, 14, 14, 0.95)', borderColor: '#7B7B7B' }}>
                                                        <p className="text-xs mb-2" style={{ color: '#F2EFEA' }}>
                                                            <strong>For RevisionGrade evaluations:</strong>
                                                        </p>
                                                        <p className="text-xs mb-3" style={{ color: '#D4D4D4' }}>
                                                            Your manuscript ID from the RevisionGrade Dashboard (auto-filled if you selected a document above)
                                                        </p>
                                                        <p className="text-xs mb-2" style={{ color: '#F2EFEA' }}>
                                                            <strong>For external evaluations:</strong>
                                                        </p>
                                                        <p className="text-xs" style={{ color: '#D4D4D4' }}>
                                                            Provide any verifiable reference: report URL, evaluator contact email, agency reference number, or third-party service report ID
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </label>
                                        {formData.evaluationSource === 'Equivalent' && (
                                            <p className="text-xs mb-2" style={{ color: '#7B7B7B' }}>
                                                Required for external evaluations to verify authenticity
                                            </p>
                                        )}
                                        <Input
                                            value={formData.evaluationReportId}
                                            onChange={(e) => setFormData({...formData, evaluationReportId: e.target.value})}
                                            placeholder="e.g., manuscript ID, report URL, evaluator contact"
                                            style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                            required={formData.evaluationSource === 'Equivalent'}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Primary Path Selection */}
                            <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgba(122, 30, 30, 0.1)', borderWidth: '2px', borderColor: '#7A1E1E' }}>
                                <h3 className="text-lg font-semibold mb-3" style={{ color: '#7A1E1E' }}>Submission Track *</h3>
                                <p className="text-sm mb-4" style={{ color: '#D4D4D4' }}>
                                    Choose your primary path.
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => setPrimaryPath('MANUSCRIPT')}
                                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                                            primaryPath === 'MANUSCRIPT'
                                                ? 'border-indigo-500 bg-indigo-50/10'
                                                : 'border-slate-600 hover:border-slate-500'
                                        }`}
                                    >
                                        <h4 className="font-semibold mb-1" style={{ color: primaryPath === 'MANUSCRIPT' ? '#A98E4A' : '#D4D4D4' }}>
                                            Manuscript / Publishing
                                        </h4>
                                        <p className="text-xs" style={{ color: '#7B7B7B' }}>
                                            Query letter, synopsis, author bio
                                        </p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPrimaryPath('SCREEN')}
                                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                                            primaryPath === 'SCREEN'
                                                ? 'border-indigo-500 bg-indigo-50/10'
                                                : 'border-slate-600 hover:border-slate-500'
                                        }`}
                                    >
                                        <h4 className="font-semibold mb-1" style={{ color: primaryPath === 'SCREEN' ? '#A98E4A' : '#D4D4D4' }}>
                                            Screen / Adaptation
                                        </h4>
                                        <p className="text-xs" style={{ color: '#7B7B7B' }}>
                                            Logline, adaptation pitch, Film/TV Pitch Deck (required), author bio; source material optional
                                        </p>
                                    </button>
                                </div>
                            </div>

                            {/* Document Selector */}
                            {primaryPath && (
                                <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgba(169, 142, 74, 0.05)', borderWidth: '1px', borderColor: '#A98E4A' }}>
                                    <h3 className="text-lg font-semibold mb-3" style={{ color: '#7A1E1E' }}>Select Your Work (Optional)</h3>
                                    <DocumentSelector
                                        value={selectedDocumentId}
                                        onChange={handleDocumentSelect}
                                        filterType="MANUSCRIPT"
                                        title="Choose from Dashboard Library"
                                        description="Auto-populates evaluation score and project details (8.0+ required)"
                                    />
                                </div>
                            )}

                            {/* Privacy Notice */}
                            <div className="p-4 rounded-lg" style={{ backgroundColor: 'rgba(14, 14, 14, 0.3)', borderWidth: '1px', borderColor: '#7B7B7B' }}>
                                <p className="text-xs" style={{ color: '#D4D4D4' }}>
                                    <strong>Your data is private.</strong> Information you provide is used for evaluation and consideration only. 
                                    No submission data is used for model training, shared with third parties, or sold.
                                </p>
                            </div>

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



                            {/* Track-Specific Materials */}
                            {primaryPath === 'MANUSCRIPT' && (
                                <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgba(169, 142, 74, 0.05)', borderWidth: '1px', borderColor: '#A98E4A' }}>
                                    <h3 className="text-lg font-semibold mb-3" style={{ color: '#7A1E1E' }}>Manuscript Track Materials</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                                Query Letter (includes pitch/hook) *
                                            </label>
                                            <Textarea
                                                value={formData.queryLetterText}
                                                onChange={(e) => setFormData({...formData, queryLetterText: e.target.value})}
                                                placeholder="Your complete query letter with pitch paragraph..."
                                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                                className="min-h-[200px]"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                                Synopsis *
                                            </label>
                                            <Textarea
                                                value={formData.synopsisText}
                                                onChange={(e) => setFormData({...formData, synopsisText: e.target.value})}
                                                placeholder="Your professional synopsis..."
                                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                                className="min-h-[150px]"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                                Author Bio *
                                            </label>
                                            <Textarea
                                                value={formData.authorBioText}
                                                onChange={(e) => setFormData({...formData, authorBioText: e.target.value})}
                                                placeholder="Your professional author bio..."
                                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                                className="min-h-[100px]"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                                Market Notes (Optional)
                                            </label>
                                            <Textarea
                                                value={formData.marketNotesText}
                                                onChange={(e) => setFormData({...formData, marketNotesText: e.target.value})}
                                                placeholder="Optional market positioning notes..."
                                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                                className="min-h-[80px]"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {primaryPath === 'SCREEN' && (
                                <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgba(169, 142, 74, 0.05)', borderWidth: '1px', borderColor: '#A98E4A' }}>
                                    <h3 className="text-lg font-semibold mb-3" style={{ color: '#7A1E1E' }}>Screen Track Materials</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                                Logline *
                                            </label>
                                            <Textarea
                                                value={formData.loglineText}
                                                onChange={(e) => setFormData({...formData, loglineText: e.target.value})}
                                                placeholder="One-sentence logline for your project..."
                                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                                className="min-h-[60px]"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                                Adaptation Pitch *
                                            </label>
                                            <Textarea
                                                value={formData.adaptationPitchText}
                                                onChange={(e) => setFormData({...formData, adaptationPitchText: e.target.value})}
                                                placeholder="Your adaptation pitch text..."
                                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                                className="min-h-[150px]"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                                Film/TV Pitch Deck (PDF) *
                                            </label>
                                            <p className="text-xs mb-2" style={{ color: '#7B7B7B' }}>
                                                Required for Screen/Adaptation track. This is your primary pitch material.
                                            </p>
                                            <Input
                                                type="file"
                                                accept=".pdf"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file && file.size > 25 * 1024 * 1024) {
                                                        toast.error('File must be under 25MB');
                                                        e.target.value = '';
                                                        return;
                                                    }
                                                    setFormData({...formData, filmDeckFile: file});
                                                }}
                                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                                Author Bio *
                                            </label>
                                            <Textarea
                                                value={formData.authorBioText}
                                                onChange={(e) => setFormData({...formData, authorBioText: e.target.value})}
                                                placeholder="Your professional author bio..."
                                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                                className="min-h-[100px]"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                                Source Work Type *
                                            </label>
                                            <Select 
                                                value={formData.sourceWorkType} 
                                                onValueChange={(value) => setFormData({...formData, sourceWorkType: value})}
                                            >
                                                <SelectTrigger style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}>
                                                    <SelectValue placeholder="Select source type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="NOVEL">Novel</SelectItem>
                                                    <SelectItem value="SERIES">Series</SelectItem>
                                                    <SelectItem value="OTHER">Other</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2" style={{ color: '#D4D4D4' }}>
                                                Source Material (Optional)
                                            </label>
                                            <p className="text-xs mb-2" style={{ color: '#7B7B7B' }}>
                                                Upload the underlying work this adaptation is based on. This is not a replacement for your Film/TV Pitch Deck.
                                            </p>
                                            <Input
                                                type="file"
                                                accept=".pdf,.doc,.docx,.txt"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file && file.size > 25 * 1024 * 1024) {
                                                        toast.error('File must be under 25MB');
                                                        e.target.value = '';
                                                        return;
                                                    }
                                                    setFormData({...formData, sourceMaterialFile: file});
                                                }}
                                                style={{ backgroundColor: 'rgba(14, 14, 14, 0.6)', borderColor: '#7B7B7B', color: '#F2EFEA' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}



                            {/* Why Storygate (shown for all paths) */}
                            {primaryPath && (
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
                            )}

                            {/* Acknowledgment & Rights (shown for all paths) */}
                            {primaryPath && (
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
                            )}

                            {/* What to Expect */}
                            {primaryPath && (
                                <div className="p-6 rounded-lg" style={{ backgroundColor: 'rgba(169, 142, 74, 0.1)', borderWidth: '2px', borderColor: '#A98E4A' }}>
                                    <h3 className="text-sm font-semibold mb-3" style={{ color: '#7A1E1E' }}>What to Expect After You Submit</h3>
                                    <div className="space-y-2 text-sm" style={{ color: '#D4D4D4' }}>
                                        <p className="flex items-start gap-2">
                                            <span style={{ color: '#A98E4A' }}>•</span>
                                            <span><strong>Automatic screening</strong> verifies your readiness score meets the 8.0/10 threshold</span>
                                        </p>
                                        <p className="flex items-start gap-2">
                                            <span style={{ color: '#A98E4A' }}>•</span>
                                            <span><strong>Eligible projects</strong> enter the queue; a limited number may be invited to the Storygate Review Pass (human review)</span>
                                        </p>
                                        <p className="flex items-start gap-2">
                                            <span style={{ color: '#A98E4A' }}>•</span>
                                            <span><strong>No guarantees or timelines</strong> — most eligible submissions are not invited to human review or follow-up</span>
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Submit Button */}
                            {primaryPath && (
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
                            )}
                        </form>
                    </CardContent>
                </Card>

                {/* FAQ Section */}
                <div className="mt-8">
                    <StorygateStudioFAQ />
                </div>
            </div>
        </div>
    );
}