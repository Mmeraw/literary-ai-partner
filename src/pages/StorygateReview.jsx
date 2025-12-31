import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { 
    Loader2, 
    Crown,
    CheckCircle2,
    XCircle,
    Clock,
    Eye,
    Archive
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { createPageUrl } from '@/utils';

export default function StorygateReview() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    React.useEffect(() => {
        const checkAuth = async () => {
            try {
                const userData = await base44.auth.me();
                if (userData.role !== 'admin') {
                    window.location.href = createPageUrl('Home');
                    return;
                }
                setUser(userData);
            } catch (err) {
                window.location.href = createPageUrl('Home');
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, []);

    const { data: submissions, isLoading, refetch } = useQuery({
        queryKey: ['storygate-submissions'],
        queryFn: () => base44.entities.StorygateSubmission.list('-created_date'),
        enabled: !loading && user?.role === 'admin'
    });

    const [expandedId, setExpandedId] = useState(null);
    const [notes, setNotes] = useState({});
    const [saving, setSaving] = useState(null);

    const updateStatus = async (submissionId, newStatus, tier = null) => {
        setSaving(submissionId);
        try {
            const updateData = {
                status: newStatus,
                review_date: new Date().toISOString(),
                reviewer: user.email
            };
            if (tier !== null) {
                updateData.tier = tier;
            }
            if (notes[submissionId]) {
                updateData.internal_notes = notes[submissionId];
            }

            await base44.entities.StorygateSubmission.update(submissionId, updateData);
            toast.success('Status updated');
            refetch();
        } catch (error) {
            toast.error('Failed to update status');
        } finally {
            setSaving(null);
        }
    };

    const statusConfig = {
        pending_review: { label: 'Pending Review', icon: Clock, color: 'text-yellow-400 bg-yellow-900/20 border-yellow-800' },
        tier_1_declined: { label: 'Tier 1 (Declined)', icon: XCircle, color: 'text-red-400 bg-red-900/20 border-red-800' },
        tier_2_hold: { label: 'Tier 2 (Hold)', icon: Archive, color: 'text-blue-400 bg-blue-900/20 border-blue-800' },
        tier_3_reviewing: { label: 'Tier 3 (Reviewing)', icon: Eye, color: 'text-purple-400 bg-purple-900/20 border-purple-800' },
        engaged: { label: 'Engaged', icon: CheckCircle2, color: 'text-green-400 bg-green-900/20 border-green-800' },
    };

    if (loading || isLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
            </div>
        );
    }

    const pendingCount = submissions?.filter(s => s.status === 'pending_review').length || 0;
    const tier3Count = submissions?.filter(s => s.status === 'tier_3_reviewing').length || 0;

    return (
        <div className="min-h-screen bg-slate-900">
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600">
                            <Crown className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-white">Storygate Studio Review</h1>
                            <p className="text-slate-400">Internal triage system</p>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <Card className="border-yellow-800 bg-yellow-900/20">
                            <CardContent className="pt-6">
                                <div className="text-3xl font-bold text-yellow-400">{pendingCount}</div>
                                <div className="text-sm text-slate-300">Pending Review</div>
                            </CardContent>
                        </Card>
                        <Card className="border-purple-800 bg-purple-900/20">
                            <CardContent className="pt-6">
                                <div className="text-3xl font-bold text-purple-400">{tier3Count}</div>
                                <div className="text-sm text-slate-300">Tier 3 (Active Review)</div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Submissions List */}
                <div className="space-y-4">
                    {submissions?.map((submission) => {
                        const config = statusConfig[submission.status];
                        const Icon = config.icon;
                        const isExpanded = expandedId === submission.id;

                        return (
                            <Card key={submission.id} className={cn("border-slate-800 bg-slate-900/50", config.color)}>
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <CardTitle className="text-white">{submission.project_title}</CardTitle>
                                                <Badge className={cn("text-xs", config.color)}>
                                                    <Icon className="w-3 h-3 mr-1" />
                                                    {config.label}
                                                </Badge>
                                                {submission.tier && (
                                                    <Badge variant="outline" className="text-xs text-slate-400">
                                                        Tier {submission.tier}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="text-sm text-slate-400 space-x-3">
                                                <span>{submission.format}</span>
                                                <span>•</span>
                                                <span>{submission.project_stage}</span>
                                                <span>•</span>
                                                <span>{new Date(submission.created_date).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            onClick={() => setExpandedId(isExpanded ? null : submission.id)}
                                            className="text-slate-400"
                                        >
                                            {isExpanded ? 'Collapse' : 'Expand'}
                                        </Button>
                                    </div>
                                </CardHeader>

                                {isExpanded && (
                                    <CardContent className="space-y-6 border-t border-slate-800 pt-6">
                                        {/* Description */}
                                        <div>
                                            <h4 className="font-semibold text-white mb-2">Project Description</h4>
                                            <p className="text-slate-300 text-sm whitespace-pre-wrap">{submission.description}</p>
                                        </div>

                                        {/* Why Storygate */}
                                        <div>
                                            <h4 className="font-semibold text-white mb-2">Why Storygate Studio?</h4>
                                            <p className="text-slate-300 text-sm whitespace-pre-wrap">{submission.why_storygate}</p>
                                        </div>

                                        {/* Seeking */}
                                        {submission.seeking?.length > 0 && (
                                            <div>
                                                <h4 className="font-semibold text-white mb-2">Seeking</h4>
                                                <div className="flex flex-wrap gap-2">
                                                    {submission.seeking.map(s => (
                                                        <Badge key={s} variant="outline" className="text-slate-300">
                                                            {s}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Internal Notes */}
                                        <div>
                                            <h4 className="font-semibold text-white mb-2">Internal Notes</h4>
                                            <Textarea
                                                value={notes[submission.id] || submission.internal_notes || ''}
                                                onChange={(e) => setNotes({...notes, [submission.id]: e.target.value})}
                                                placeholder="Add internal notes (not visible to submitter)..."
                                                className="bg-slate-800 border-slate-700 text-white min-h-[100px]"
                                            />
                                        </div>

                                        {/* Review Date */}
                                        {submission.review_date && (
                                            <div className="text-xs text-slate-500">
                                                Reviewed: {new Date(submission.review_date).toLocaleString()} by {submission.reviewer}
                                            </div>
                                        )}

                                        {/* Tier Actions */}
                                        <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-800">
                                            <Button
                                                variant="outline"
                                                onClick={() => updateStatus(submission.id, 'tier_1_declined', 1)}
                                                disabled={saving === submission.id}
                                                className="bg-red-900/20 border-red-800 text-red-400 hover:bg-red-900/30"
                                            >
                                                {saving === submission.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tier 1 (Decline)'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => updateStatus(submission.id, 'tier_2_hold', 2)}
                                                disabled={saving === submission.id}
                                                className="bg-blue-900/20 border-blue-800 text-blue-400 hover:bg-blue-900/30"
                                            >
                                                {saving === submission.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tier 2 (Hold)'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => updateStatus(submission.id, 'tier_3_reviewing', 3)}
                                                disabled={saving === submission.id}
                                                className="bg-purple-900/20 border-purple-800 text-purple-400 hover:bg-purple-900/30"
                                            >
                                                {saving === submission.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tier 3 (Review)'}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                onClick={() => updateStatus(submission.id, 'engaged')}
                                                disabled={saving === submission.id}
                                                className="bg-green-900/20 border-green-800 text-green-400 hover:bg-green-900/30"
                                            >
                                                {saving === submission.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Mark Engaged'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}

                    {submissions?.length === 0 && (
                        <Card className="border-slate-800 bg-slate-900/50">
                            <CardContent className="pt-6 text-center text-slate-400">
                                No submissions yet
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}