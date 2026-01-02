import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Sparkles, Copy, Download, Loader2, Upload, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useRevisionFlow } from '@/components/useRevisionFlow';
import RevisionViewer from '@/components/RevisionViewer';
import RevisionControls from '@/components/RevisionControls';
import { exportTxt } from '@/components/utils/exportTxt';

// Gate state calculator (single source of truth)
function getSynopsisGateState(manuscript, metadata) {
    if (!manuscript) {
        return { state: 'NO_MANUSCRIPT', blocked: true, message: 'Select a manuscript first' };
    }

    // Gate 1: Metadata check
    const requiredMetadata = ['word_count']; // POV and genre band to be added later
    const missingMeta = requiredMetadata.filter(field => !manuscript[field]);
    if (missingMeta.length > 0) {
        return {
            state: 'E',
            blocked: true,
            code: 'ERR_SYNOPSIS_PRECONDITION_MISSING_METADATA',
            message: `Synopsis blocked: missing required metadata (${missingMeta.join(', ')})`,
            cta: 'Complete Metadata',
            ctaAction: 'metadata'
        };
    }

    // Gate 2: Spine evaluation
    const spineEval = manuscript.spine_evaluation;
    if (!spineEval || spineEval.status !== 'COMPLETE' || !spineEval.story_spine) {
        return {
            state: 'D',
            blocked: true,
            code: 'ERR_SYNOPSIS_PRECONDITION_MISSING_SPINE',
            message: 'Synopsis blocked: spine statement not found or incomplete',
            cta: 'Run Spine Evaluation',
            ctaAction: 'spine'
        };
    }

    // Gate 3: 13 Criteria
    const thirteenCriteria = manuscript.revisiongrade_breakdown?.thirteen_criteria;
    if (!thirteenCriteria || thirteenCriteria.status !== 'COMPLETE') {
        return {
            state: 'B',
            blocked: true,
            code: 'ERR_SYNOPSIS_PRECONDITION_MISSING_13CRITERIA',
            message: 'Synopsis blocked: 13 Story Criteria incomplete',
            cta: 'Run 13 Story Criteria',
            ctaAction: '13criteria'
        };
    }

    // Gate 4: WAVE flags
    const waveFlags = manuscript.revisiongrade_breakdown?.wave_flags;
    if (!waveFlags || waveFlags.status !== 'COMPLETE') {
        return {
            state: 'C',
            blocked: true,
            code: 'ERR_SYNOPSIS_PRECONDITION_MISSING_WAVE',
            message: 'Synopsis blocked: WAVE flags incomplete',
            cta: 'Run WAVE Guide',
            ctaAction: 'wave'
        };
    }

    // Gate 5: Weak spine threshold
    const SPINE_THRESHOLD = 7.0;
    if (manuscript.spine_score < SPINE_THRESHOLD) {
        return {
            state: 'G',
            blocked: false, // Can proceed with opt-in
            code: 'ERR_SYNOPSIS_SPINE_TOO_WEAK',
            message: `This manuscript has a weak narrative spine (score ${manuscript.spine_score}/10). Choose: (1) Strengthen spine first (recommended), or (2) Generate synopsis with ambiguity acknowledged.`,
            spineScore: manuscript.spine_score,
            spineFlags: spineEval.spine_flags || [],
            spineStatement: spineEval.story_spine
        };
    }

    // All gates passed
    return {
        state: 'F',
        blocked: false,
        message: 'Ready to generate synopsis',
        spineScore: manuscript.spine_score
    };
}

export default function Synopsis() {
    const [selectedManuscriptId, setSelectedManuscriptId] = useState(null);
    const [inputMode, setInputMode] = useState('manuscript'); // 'manuscript' or 'text'
    const [manualText, setManualText] = useState('');
    const [allowAmbiguity, setAllowAmbiguity] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [synopses, setSynopses] = useState({
        query: '',
        standard: '',
        extended: ''
    });
    const [validation, setValidation] = useState({});
    const [documentIds, setDocumentIds] = useState({
        query: null,
        standard: null,
        extended: null
    });
    const [apiError, setApiError] = useState(null);
    
    const queryRevision = useRevisionFlow('synopsis');
    const standardRevision = useRevisionFlow('synopsis');
    const extendedRevision = useRevisionFlow('synopsis');
    
    const { data: manuscripts = [] } = useQuery({
        queryKey: ['user-manuscripts'],
        queryFn: async () => {
            const user = await base44.auth.me();
            return await base44.entities.Manuscript.filter({ created_by: user.email });
        }
    });

    const selectedManuscript = manuscripts.find(m => m.id === selectedManuscriptId);
    const gateState = getSynopsisGateState(selectedManuscript);

    const handleManuscriptSelect = (manuscriptId) => {
        setSelectedManuscriptId(manuscriptId);
        setApiError(null);
        setAllowAmbiguity(false);
    };

    const generateSynopsis = async (type) => {
        if (inputMode === 'manuscript' && !selectedManuscriptId) {
            toast.error('Please select a manuscript');
            return;
        }
        if (inputMode === 'text' && !manualText.trim()) {
            toast.error('Please paste your manuscript text');
            return;
        }

        setGenerating(true);
        setApiError(null);
        
        try {
            const payload = inputMode === 'manuscript' 
                ? {
                    source_document_id: selectedManuscriptId,
                    source_version_id: null,
                    mode: allowAmbiguity ? "AMBIGUITY_ACK" : "STANDARD",
                    variant: type.toUpperCase()
                }
                : {
                    manuscriptInfo: manualText,
                    synopsisType: type,
                    mode: "STANDARD",
                    variant: type.toUpperCase()
                };

            const response = await base44.functions.invoke('generateSynopsis', payload);
            
            const result = response.data || response;

            if (result.success) {
                setSynopses(prev => ({
                    ...prev,
                    [type]: result.synopsis
                }));
                setValidation(prev => ({
                    ...prev,
                    [type]: result.validation
                }));
                setDocumentIds(prev => ({
                    ...prev,
                    [type]: result.document_id
                }));
                
                const revision = type === 'query' ? queryRevision : type === 'standard' ? standardRevision : extendedRevision;
                await revision.createBaseline(result.synopsis, `synopsis_${type}_${Date.now()}`);
                
                const versionName = type === 'query' ? 'Query' : type === 'standard' ? 'Standard' : 'Extended';
                toast.success(`${versionName} synopsis generated!`);
            } else {
                // Display server error codes verbatim
                setApiError({
                    code: result.error || 'Unknown error',
                    message: result.message || result.error || 'Generation failed',
                    gate_blocked: result.gate_blocked || false,
                    details: result
                });
                toast.error(result.error || 'Generation failed');
            }
        } catch (error) {
            console.error('Synopsis generation error:', error);
            const errorData = error.response?.data || error.data;
            setApiError({
                code: errorData?.error || 'NETWORK_ERROR',
                message: errorData?.message || error.message || 'Failed to generate synopsis',
                gate_blocked: errorData?.gate_blocked || false,
                details: errorData
            });
            toast.error(errorData?.error || 'Failed to generate synopsis');
        } finally {
            setGenerating(false);
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('Copied to clipboard!');
    };

    const handleRequestRevision = async (type) => {
        const revision = type === 'query' ? queryRevision : type === 'standard' ? standardRevision : extendedRevision;
        const currentContent = synopses[type];
        
        toast.info('Requesting AI revision...');
        const revisedContent = currentContent + '\n\n[AI-generated revision would appear here]';
        
        await revision.requestRevision(currentContent, revisedContent);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12">
                <div className="text-center mb-10">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <FileText className="w-4 h-4 mr-2" />
                        Synopsis Builder
                    </Badge>
                    <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
                        Generate Professional Synopses
                    </h1>
                    <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
                        Create short (1 page) and long (1-2 pages) synopses for agent submissions. 
                        Both versions reveal the ending—agents need to know your full story.
                    </p>
                </div>

                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Manuscript Input</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Tabs value={inputMode} onValueChange={setInputMode}>
                            <TabsList className="grid grid-cols-2 w-full">
                                <TabsTrigger value="manuscript">Select Evaluated Manuscript</TabsTrigger>
                                <TabsTrigger value="text">Paste Text</TabsTrigger>
                            </TabsList>

                            <TabsContent value="manuscript" className="space-y-4 mt-4">
                                {manuscripts.length === 0 ? (
                                    <Alert>
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertDescription className="flex items-center justify-between">
                                            <span>No manuscripts found. Upload and evaluate a manuscript first.</span>
                                            <Button 
                                                size="sm" 
                                                onClick={() => window.location.href = createPageUrl('UploadManuscript')}
                                                className="ml-4"
                                            >
                                                <Upload className="w-4 h-4 mr-2" />
                                                Upload Manuscript
                                            </Button>
                                        </AlertDescription>
                                    </Alert>
                                ) : (
                                    <Select value={selectedManuscriptId || ''} onValueChange={handleManuscriptSelect}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a manuscript..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {manuscripts.map((ms) => (
                                                <SelectItem key={ms.id} value={ms.id}>
                                                    {ms.title} ({ms.word_count?.toLocaleString()} words)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </TabsContent>

                            <TabsContent value="text" className="space-y-4 mt-4">
                                <Textarea
                                    placeholder="Paste your complete manuscript text here..."
                                    value={manualText}
                                    onChange={(e) => setManualText(e.target.value)}
                                    className="min-h-[300px] font-mono text-sm"
                                />
                                <p className="text-xs text-slate-500">
                                    Note: Manual text input bypasses evaluation gates. For gate-protected synopses, use an evaluated manuscript.
                                </p>
                            </TabsContent>
                        </Tabs>

                        {/* Gate State Display (only for manuscript mode) */}
                        {inputMode === 'manuscript' && selectedManuscript && gateState && (
                            <Alert className={
                                gateState.state === 'F' ? 'border-green-200 bg-green-50' :
                                gateState.state === 'G' ? 'border-amber-200 bg-amber-50' :
                                'border-red-200 bg-red-50'
                            }>
                                {gateState.state === 'F' ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                ) : gateState.state === 'G' ? (
                                    <AlertCircle className="h-4 w-4 text-amber-600" />
                                ) : (
                                    <XCircle className="h-4 w-4 text-red-600" />
                                )}
                                <AlertDescription>
                                    <div className="space-y-2">
                                        {gateState.code && (
                                            <div className="font-mono text-xs text-slate-600">{gateState.code}</div>
                                        )}
                                        <div>{gateState.message}</div>
                                        {gateState.cta && (
                                            <Button size="sm" variant="outline" className="mt-2">
                                                {gateState.cta}
                                            </Button>
                                        )}
                                        {gateState.state === 'G' && (
                                            <div className="mt-3 flex items-start gap-2 p-3 rounded bg-white border border-amber-200">
                                                <Checkbox
                                                    id="allow-ambiguity"
                                                    checked={allowAmbiguity}
                                                    onCheckedChange={setAllowAmbiguity}
                                                />
                                                <label htmlFor="allow-ambiguity" className="text-sm cursor-pointer">
                                                    Generate synopsis with ambiguity acknowledged (preserves unresolved elements)
                                                </label>
                                            </div>
                                        )}
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* API Error Display */}
                        {apiError && (
                            <Alert className="border-red-200 bg-red-50">
                                <XCircle className="h-4 w-4 text-red-600" />
                                <AlertDescription>
                                    <div className="space-y-1">
                                        <div className="font-mono text-xs text-red-700">{apiError.code}</div>
                                        <div className="text-sm">{apiError.message}</div>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                <Tabs defaultValue="standard" className="space-y-6">
                    <TabsList className="grid grid-cols-3 w-full">
                        <TabsTrigger value="query">Query (100-150)</TabsTrigger>
                        <TabsTrigger value="standard">Standard (250-500)</TabsTrigger>
                        <TabsTrigger value="extended">Extended (700-1000)</TabsTrigger>
                    </TabsList>

                    <TabsContent value="query" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Query Synopsis</CardTitle>
                                <p className="text-sm text-slate-600">
                                    100-150 words | Query letters, online forms | Core hook only
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button 
                                    onClick={() => generateSynopsis('query')}
                                    disabled={
                                        generating || 
                                        (inputMode === 'manuscript' && (!selectedManuscriptId || gateState.blocked || (gateState.state === 'G' && !allowAmbiguity))) ||
                                        (inputMode === 'text' && !manualText.trim())
                                    }
                                    className="w-full"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            {inputMode === 'manuscript' && gateState.blocked ? 'Synopsis Locked' : 'Generate Query Synopsis'}
                                        </>
                                    )}
                                </Button>

                                {synopses.query && (
                                    <div className="space-y-4">
                                        {queryRevision.showViewer && queryRevision.revisionEventId ? (
                                            <RevisionViewer
                                                revisionEventId={queryRevision.revisionEventId}
                                                onApprove={queryRevision.approveRevision}
                                            />
                                        ) : (
                                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                                <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{synopses.query}</p>
                                                <div className="mt-3 flex items-center justify-between text-xs">
                                                    <span className="text-slate-500">{synopses.query.split(' ').length} words</span>
                                                    {validation.query && validation.query.pitfalls_detected?.length > 0 && (
                                                        <Badge variant="outline" className="text-amber-600">
                                                            {validation.query.pitfalls_detected.length} issues detected
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex gap-2 flex-wrap">
                                            <Button variant="outline" onClick={() => copyToClipboard(synopses.query)}>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </Button>
                                            <Button variant="outline" onClick={() => exportTxt(synopses.query, 'query-synopsis.txt')}>
                                                <Download className="w-4 h-4 mr-2" />
                                                Download
                                            </Button>
                                            <RevisionControls
                                                hasBaseline={!!queryRevision.baselineVersionId}
                                                hasRevision={queryRevision.hasRevision}
                                                showingViewer={queryRevision.showViewer}
                                                processing={queryRevision.processing}
                                                onRequestRevision={() => handleRequestRevision('query')}
                                                onShowViewer={() => queryRevision.setShowViewer(true)}
                                                onApprove={queryRevision.approveRevision}
                                                onClose={queryRevision.closeViewer}
                                            />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="standard" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Standard Synopsis</CardTitle>
                                <p className="text-sm text-slate-600">
                                    250-500 words | Agency submissions | Full 9-header structure
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button 
                                    onClick={() => generateSynopsis('standard')}
                                    disabled={
                                        generating || 
                                        (inputMode === 'manuscript' && (!selectedManuscriptId || gateState.blocked || (gateState.state === 'G' && !allowAmbiguity))) ||
                                        (inputMode === 'text' && !manualText.trim())
                                    }
                                    className="w-full"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            {inputMode === 'manuscript' && gateState.blocked ? 'Synopsis Locked' : 'Generate Standard Synopsis'}
                                        </>
                                    )}
                                </Button>

                                {synopses.standard && (
                                    <div className="space-y-4">
                                        {standardRevision.showViewer && standardRevision.revisionEventId ? (
                                            <RevisionViewer
                                                revisionEventId={standardRevision.revisionEventId}
                                                onApprove={standardRevision.approveRevision}
                                            />
                                        ) : (
                                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                                <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{synopses.standard}</p>
                                                <div className="mt-3 flex items-center justify-between text-xs">
                                                    <span className="text-slate-500">{synopses.standard.split(' ').length} words</span>
                                                    {validation.standard && validation.standard.pitfalls_detected?.length > 0 && (
                                                        <Badge variant="outline" className="text-amber-600">
                                                            {validation.standard.pitfalls_detected.length} issues detected
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex gap-2 flex-wrap">
                                            <Button variant="outline" onClick={() => copyToClipboard(synopses.standard)}>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </Button>
                                            <Button variant="outline" onClick={() => exportTxt(synopses.standard, 'standard-synopsis.txt')}>
                                                <Download className="w-4 h-4 mr-2" />
                                                Download
                                            </Button>
                                            <RevisionControls
                                                hasBaseline={!!standardRevision.baselineVersionId}
                                                hasRevision={standardRevision.hasRevision}
                                                showingViewer={standardRevision.showViewer}
                                                processing={standardRevision.processing}
                                                onRequestRevision={() => handleRequestRevision('standard')}
                                                onShowViewer={() => standardRevision.setShowViewer(true)}
                                                onApprove={standardRevision.approveRevision}
                                                onClose={standardRevision.closeViewer}
                                            />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="extended" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Extended Synopsis</CardTitle>
                                <p className="text-sm text-slate-600">
                                    700-1000 words | Grants, press kits | Detailed with subplots
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Button 
                                    onClick={() => generateSynopsis('extended')}
                                    disabled={
                                        generating || 
                                        (inputMode === 'manuscript' && (!selectedManuscriptId || gateState.blocked || (gateState.state === 'G' && !allowAmbiguity))) ||
                                        (inputMode === 'text' && !manualText.trim())
                                    }
                                    className="w-full"
                                >
                                    {generating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="w-4 h-4 mr-2" />
                                            {inputMode === 'manuscript' && gateState.blocked ? 'Synopsis Locked' : 'Generate Extended Synopsis'}
                                        </>
                                    )}
                                </Button>

                                {synopses.extended && (
                                    <div className="space-y-4">
                                        {extendedRevision.showViewer && extendedRevision.revisionEventId ? (
                                            <RevisionViewer
                                                revisionEventId={extendedRevision.revisionEventId}
                                                onApprove={extendedRevision.approveRevision}
                                            />
                                        ) : (
                                            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                                                <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">{synopses.extended}</p>
                                                <div className="mt-3 flex items-center justify-between text-xs">
                                                    <span className="text-slate-500">{synopses.extended.split(' ').length} words</span>
                                                    {validation.extended && validation.extended.pitfalls_detected?.length > 0 && (
                                                        <Badge variant="outline" className="text-amber-600">
                                                            {validation.extended.pitfalls_detected.length} issues detected
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex gap-2 flex-wrap">
                                            <Button variant="outline" onClick={() => copyToClipboard(synopses.extended)}>
                                                <Copy className="w-4 h-4 mr-2" />
                                                Copy
                                            </Button>
                                            <Button variant="outline" onClick={() => exportTxt(synopses.extended, 'extended-synopsis.txt')}>
                                                <Download className="w-4 h-4 mr-2" />
                                                Download
                                            </Button>
                                            <RevisionControls
                                                hasBaseline={!!extendedRevision.baselineVersionId}
                                                hasRevision={extendedRevision.hasRevision}
                                                showingViewer={extendedRevision.showViewer}
                                                processing={extendedRevision.processing}
                                                onRequestRevision={() => handleRequestRevision('extended')}
                                                onShowViewer={() => extendedRevision.setShowViewer(true)}
                                                onApprove={extendedRevision.approveRevision}
                                                onClose={extendedRevision.closeViewer}
                                            />
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                <Card className="mt-8 border-2 border-indigo-100">
                    <CardHeader>
                        <CardTitle>Synopsis Best Practices</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-slate-700">
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span><strong>9-Header Structure:</strong> Professional synopses use metadata, premise, plot points, climax, resolution, themes, style, market positioning, and closing note</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span><strong>Reveal Ending:</strong> Agents need to know your complete story—no teasers or cliffhangers</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span><strong>Present Tense, Third Person:</strong> "Sarah discovers..." not "Sarah discovered..."</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span><strong>Max 5-7 Named Characters:</strong> Use roles for secondary cast</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span><strong>Strong Verbs, Precise Nouns:</strong> Avoid blurb-speak and adjective padding</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <span className="text-indigo-600">•</span>
                                <span><strong>Story Before Theme:</strong> Lead with plot; themes come at the end</span>
                            </li>
                        </ul>
                        <div className="mt-4 p-3 rounded-lg bg-indigo-50 border border-indigo-200">
                            <p className="text-xs text-indigo-800">
                                <strong>Professional Standards:</strong> Our synopsis engine is calibrated against PhD-level editorial frameworks used by professional literary consultants.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                <div className="mt-8 p-6 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 text-center">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Ready for Query Letters
                    </h3>
                    <p className="text-sm text-slate-600">
                        Your synopsis will auto-populate in the Query Letter builder, 
                        creating a complete agent submission package.
                    </p>
                </div>
            </div>
        </div>
    );
}