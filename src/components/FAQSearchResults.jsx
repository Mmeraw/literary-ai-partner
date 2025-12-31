import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from 'lucide-react';

export default function FAQSearchResults({ query, results }) {
    if (!query || !results || results.length === 0) {
        return null;
    }

    return (
        <Card className="border-0 shadow-md mb-8">
            <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-slate-900">
                        {results.length} result{results.length !== 1 ? 's' : ''} found for "{query}"
                    </h3>
                </div>
                <div className="space-y-3">
                    {results.map((result, idx) => (
                        <a
                            key={idx}
                            href={`#${result.value}`}
                            className="block p-4 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                        >
                            <p className="text-slate-900 font-medium">{result.question}</p>
                            <Badge className="mt-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                                {result.section}
                            </Badge>
                        </a>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}