import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
    FileText, Calendar, Type, TrendingUp, 
    ChevronRight, Clock, CheckCircle2, AlertCircle, Trash2, Archive, CheckSquare, Square,
    Download, Sparkles, BarChart3, Edit3, Info
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { motion } from "framer-motion";
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function History() {
    const [activeTab, setActiveTab] = React.useState('active');
    const [selectedIds, setSelectedIds] = React.useState([]);
    const queryClient = useQueryClient();

    const startRevisionMutation = useMutation({
        mutationFn: async (submissionId) => {
            const response = await base44.functions.invoke('generateRevisionSuggestions', {
                submission_id: submissionId,
                wave_number: 1
            });
            return response.data;
        },
        onSuccess: (data) => {
            if (data.session_id) {
                window.location.href = createPageUrl(`Revise?session=${data.session_id}`);
            } else {
                toast.error('Failed to create revision session');
            }
        },
        onError: () => {
            toast.error('Failed to start revision');
        }
    });

    const handleStartRevision = async (e, submission) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!submission.overall_score) {
            toast.error('This submission must be evaluated first');
            return;
        }
        
        toast.loading('Creating revision session...', { id: 'start-revision' });
        startRevisionMutation.mutate(submission.id);
    };
    
    const { data: allSubmissions, isLoading } = useQuery({
        queryKey: ['submissions'],
        queryFn: async () => {
            const submissions = await base44.entities.Submission.list('-created_date');
            // Filter out permanently deleted items (older than 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            return submissions.filter(s => {
                if (!s.deleted_at) return true;
                return new Date(s.deleted_at) > thirtyDaysAgo;
            });
        },
        initialData: []
    });

    const { data: allSessions } = useQuery({
        queryKey: ['revisionSessions'],
        queryFn: async () => {
            return await base44.entities.RevisionSession.list('-created_date');
        },
        initialData: []
    });

    const activeSubmissions = allSubmissions.filter(s => !s.deleted_at);
    const trashedSubmissions = allSubmissions.filter(s => s.deleted_at);
    
    // Merge submissions with their completed revision sessions
    const enrichedSubmissions = activeSubmissions.map(submission => {
        const completedSession = allSessions.find(s => 
            s.submission_id === submission.id && s.status === 'completed'
        );
        return {
            ...submission,
            has_completed_revision: !!completedSession,
            session_id: completedSession?.id
        };
    });
    
    const submissions = activeTab === 'active' ? enrichedSubmissions : trashedSubmissions;

    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            await base44.entities.Submission.update(id, {
                deleted_at: new Date().toISOString()
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions'] });
            toast.success('Moved to trash. Can be recovered within 30 days.');
        },
        onError: () => {
            toast.error('Failed to move to trash');
        }
    });

    const permanentDeleteMutation = useMutation({
        mutationFn: async (id) => {
            await base44.entities.Submission.delete(id);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions'] });
            toast.success('Submission permanently deleted');
        },
        onError: () => {
            toast.error('Failed to delete submission');
        }
    });

    const restoreMutation = useMutation({
        mutationFn: async (id) => {
            await base44.entities.Submission.update(id, {
                deleted_at: null
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['submissions'] });
            toast.success('Submission restored');
        },
        onError: () => {
            toast.error('Failed to restore submission');
        }
    });

    const handleDelete = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Move this submission to trash? You can recover it within 30 days.')) {
            deleteMutation.mutate(id);
        }
    };

    const handlePermanentDelete = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('Permanently delete this submission? This cannot be undone.')) {
            permanentDeleteMutation.mutate(id);
        }
    };

    const handleRestore = async (e, id) => {
        e.preventDefault();
        e.stopPropagation();
        restoreMutation.mutate(id);
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) {
            toast.error('No items selected');
            return;
        }
        if (confirm(`Permanently delete ${selectedIds.length} submission(s)? This cannot be undone.`)) {
            for (const id of selectedIds) {
                await base44.entities.Submission.delete(id);
            }
            queryClient.invalidateQueries({ queryKey: ['submissions'] });
            setSelectedIds([]);
            toast.success('Selected submissions permanently deleted');
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === trashedSubmissions.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(trashedSubmissions.map(s => s.id));
        }
    };

    React.useEffect(() => {
        setSelectedIds([]);
    }, [activeTab]);

    const getStatusConfig = (status) => {
        switch (status) {
            case 'finalized':
                return { icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700', label: 'Finalized' };
            case 'reviewing':
                return { icon: AlertCircle, color: 'bg-amber-100 text-amber-700', label: 'In Review' };
            default:
                return { icon: Clock, color: 'bg-slate-100 text-slate-600', label: 'Draft' };
        }
    };

    const getScoreColor = (score) => {
        if (score >= 80) return 'text-emerald-600';
        if (score >= 60) return 'text-amber-600';
        return 'text-rose-600';
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-5xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="mb-10">
                    <h1 className="text-3xl font-bold text-slate-900">Submission History</h1>
                    <p className="mt-2 text-slate-600">View and continue your manuscript evaluations</p>
                </div>

                {/* How Revisions Work - Explainer */}
                <Card className="mb-8 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
                    <CardContent className="p-6">
                        <h2 className="text-xl font-bold text-slate-900 mb-3">How Revisions Work</h2>
                        <p className="text-slate-700 mb-4">
                            Revisions in RevisionGrade are always based on an Evaluation. 
                            First, evaluate a submission to generate a scored report. 
                            Then start a revision from that report to track changes, preserve voice, and measure improvement over time.
                        </p>
                        <div className="flex gap-3">
                            <Link to={createPageUrl('Evaluate')}>
                                <Button className="bg-indigo-600 hover:bg-indigo-700">
                                    <Sparkles className="w-4 h-4 mr-2" />
                                    Evaluate a New Submission
                                </Button>
                            </Link>
                            <Button 
                                variant="outline"
                                onClick={() => {
                                    document.querySelector('[data-evaluated-list]')?.scrollIntoView({ behavior: 'smooth' });
                                }}
                            >
                                View Evaluated Submissions Below
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
                    <TabsList className="grid w-full max-w-md grid-cols-2">
                        <TabsTrigger value="active" className="flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Active ({activeSubmissions.length})
                        </TabsTrigger>
                        <TabsTrigger value="trash" className="flex items-center gap-2">
                            <Archive className="w-4 h-4" />
                            Trash ({trashedSubmissions.length})
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Bulk Actions - Trash Tab Only */}
                {activeTab === 'trash' && trashedSubmissions.length > 0 && (
                    <div className="mb-4 flex items-center gap-4 p-4 rounded-lg bg-white border border-slate-200">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleSelectAll}
                            className="flex items-center gap-2"
                        >
                            {selectedIds.length === trashedSubmissions.length ? (
                                <CheckSquare className="w-4 h-4" />
                            ) : (
                                <Square className="w-4 h-4" />
                            )}
                            Select All ({selectedIds.length}/{trashedSubmissions.length})
                        </Button>
                        {selectedIds.length > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete Forever ({selectedIds.length})
                            </Button>
                        )}
                    </div>
                )}

                {/* Submissions List */}
                <div data-evaluated-list>
                {isLoading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <Card key={i} className="border-0 shadow-sm">
                                <CardContent className="p-6">
                                    <div className="flex items-start gap-4">
                                        <Skeleton className="w-12 h-12 rounded-xl" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-5 w-48" />
                                            <Skeleton className="h-4 w-32" />
                                        </div>
                                        <Skeleton className="h-10 w-24" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : submissions.length === 0 ? (
                    <Card className="border-0 shadow-md bg-white/90">
                        <CardContent className="py-16 text-center">
                            {activeTab === 'active' ? (
                                <>
                                    <FileText className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                                    <h3 className="text-xl font-semibold text-slate-800 mb-2">No Submissions Yet</h3>
                                    <p className="text-slate-500 mb-6">Start by evaluating your first manuscript</p>
                                    <Link to={createPageUrl('Evaluate')}>
                                        <Button className="bg-gradient-to-r from-indigo-600 to-purple-600">
                                            Start Evaluation
                                            <ChevronRight className="w-4 h-4 ml-2" />
                                        </Button>
                                    </Link>
                                </>
                            ) : (
                                <>
                                    <Archive className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                                    <h3 className="text-xl font-semibold text-slate-800 mb-2">Trash is Empty</h3>
                                    <p className="text-slate-500">Deleted submissions will appear here for 30 days</p>
                                </>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4" data-evaluated-list>
                        {submissions.map((submission, idx) => {
                            const statusConfig = getStatusConfig(submission.status);
                            const StatusIcon = statusConfig.icon;

                            return (
                                <motion.div
                                    key={submission.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                >
                                    <Link to={createPageUrl(`ViewReport?id=${submission.id}`)}>
                                        <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white/90 cursor-pointer">
                                            <CardContent className="p-6">
                                                <div className="flex items-start gap-4">
                                                    {activeTab === 'trash' && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                setSelectedIds(prev => 
                                                                    prev.includes(submission.id)
                                                                        ? prev.filter(id => id !== submission.id)
                                                                        : [...prev, submission.id]
                                                                );
                                                            }}
                                                            className="mt-1"
                                                        >
                                                            {selectedIds.includes(submission.id) ? (
                                                                <CheckSquare className="w-5 h-5 text-indigo-600" />
                                                            ) : (
                                                                <Square className="w-5 h-5 text-slate-400" />
                                                            )}
                                                        </button>
                                                    )}
                                                    <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 shrink-0">
                                                        <FileText className="w-6 h-6 text-indigo-600" />
                                                    </div>
                                                    
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div>
                                                                <h3 className="font-semibold text-slate-800 truncate">
                                                                    {submission.title || 'Untitled'}
                                                                </h3>
                                                                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                                                                    <span className="flex items-center gap-1">
                                                                        <Calendar className="w-4 h-4" />
                                                                        {format(new Date(submission.created_date), 'MMM d, yyyy')}
                                                                    </span>
                                                                    <span className="flex items-center gap-1">
                                                                        <Type className="w-4 h-4" />
                                                                        {submission.word_count?.toLocaleString() || 0} words
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            
                                                            <div className="flex items-center gap-3">
                                                               {submission.overall_score && (
                                                                   <div className="text-center px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                                                                       <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                                                                           <BarChart3 className="w-3 h-3" />
                                                                           Score
                                                                       </div>
                                                                       <p className={`text-2xl font-bold ${getScoreColor(submission.overall_score)}`}>
                                                                           {Math.round(submission.overall_score * 10)}
                                                                       </p>
                                                                   </div>
                                                               )}
                                                               <Badge className={statusConfig.color}>
                                                                   <StatusIcon className="w-3 h-3 mr-1" />
                                                                   {statusConfig.label}
                                                               </Badge>
                                                               {(submission.revised_text || submission.has_completed_revision) && (
                                                                  <Badge className="bg-emerald-100 text-emerald-700 border-0">
                                                                      <Sparkles className="w-3 h-3 mr-1" />
                                                                      Revised
                                                                  </Badge>
                                                               )}
                                                                {activeTab === 'active' ? (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        onClick={(e) => handleDelete(e, submission.id)}
                                                                        disabled={deleteMutation.isPending}
                                                                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                ) : (
                                                                    <div className="flex gap-2">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={(e) => handleRestore(e, submission.id)}
                                                                            disabled={restoreMutation.isPending}
                                                                            className="text-emerald-600 hover:bg-emerald-50"
                                                                        >
                                                                            Restore
                                                                        </Button>
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={(e) => handlePermanentDelete(e, submission.id)}
                                                                            disabled={permanentDeleteMutation.isPending}
                                                                            className="text-rose-600 hover:bg-rose-50"
                                                                        >
                                                                            Delete Forever
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {submission.text && (
                                                            <p className="mt-3 text-sm text-slate-500 line-clamp-2">
                                                                {submission.text.substring(0, 200)}...
                                                            </p>
                                                        )}

                                                        {activeTab === 'active' && (
                                                            <div className="mt-4 flex items-center gap-2 flex-wrap">
                                                                {submission.overall_score ? (
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Button
                                                                                    size="sm"
                                                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                                                                    onClick={(e) => handleStartRevision(e, submission)}
                                                                                    disabled={startRevisionMutation.isPending}
                                                                                >
                                                                                    <Edit3 className="w-3 h-3 mr-1" />
                                                                                    Start Revision
                                                                                </Button>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                Create a new revision session from this evaluation
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                ) : (
                                                                    <TooltipProvider>
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <div>
                                                                                    <Button
                                                                                        size="sm"
                                                                                        disabled
                                                                                        className="opacity-50"
                                                                                    >
                                                                                        <Edit3 className="w-3 h-3 mr-1" />
                                                                                        Start Revision
                                                                                    </Button>
                                                                                </div>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>
                                                                                This submission must be evaluated before a revision can begin
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    </TooltipProvider>
                                                                )}
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                    }}
                                                                >
                                                                    <FileText className="w-3 h-3 mr-1" />
                                                                    View Report
                                                                </Button>
                                                                {submission.revised_text || submission.session_id ? (
                                                                   <Button
                                                                       size="sm"
                                                                       variant="outline"
                                                                       className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                                       onClick={(e) => {
                                                                           e.preventDefault();
                                                                           e.stopPropagation();
                                                                           if (submission.revised_text) {
                                                                               const blob = new Blob([submission.revised_text], { type: 'text/plain' });
                                                                               const url = URL.createObjectURL(blob);
                                                                               const a = document.createElement('a');
                                                                               a.href = url;
                                                                               a.download = `${submission.title}_revised.txt`;
                                                                               a.click();
                                                                               URL.revokeObjectURL(url);
                                                                               toast.success('Revised text downloaded');
                                                                           } else if (submission.session_id) {
                                                                               window.location.href = createPageUrl(`Revise?session=${submission.session_id}`);
                                                                           }
                                                                       }}
                                                                   >
                                                                       <Download className="w-3 h-3 mr-1" />
                                                                       Download Revised
                                                                   </Button>
                                                                ) : null}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
                </div>
            </div>
        </div>
    );
}