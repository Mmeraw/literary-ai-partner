import React from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function DocumentSelector({ 
    value, 
    onChange, 
    filterType = 'MANUSCRIPT',
    title = "Select Manuscript",
    description = "Choose a manuscript from your dashboard library"
}) {
    const { data: documents = [], isLoading } = useQuery({
        queryKey: ['userDocuments', filterType],
        queryFn: () => base44.entities.Document.filter({ type: filterType }, '-created_date', 100)
    });

    if (isLoading) {
        return <div className="text-sm text-slate-500">Loading documents...</div>;
    }

    if (documents.length === 0) {
        return (
            <Card className="border-2 border-amber-200 bg-amber-50">
                <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 mb-1">No Documents Found</h4>
                            <p className="text-sm text-slate-600 mb-3">
                                You need to upload a manuscript to your Dashboard first. This creates a single source of truth that all features can reference.
                            </p>
                            <Link to={createPageUrl('Dashboard')}>
                                <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Go to Dashboard to Upload
                                </Button>
                            </Link>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
                {title}
            </label>
            <p className="text-xs text-slate-600 mb-3">{description}</p>
            <div className="space-y-2">
                {documents.map(doc => (
                    <Card 
                        key={doc.id}
                        className={`cursor-pointer transition-all ${
                            value === doc.id 
                                ? 'border-2 border-indigo-600 bg-indigo-50' 
                                : 'border border-slate-200 hover:border-indigo-300'
                        }`}
                        onClick={() => onChange(doc.id)}
                    >
                        <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                    <FileText className={`w-5 h-5 ${value === doc.id ? 'text-indigo-600' : 'text-slate-400'}`} />
                                    <div className="flex-1">
                                        <h4 className="font-medium text-sm text-slate-900">{doc.title}</h4>
                                        <p className="text-xs text-slate-600">
                                            {doc.state} • Last updated: {new Date(doc.last_activity_at || doc.created_date).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                {value === doc.id && (
                                    <Badge className="bg-indigo-600">Selected</Badge>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            <div className="mt-3 pt-3 border-t border-slate-200">
                <Link to={createPageUrl('Dashboard')}>
                    <Button variant="outline" size="sm" className="w-full">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload New Document to Dashboard
                    </Button>
                </Link>
            </div>
        </div>
    );
}