import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    CheckCircle2, XCircle, AlertCircle, RefreshCw, 
    Loader2, Clock, ExternalLink 
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function AdminStoryGateOps() {
    const [runningCheck, setRunningCheck] = useState(false);

    const { data: user } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: healthLogs = [], isLoading, refetch } = useQuery({
        queryKey: ['routeHealthLogs'],
        queryFn: () => base44.entities.RouteHealthLog.list('-created_date', 100)
    });

    const runHealthCheck = async () => {
        setRunningCheck(true);
        try {
            const response = await base44.functions.invoke('checkRouteHealth', {});
            toast.success('Health check completed');
            refetch();
        } catch (error) {
            toast.error('Health check failed: ' + error.message);
        } finally {
            setRunningCheck(false);
        }
    };

    // Group logs by route
    const logsByRoute = healthLogs.reduce((acc, log) => {
        if (!acc[log.route]) acc[log.route] = [];
        acc[log.route].push(log);
        return acc;
    }, {});

    // Get latest status per route
    const routeStatuses = Object.keys(logsByRoute).map(route => {
        const logs = logsByRoute[route];
        const latest = logs[0];
        const recentErrors = logs.slice(0, 10).filter(l => l.status === 'error').length;
        return {
            route,
            status: latest.status,
            errorType: latest.error_type,
            lastChecked: latest.created_date,
            recentErrors
        };
    });

    if (!user || user.role !== 'admin') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
                <Card className="max-w-md">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="w-12 h-12 text-amber-600 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Admin Access Required</h2>
                        <p className="text-slate-600">This page is only accessible to administrators.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">StoryGate Ops Dashboard</h1>
                    <p className="text-slate-600">Production route health monitoring and incident tracking</p>
                </div>

                {/* Actions */}
                <div className="mb-8 flex gap-4">
                    <Button 
                        onClick={runHealthCheck} 
                        disabled={runningCheck}
                        className="bg-indigo-600 hover:bg-indigo-700"
                    >
                        {runningCheck ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Running Check...
                            </>
                        ) : (
                            <>
                                <RefreshCw className="w-4 h-4 mr-2" />
                                Run Health Check Now
                            </>
                        )}
                    </Button>
                    <Button 
                        variant="outline" 
                        onClick={() => refetch()}
                    >
                        Refresh Data
                    </Button>
                </div>

                {/* Route Status Cards */}
                <div className="grid md:grid-cols-2 gap-6 mb-8">
                    {routeStatuses.map(route => (
                        <Card key={route.route} className={
                            route.status === 'healthy' 
                                ? 'border-green-200' 
                                : 'border-red-200'
                        }>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg">{route.route}</CardTitle>
                                    {route.status === 'healthy' ? (
                                        <CheckCircle2 className="w-6 h-6 text-green-600" />
                                    ) : (
                                        <XCircle className="w-6 h-6 text-red-600" />
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600">Status:</span>
                                        <Badge className={
                                            route.status === 'healthy' 
                                                ? 'bg-green-100 text-green-700' 
                                                : 'bg-red-100 text-red-700'
                                        }>
                                            {route.status}
                                        </Badge>
                                    </div>
                                    {route.errorType && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600">Error Type:</span>
                                            <span className="text-red-700 font-medium">{route.errorType}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600">Recent Errors:</span>
                                        <span className={route.recentErrors > 0 ? 'text-red-700 font-medium' : 'text-slate-900'}>
                                            {route.recentErrors}/10
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-slate-600">Last Checked:</span>
                                        <span className="text-slate-900">
                                            {format(new Date(route.lastChecked), 'MMM d, HH:mm')}
                                        </span>
                                    </div>
                                    <a 
                                        href={`https://revisiongrade.com${route.route}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                                    >
                                        Test in browser <ExternalLink className="w-3 h-3" />
                                    </a>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {/* Recent Errors Log */}
                <Card>
                    <CardHeader>
                        <CardTitle>Recent Health Check Logs (Last 50)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {healthLogs.slice(0, 50).map((log, idx) => (
                                <div 
                                    key={log.id}
                                    className={`p-4 rounded-lg border ${
                                        log.status === 'error' 
                                            ? 'bg-red-50 border-red-200' 
                                            : 'bg-green-50 border-green-200'
                                    }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            {log.status === 'error' ? (
                                                <XCircle className="w-5 h-5 text-red-600" />
                                            ) : (
                                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                            )}
                                            <span className="font-semibold text-slate-900">{log.route}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-600">
                                            <Clock className="w-3 h-3" />
                                            {format(new Date(log.created_date), 'MMM d, HH:mm:ss')}
                                        </div>
                                    </div>
                                    {log.status === 'error' && (
                                        <div className="ml-7 space-y-1 text-sm">
                                            <div className="flex gap-2">
                                                <span className="text-slate-600">Error Type:</span>
                                                <span className="font-medium text-red-700">{log.error_type}</span>
                                            </div>
                                            {log.error_details && (
                                                <div className="flex gap-2">
                                                    <span className="text-slate-600">Details:</span>
                                                    <span className="text-slate-900">{log.error_details}</span>
                                                </div>
                                            )}
                                            {log.actual_title && (
                                                <div className="flex gap-2">
                                                    <span className="text-slate-600">Actual Title:</span>
                                                    <span className="text-slate-900">{log.actual_title}</span>
                                                </div>
                                            )}
                                            {log.http_status && (
                                                <div className="flex gap-2">
                                                    <span className="text-slate-600">HTTP Status:</span>
                                                    <span className="text-slate-900">{log.http_status}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {log.response_time_ms && (
                                        <div className="ml-7 text-xs text-slate-600 mt-1">
                                            Response time: {log.response_time_ms}ms
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Demand to Base44 */}
                <Card className="mt-8 border-2 border-amber-200 bg-amber-50">
                    <CardHeader>
                        <CardTitle className="text-amber-900">What to Demand from Base44</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm text-slate-700">
                        <div>
                            <h4 className="font-semibold text-slate-900 mb-2">For Every Incident:</h4>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Request ID / Trace ID from their logs</li>
                                <li>HTTP status and whether served by edge/CDN or origin</li>
                                <li>Final resolved route/component name</li>
                                <li>Build/deploy ID currently live</li>
                                <li>Error logs from: routing layer, SSR, client boot</li>
                                <li>Screenshot or HAR file from DevTools</li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="font-semibold text-slate-900 mb-2">Required Fixes:</h4>
                            <ul className="list-disc list-inside space-y-1 ml-2">
                                <li>Make blank pages impossible (render error shell with request ID)</li>
                                <li>Provide deployment logs and commit refs</li>
                                <li>Add health check endpoints they can verify</li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}