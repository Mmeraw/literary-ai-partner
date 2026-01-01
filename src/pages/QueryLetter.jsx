import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Mail, Download, Sparkles, Copy, Loader2, Upload, FileText, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function QueryLetter() {
    const [mode, setMode] = useState('auto'); // 'auto' or 'manual'
    const [formData, setFormData] = useState({
        manuscriptTitle: '',
        genre: '',
        wordCount: '',
        synopsis: '',
        bio: '',
        agentName: ''
    });
    const [autoFormData, setAutoFormData] = useState({
        manuscriptFile: null,
        bioText: '',
        linkedinUrl: '',
        bioFile: null,
        bioMode: 'linkedin', // 'linkedin', 'manual', or 'upload'
        synopsisMode: 'auto', // 'auto' or 'manual'
        existingSynopsis: '',
        oneLinePitch: '',
        pitchParagraph: '',
        compsMode: 'auto', // 'auto' or 'manual'
        manualComps: '',
        genre: ''
    });
    const [generating, setGenerating] = useState(false);
    const [queryLetter, setQueryLetter] = useState('');
    const [suggestedAgents, setSuggestedAgents] = useState([]);
    const [selectedAgentIndex, setSelectedAgentIndex] = useState(0);

    const handleAutoGenerate = async () => {
        const hasBio = autoFormData.bioMode === 'linkedin' ? autoFormData.linkedinUrl : 
                       autoFormData.bioMode === 'upload' ? autoFormData.bioFile : autoFormData.bioText;
        
        if (!autoFormData.manuscriptFile || !hasBio) {
            toast.error('Please upload your manuscript and provide your bio source');
            return;
        }

        setGenerating(true);
        try {
            // Upload manuscript file
            const { file_url } = await base44.integrations.Core.UploadFile({ file: autoFormData.manuscriptFile });
            
            let bioText = autoFormData.bioText;
            
            // If LinkedIn URL provided, extract bio
            if (autoFormData.bioMode === 'linkedin' && autoFormData.linkedinUrl) {
                toast.loading('Extracting LinkedIn profile...', { id: 'linkedin' });
                const { data: extractedBio } = await base44.functions.invoke('extractLinkedInBio', {
                    linkedin_url: autoFormData.linkedinUrl
                });
                bioText = extractedBio.bio;
                toast.success('LinkedIn profile extracted', { id: 'linkedin' });
            }
            
            // If CV/Resume uploaded, extract bio
            if (autoFormData.bioMode === 'upload' && autoFormData.bioFile) {
                toast.loading('Extracting bio from CV...', { id: 'cv' });
                const { file_url: bio_url } = await base44.integrations.Core.UploadFile({ file: autoFormData.bioFile });
                const { data: extractedBio } = await base44.functions.invoke('uploadAndGenerateBio', {
                    file_url: bio_url
                });
                bioText = extractedBio.bio;
                toast.success('Bio extracted from CV', { id: 'cv' });
            }
            
            // Generate complete query package
            const response = await base44.functions.invoke('generateQueryLetterPackage', {
                file_url,
                bio: bioText,
                synopsis_mode: autoFormData.synopsisMode,
                existing_synopsis: autoFormData.existingSynopsis,
                one_line_pitch: autoFormData.oneLinePitch,
                pitch_paragraph: autoFormData.pitchParagraph,
                comps_mode: autoFormData.compsMode,
                manual_comps: autoFormData.manualComps,
                genre: autoFormData.genre
            });

            console.log('Full response object:', response);
            console.log('Query letter field:', response.query_letter);
            console.log('Suggested agents field:', response.suggested_agents);

            // Validate response structure
            if (!response || typeof response !== 'object') {
                throw new Error('Invalid response format received');
            }

            if (!response.query_letter) {
                console.error('Missing query_letter in response. Full response:', response);
                throw new Error('Query letter not found in response');
            }

            // base44.functions.invoke returns data directly
            setQueryLetter(response.query_letter);
            setSuggestedAgents(response.suggested_agents || []);
            toast.success('Query letter generated with agent recommendations!');
        } catch (error) {
            console.error('Query letter generation error:', error);
            const errorMsg = error.message || error.response?.data?.error || 'Unknown error occurred';
            toast.error('Failed to generate query letter: ' + errorMsg);
        } finally {
            setGenerating(false);
        }
    };

    const handleManualGenerate = async () => {
        if (!formData.manuscriptTitle || !formData.synopsis) {
            toast.error('Please provide at least a title and synopsis');
            return;
        }

        setGenerating(true);
        try {
            const response = await base44.functions.invoke('generateQueryLetter', formData);
            setQueryLetter(response.query_letter);
            toast.success('Query letter generated!');
        } catch (error) {
            toast.error('Failed to generate query letter');
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(queryLetter);
        toast.success('Query letter copied to clipboard!');
    };

    const downloadPDF = () => {
        toast.info('PDF export coming soon!');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-10">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Mail className="w-4 h-4 mr-2" />
                        Query Letter Builder
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Generate Your Query Letter
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-4">
                        Let us build your query letter directly from your manuscript or screenplay—synopsis, pitch, comps, and agent targeting done for you.
                    </p>
                    <p className="text-base text-slate-500 max-w-2xl mx-auto">
                        Upload your material and a short bio, and RevisionGrade will generate an agent-ready query letter, including up to three tailored agent targets.
                    </p>
                </div>

                {/* Mode Selector */}
                <div className="flex gap-4 justify-center mb-8">
                    <Button
                        onClick={() => setMode('auto')}
                        variant={mode === 'auto' ? 'default' : 'outline'}
                        className={mode === 'auto' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                    >
                        <Zap className="w-4 h-4 mr-2" />
                        Let RevisionGrade Build It For Me
                    </Button>
                    <Button
                        onClick={() => setMode('manual')}
                        variant={mode === 'manual' ? 'default' : 'outline'}
                        className={mode === 'manual' ? 'bg-indigo-600 hover:bg-indigo-700' : ''}
                    >
                        <FileText className="w-4 h-4 mr-2" />
                        I'll Fill In Details Myself
                    </Button>
                </div>

                {/* Automated Mode */}
                {mode === 'auto' && (
                    <Card className="mb-8">
                        <CardHeader>
                            <CardTitle>Automated Query Letter Generation</CardTitle>
                            <p className="text-sm text-slate-600 mt-2">
                                We'll extract your synopsis, suggest comps, identify top agents, and write your query letter.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">
                                    Upload Manuscript or Screenplay (PDF/DOC/DOCX)
                                </label>
                                <Input
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file && file.size > 25 * 1024 * 1024) {
                                            toast.error('File must be under 25MB');
                                            return;
                                        }
                                        setAutoFormData({...autoFormData, manuscriptFile: file});
                                    }}
                                />
                                {autoFormData.manuscriptFile && (
                                    <p className="text-xs text-green-600 mt-1">
                                        ✓ {autoFormData.manuscriptFile.name}
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">
                                    Author Bio Source (Required)
                                </label>
                                <p className="text-xs text-slate-500 mb-3">
                                    Paste your LinkedIn profile link, upload your CV/Resume, or paste your own bio.
                                </p>
                                <div className="flex gap-2 mb-3">
                                    <Button
                                        type="button"
                                        variant={autoFormData.bioMode === 'linkedin' ? 'default' : 'outline'}
                                        onClick={() => setAutoFormData({...autoFormData, bioMode: 'linkedin', bioText: '', bioFile: null})}
                                        className="flex-1 text-sm"
                                    >
                                        LinkedIn URL
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={autoFormData.bioMode === 'upload' ? 'default' : 'outline'}
                                        onClick={() => setAutoFormData({...autoFormData, bioMode: 'upload', linkedinUrl: '', bioText: ''})}
                                        className="flex-1 text-sm"
                                    >
                                        Upload CV/Resume
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={autoFormData.bioMode === 'manual' ? 'default' : 'outline'}
                                        onClick={() => setAutoFormData({...autoFormData, bioMode: 'manual', linkedinUrl: '', bioFile: null})}
                                        className="flex-1 text-sm"
                                    >
                                        Paste Bio
                                    </Button>
                                </div>
                                
                                {autoFormData.bioMode === 'linkedin' ? (
                                    <div>
                                        <Input
                                            placeholder="https://www.linkedin.com/in/yourprofile"
                                            value={autoFormData.linkedinUrl}
                                            onChange={(e) => setAutoFormData({...autoFormData, linkedinUrl: e.target.value})}
                                        />
                                        {autoFormData.linkedinUrl && (
                                            <p className="text-xs text-green-600 mt-1">
                                                ✓ We'll extract your professional bio from LinkedIn
                                            </p>
                                        )}
                                    </div>
                                ) : autoFormData.bioMode === 'upload' ? (
                                    <div>
                                        <Input
                                            type="file"
                                            accept=".pdf,.doc,.docx"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file && file.size > 10 * 1024 * 1024) {
                                                    toast.error('File must be under 10MB');
                                                    return;
                                                }
                                                setAutoFormData({...autoFormData, bioFile: file});
                                            }}
                                        />
                                        {autoFormData.bioFile && (
                                            <p className="text-xs text-green-600 mt-1">
                                                ✓ {autoFormData.bioFile.name} - We'll extract your bio from this file
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <Textarea
                                        placeholder="Your writing credentials, publications, background..."
                                        value={autoFormData.bioText}
                                        onChange={(e) => setAutoFormData({...autoFormData, bioText: e.target.value})}
                                        className="min-h-[100px]"
                                    />
                                )}
                            </div>

                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">
                                    Genre (Optional)
                                </label>
                                <Select 
                                    value={autoFormData.genre} 
                                    onValueChange={(value) => setAutoFormData({...autoFormData, genre: value})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="✨ Let RevisionGrade Choose (Recommended)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="auto">✨ Let RevisionGrade Choose</SelectItem>
                                        <SelectItem value="literary_fiction">Literary Fiction</SelectItem>
                                        <SelectItem value="thriller">Thriller</SelectItem>
                                        <SelectItem value="mystery">Mystery</SelectItem>
                                        <SelectItem value="romance">Romance</SelectItem>
                                        <SelectItem value="fantasy">Fantasy</SelectItem>
                                        <SelectItem value="sci_fi">Science Fiction</SelectItem>
                                        <SelectItem value="historical">Historical Fiction</SelectItem>
                                        <SelectItem value="horror">Horror</SelectItem>
                                        <SelectItem value="ya">Young Adult</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="border-t border-slate-200 pt-4 mt-4">
                                <h3 className="text-sm font-semibold text-slate-900 mb-3">Query Letter Components</h3>
                                
                                {/* Synopsis Source */}
                                <div className="mb-4">
                                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                                        Synopsis Source
                                    </label>
                                    <div className="flex gap-2 mb-3">
                                        <Button
                                            type="button"
                                            variant={autoFormData.synopsisMode === 'auto' ? 'default' : 'outline'}
                                            onClick={() => setAutoFormData({...autoFormData, synopsisMode: 'auto', existingSynopsis: ''})}
                                            className="flex-1 text-sm"
                                        >
                                            ✨ Let RevisionGrade Generate
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={autoFormData.synopsisMode === 'manual' ? 'default' : 'outline'}
                                            onClick={() => setAutoFormData({...autoFormData, synopsisMode: 'manual'})}
                                            className="flex-1 text-sm"
                                        >
                                            I'll Paste My Own
                                        </Button>
                                    </div>
                                    {autoFormData.synopsisMode === 'manual' && (
                                        <Textarea
                                            placeholder="Paste your 2-3 paragraph synopsis..."
                                            value={autoFormData.existingSynopsis}
                                            onChange={(e) => setAutoFormData({...autoFormData, existingSynopsis: e.target.value})}
                                            className="min-h-[100px]"
                                        />
                                    )}
                                </div>

                                {/* Pitch Inputs */}
                                <div className="mb-4 space-y-3">
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-2 block">
                                            One-line Pitch (Optional)
                                        </label>
                                        <Input
                                            placeholder="If you already have a short 'elevator' pitch, paste it here. Otherwise, RevisionGrade will suggest one."
                                            value={autoFormData.oneLinePitch}
                                            onChange={(e) => setAutoFormData({...autoFormData, oneLinePitch: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-sm font-medium text-slate-700 mb-2 block">
                                            Query-letter Pitch Paragraph (Optional)
                                        </label>
                                        <Textarea
                                            placeholder="If you've drafted your main pitch paragraph, paste it here. Otherwise, we'll generate it from your material."
                                            value={autoFormData.pitchParagraph}
                                            onChange={(e) => setAutoFormData({...autoFormData, pitchParagraph: e.target.value})}
                                            className="min-h-[80px]"
                                        />
                                    </div>
                                </div>

                                {/* Comparables Source */}
                                <div>
                                    <label className="text-sm font-medium text-slate-700 mb-2 block">
                                        Comparable Titles
                                    </label>
                                    <p className="text-xs text-slate-500 mb-2">
                                        We'll reference 2-3 comps in your query letter. You can supply them or let RevisionGrade propose options.
                                    </p>
                                    <div className="flex gap-2 mb-3">
                                        <Button
                                            type="button"
                                            variant={autoFormData.compsMode === 'auto' ? 'default' : 'outline'}
                                            onClick={() => setAutoFormData({...autoFormData, compsMode: 'auto', manualComps: ''})}
                                            className="flex-1 text-sm"
                                        >
                                            ✨ Let RevisionGrade Suggest
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={autoFormData.compsMode === 'manual' ? 'default' : 'outline'}
                                            onClick={() => setAutoFormData({...autoFormData, compsMode: 'manual'})}
                                            className="flex-1 text-sm"
                                        >
                                            I'll Enter My Own
                                        </Button>
                                    </div>
                                    {autoFormData.compsMode === 'manual' && (
                                        <Textarea
                                            placeholder="Your comparable titles (2-3) - one per line&#10;e.g.:&#10;The Silent Patient by Alex Michaelides&#10;Gone Girl by Gillian Flynn"
                                            value={autoFormData.manualComps}
                                            onChange={(e) => setAutoFormData({...autoFormData, manualComps: e.target.value})}
                                            className="min-h-[80px]"
                                        />
                                    )}
                                </div>
                            </div>

                            <Button 
                                onClick={handleAutoGenerate}
                                disabled={generating || !autoFormData.manuscriptFile || 
                                         (autoFormData.bioMode === 'linkedin' ? !autoFormData.linkedinUrl : 
                                          autoFormData.bioMode === 'upload' ? !autoFormData.bioFile : !autoFormData.bioText)}
                                className="w-full bg-indigo-600 hover:bg-indigo-700"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Analyzing & Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 mr-2" />
                                        Generate Complete Query Letter
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Manual Mode */}
                {mode === 'manual' && (

                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Query Letter Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">Manuscript Title</label>
                                <Input
                                    placeholder="Your manuscript title"
                                    value={formData.manuscriptTitle}
                                    onChange={(e) => setFormData({...formData, manuscriptTitle: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">Genre</label>
                                <Input
                                    placeholder="e.g., Literary Thriller"
                                    value={formData.genre}
                                    onChange={(e) => setFormData({...formData, genre: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">Word Count</label>
                                <Input
                                    placeholder="e.g., 85,000"
                                    value={formData.wordCount}
                                    onChange={(e) => setFormData({...formData, wordCount: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-slate-700 mb-2 block">Agent Name (Optional)</label>
                                <Input
                                    placeholder="For personalization"
                                    value={formData.agentName}
                                    onChange={(e) => setFormData({...formData, agentName: e.target.value})}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-2 block">Synopsis/Hook</label>
                            <Textarea
                                placeholder="Your compelling synopsis or pitch (2-3 paragraphs)"
                                value={formData.synopsis}
                                onChange={(e) => setFormData({...formData, synopsis: e.target.value})}
                                className="min-h-[150px]"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-medium text-slate-700 mb-2 block">Author Bio</label>
                            <Textarea
                                placeholder="Your relevant writing credentials, publications, or background"
                                value={formData.bio}
                                onChange={(e) => setFormData({...formData, bio: e.target.value})}
                                className="min-h-[100px]"
                            />
                        </div>

                        <Button 
                            onClick={handleManualGenerate}
                            disabled={generating || !formData.manuscriptTitle || !formData.synopsis}
                            className="w-full"
                        >
                            {generating ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Generating Query Letter...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Generate Query Letter
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
                )}

                {/* Suggested Agents (Auto Mode Only) */}
                {mode === 'auto' && suggestedAgents.length > 0 && (
                    <Card className="mb-8 border-2 border-indigo-200">
                        <CardHeader>
                            <CardTitle>Suggested Literary Agents</CardTitle>
                            <p className="text-sm text-slate-600 mt-2">
                                Primary agent inserted in letter below. Two alternates provided for additional queries.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {suggestedAgents.map((agent, idx) => (
                                <div 
                                    key={idx}
                                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                                        selectedAgentIndex === idx 
                                            ? 'border-indigo-600 bg-indigo-50' 
                                            : 'border-slate-200 hover:border-indigo-300'
                                    }`}
                                    onClick={() => setSelectedAgentIndex(idx)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="font-semibold text-slate-900">
                                                {agent.name} {idx === 0 && <Badge className="ml-2">Primary</Badge>}
                                            </p>
                                            <p className="text-sm text-slate-600">{agent.agency}</p>
                                            <p className="text-xs text-slate-500 mt-1">{agent.reason}</p>
                                        </div>
                                        {selectedAgentIndex === idx && (
                                            <Badge className="bg-indigo-600">Selected</Badge>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* Generated Query Letter */}
                {queryLetter && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Your Query Letter</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 whitespace-pre-wrap font-serif">
                                {queryLetter}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={copyToClipboard}>
                                    <Copy className="w-4 h-4 mr-2" />
                                    Copy to Clipboard
                                </Button>
                                <Button variant="outline" onClick={downloadPDF}>
                                    <Download className="w-4 h-4 mr-2" />
                                    Export as PDF
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Tips */}
                <Card className="mt-8 border-2 border-indigo-100">
                    <CardHeader>
                        <CardTitle>Query Letter Best Practices</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Keep it to one page (under 400 words)</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Personalize each query with agent-specific details</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Start with a compelling hook in your first paragraph</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Include genre, word count, and comparative titles</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span>Keep your bio relevant to your manuscript</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Coming Soon */}
                <div className="mt-8 p-6 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-sm text-amber-900 text-center">
                        <strong>Coming in Q2:</strong> PDF export with professional formatting and agent-specific customization templates.
                    </p>
                </div>
            </div>
        </div>
    );
}