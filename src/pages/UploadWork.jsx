import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Film, Upload, Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

export default function UploadWork() {
    const [text, setText] = useState('');
    const [detectedFormat, setDetectedFormat] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const navigate = useNavigate();

    const detectFormat = (content) => {
        if (!content || content.trim().length < 100) {
            return null;
        }

        // Screenplay indicators
        const hasSlugLine = /^(INT\.|EXT\.|INT\/EXT\.)/.test(content);
        const hasCharacterBlock = /^[A-Z\s]+\n\s+[A-Z]/.test(content);
        const hasCenteredDialogue = /\n\s{20,}[A-Z]/.test(content);
        const hasTransition = /^(FADE IN:|FADE OUT|CUT TO:|DISSOLVE TO:)/.test(content);
        
        const screenplayScore = [hasSlugLine, hasCharacterBlock, hasCenteredDialogue, hasTransition].filter(Boolean).length;

        // If 2 or more screenplay indicators, it's likely a screenplay
        if (screenplayScore >= 2) {
            return 'screenplay';
        }

        // Otherwise, assume manuscript
        return 'manuscript';
    };

    const handleTextChange = (e) => {
        const newText = e.target.value;
        setText(newText);

        // Auto-detect after user stops typing (debounced)
        if (newText.length > 100) {
            const format = detectFormat(newText);
            setDetectedFormat(format);
        } else {
            setDetectedFormat(null);
        }
    };

    const handleConfirm = (format) => {
        setIsAnalyzing(true);
        
        // Store the text in sessionStorage so the next page can use it
        sessionStorage.setItem('uploadedText', text);
        
        // Navigate to the appropriate page
        if (format === 'screenplay') {
            navigate(createPageUrl('ScreenplayFormatter'));
        } else {
            navigate(createPageUrl('UploadManuscript'));
        }
    };

    const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-8"
                >
                    <div className="inline-flex p-3 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 mb-4">
                        <Upload className="w-6 h-6 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        Upload Your Work
                    </h1>
                    <p className="text-xl text-slate-600">
                        Paste your text below. We'll automatically detect whether it's a manuscript or screenplay.
                    </p>
                </motion.div>

                <Card className="border-2 border-slate-200 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <span>Your Text</span>
                            {wordCount > 0 && (
                                <Badge variant="outline" className="text-sm">
                                    {wordCount.toLocaleString()} words
                                </Badge>
                            )}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Textarea
                            placeholder="Paste your manuscript or screenplay here..."
                            value={text}
                            onChange={handleTextChange}
                            className="min-h-[400px] font-mono text-sm"
                        />

                        {detectedFormat && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-4"
                            >
                                <Card className={`border-2 ${
                                    detectedFormat === 'screenplay' 
                                        ? 'border-pink-300 bg-pink-50' 
                                        : 'border-indigo-300 bg-indigo-50'
                                }`}>
                                    <CardContent className="pt-6">
                                        <div className="flex items-start gap-4">
                                            <div className={`p-3 rounded-lg ${
                                                detectedFormat === 'screenplay'
                                                    ? 'bg-pink-600'
                                                    : 'bg-indigo-600'
                                            }`}>
                                                {detectedFormat === 'screenplay' ? (
                                                    <Film className="w-6 h-6 text-white" />
                                                ) : (
                                                    <BookOpen className="w-6 h-6 text-white" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-lg mb-2">
                                                    We detected this as a {detectedFormat === 'screenplay' ? 'Screenplay' : 'Manuscript'}
                                                </h3>
                                                <p className="text-sm text-slate-600 mb-4">
                                                    {detectedFormat === 'screenplay' 
                                                        ? 'Based on formatting indicators like scene headings and character blocks.'
                                                        : 'Based on prose structure and formatting patterns.'
                                                    }
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    You can change the format if this doesn't look right.
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="flex gap-3">
                                    <Button
                                        onClick={() => handleConfirm(detectedFormat)}
                                        disabled={isAnalyzing}
                                        className={`flex-1 h-12 ${
                                            detectedFormat === 'screenplay'
                                                ? 'bg-gradient-to-r from-pink-600 to-orange-600 hover:from-pink-700 hover:to-orange-700'
                                                : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                                        }`}
                                    >
                                        {isAnalyzing ? (
                                            <>
                                                <Sparkles className="w-4 h-4 mr-2 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                Confirm {detectedFormat === 'screenplay' ? 'Screenplay' : 'Manuscript'}
                                                <ArrowRight className="w-4 h-4 ml-2" />
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        variant="outline"
                                        onClick={() => handleConfirm(detectedFormat === 'screenplay' ? 'manuscript' : 'screenplay')}
                                        disabled={isAnalyzing}
                                        className="h-12"
                                    >
                                        Change Format
                                    </Button>
                                </div>
                            </motion.div>
                        )}

                        {!detectedFormat && text.length > 0 && text.length < 100 && (
                            <p className="text-sm text-slate-500 text-center">
                                Paste at least 100 characters to detect format
                            </p>
                        )}
                    </CardContent>
                </Card>

                <div className="text-center mt-6">
                    <p className="text-sm text-slate-500">
                        Or try our <a href={createPageUrl('Evaluate')} className="text-indigo-600 hover:underline">Quick Evaluation</a> for shorter excerpts
                    </p>
                </div>
            </div>
        </div>
    );
}