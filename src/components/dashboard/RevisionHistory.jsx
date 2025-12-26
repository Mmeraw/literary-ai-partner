import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GitBranch, Clock, CheckCircle2, Pause, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';

export default function RevisionHistory({ revisionSessions }) {
    const getStatusConfig = (status) => {
        const configs = {
            in_progress: { 
                icon: Clock, 
                label: 'In Progress', 
                color: 'bg-blue-100 text-blue-700' 
            },
            completed: { 
                icon: CheckCircle2, 
                label: 'Completed', 
                color: 'bg-emerald-100 text-emerald-700' 
            },
            paused: { 
                icon: Pause, 
                label: 'Paused', 
                color: 'bg-amber-100 text-amber-700' 
            }
        };
        return configs[status] || configs.in_progress;
    };

    return (
        <div>
            <h2 className="text-xl font-semibold text-slate-900 mb-4">Revision History</h2>
            {revisionSessions.length === 0 ? (
                <Card>
                    <CardContent className="p-8 text-center">
                        <GitBranch className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                        <p className="text-slate-600 mb-4">No revision sessions yet</p>
                        <p className="text-sm text-slate-500">
                            Start a Wave Revision session from any evaluation
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {revisionSessions.map((session) => {
                        const statusConfig = getStatusConfig(session.status);
                        const totalSuggestions = session.suggestions?.length || 0;
                        const acceptedCount = session.suggestions?.filter(s => s.status === 'accepted').length || 0;
                        const progress = totalSuggestions > 0 
                            ? Math.round((acceptedCount / totalSuggestions) * 100) 
                            : 0;

                        return (
                            <Card key={session.id} className="hover:shadow-lg transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="font-semibold text-lg text-slate-900 mb-2">
                                                {session.title}
                                            </h3>
                                            <div className="flex items-center gap-4 text-sm text-slate-600">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    {format(new Date(session.created_date), 'MMM d, yyyy')}
                                                </div>
                                                {totalSuggestions > 0 && (
                                                    <div>
                                                        {acceptedCount}/{totalSuggestions} suggestions reviewed
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <Badge className={statusConfig.color}>
                                            <statusConfig.icon className="w-3 h-3 mr-1" />
                                            {statusConfig.label}
                                        </Badge>
                                    </div>

                                    {totalSuggestions > 0 && (
                                        <div className="mb-4">
                                            <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                                                <span>Progress</span>
                                                <span>{progress}%</span>
                                            </div>
                                            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                                                    style={{ width: `${progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {session.status === 'in_progress' && (
                                        <Link to={createPageUrl(`Revise?sessionId=${session.id}`)}>
                                            <Button variant="outline" size="sm" className="w-full">
                                                <Eye className="w-4 h-4 mr-2" />
                                                Continue Revision
                                            </Button>
                                        </Link>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}