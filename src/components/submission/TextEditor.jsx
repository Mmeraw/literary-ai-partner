import React from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Type } from 'lucide-react';

export default function TextEditor({ title, setTitle, text, setText }) {
    const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
    const charCount = text.length;

    return (
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-3 text-lg font-medium text-slate-800">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600">
                        <FileText className="w-5 h-5 text-white" />
                    </div>
                    Your Manuscript
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-medium text-slate-600">
                        Chapter / Section Title
                    </Label>
                    <Input
                        id="title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g., Chapter 1: The Beginning"
                        className="h-12 bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20 transition-all"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="text" className="text-sm font-medium text-slate-600">
                        Draft Text
                    </Label>
                    <Textarea
                        id="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="Paste your draft paragraph, chapter, or scene here..."
                        className="min-h-[400px] bg-white border-slate-200 focus:border-indigo-400 focus:ring-indigo-400/20 transition-all resize-none leading-relaxed text-slate-700"
                    />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <Type className="w-4 h-4" />
                            <span className={wordCount > 3000 ? 'text-red-600 font-medium' : 'text-slate-500'}>
                                {wordCount.toLocaleString()} / 3,000 words
                            </span>
                        </div>
                        <span className="text-slate-500">{charCount.toLocaleString()} characters</span>
                    </div>
                    {wordCount > 3000 && (
                        <span className="text-xs text-red-600 font-medium">
                            Exceeds preview limit
                        </span>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}