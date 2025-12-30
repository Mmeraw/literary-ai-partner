import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, AlertTriangle, TrendingDown, Filter } from 'lucide-react';
import { toast } from "sonner";

export default function FeedbackAnalytics() {
    const [loading, setLoading] = useState(false);
    const [analytics, setAnalytics] = useState(null);
    const [filters, setFilters] = useState({
        dateFrom: '',
        dateTo: '',
        manuscriptId: '',
        waveTierFilter: ''
    });

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const response = await base44.functions.invoke('analyzeFeedback', {
                format: 'json',
                ...filters
            });
            setAnalytics(response.data);
            toast.success('Analytics loaded');
        } catch (error) {
            toast.error('Failed to load analytics: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const exportCSV = async () => {
        try {
            const response = await base44.functions.invoke('analyzeFeedback', {
                format: 'csv',
                ...filters
            });
            
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `feedback_rejected_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            
            toast.success('CSV exported');
        } catch (error) {
            toast.error('Export failed: ' + error.message);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900">Feedback Analytics</h2>
                    <p className="text-sm text-slate-600">Analyze thumbs-down patterns and user comments</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={fetchAnalytics} disabled={loading}>
                        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Filter className="w-4 h-4 mr-2" />}
                        Load Analytics
                    </Button>
                    {analytics && (
                        <Button onClick={exportCSV} variant="outline">
                            <Download className="w-4 h-4 mr-2" />
                            Export CSV
                        </Button>
                    )}
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="text-xs text-slate-600 mb-1 block">Date From</label>
                            <Input 
                                type="date" 
                                value={filters.dateFrom}
                                onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-600 mb-1 block">Date To</label>
                            <Input 
                                type="date" 
                                value={filters.dateTo}
                                onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="text-xs text-slate-600 mb-1 block">Wave Tier</label>
                            <Select value={filters.waveTierFilter} onValueChange={(v) => setFilters({...filters, waveTierFilter: v})}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All Tiers" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={null}>All Tiers</SelectItem>
                                    <SelectItem value="early">Early (1-17)</SelectItem>
                                    <SelectItem value="mid">Mid (18-49)</SelectItem>
                                    <SelectItem value="late">Late (50-63)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="text-xs text-slate-600 mb-1 block">Manuscript ID</label>
                            <Input 
                                placeholder="Optional" 
                                value={filters.manuscriptId}
                                onChange={(e) => setFilters({...filters, manuscriptId: e.target.value})}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Summary Stats */}
            {analytics && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardContent className="p-6">
                                <div className="text-sm text-slate-600">Total Feedback Items</div>
                                <div className="text-3xl font-bold text-slate-900 mt-2">
                                    {analytics.summary.total_feedback_items}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-6">
                                <div className="text-sm text-slate-600">Total Rejected</div>
                                <div className="text-3xl font-bold text-rose-600 mt-2">
                                    {analytics.summary.total_rejected}
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-6">
                                <div className="text-sm text-slate-600">Overall Rejection Rate</div>
                                <div className="text-3xl font-bold text-amber-600 mt-2">
                                    {analytics.summary.overall_rejection_rate}%
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* By Wave Item */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Rejection Rate by Wave Item</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {analytics.by_wave_item.slice(0, 15).map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                                        <div className="flex items-center gap-3 flex-1">
                                            <Badge variant="outline" className="text-xs">W{item.wave_number}</Badge>
                                            <span className="text-sm font-medium text-slate-900">{item.wave_item}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-slate-600">{item.rejected_count}/{item.total_suggestions}</span>
                                            <Badge className={
                                                parseFloat(item.rejection_rate) > 50 ? 'bg-red-100 text-red-700' :
                                                parseFloat(item.rejection_rate) > 30 ? 'bg-amber-100 text-amber-700' :
                                                'bg-blue-100 text-blue-700'
                                            }>
                                                {item.rejection_rate}%
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* By Severity */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Rejection Rate by Severity</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {analytics.by_severity.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                                        <span className="text-sm font-medium text-slate-900 capitalize">{item.severity}</span>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-slate-600">{item.rejected_count}/{item.total_suggestions}</span>
                                            <Badge className="bg-amber-100 text-amber-700">
                                                {item.rejection_rate}%
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* By Register */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Rejection Rate by Register</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {analytics.by_register.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200">
                                        <span className="text-sm font-medium text-slate-900 capitalize">{item.register}</span>
                                        <div className="flex items-center gap-4">
                                            <span className="text-xs text-slate-600">{item.rejected_count}/{item.total_suggestions}</span>
                                            <Badge className={
                                                parseFloat(item.rejection_rate) > 40 ? 'bg-red-100 text-red-700' :
                                                'bg-blue-100 text-blue-700'
                                            }>
                                                {item.rejection_rate}%
                                            </Badge>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Most Rejected Suggestions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Most Recent Rejected Suggestions ({analytics.rejected_suggestions.length})</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                {analytics.rejected_suggestions.slice(0, 20).map((suggestion, idx) => (
                                    <div key={idx} className="p-4 rounded-lg border border-rose-200 bg-rose-50">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline">W{suggestion.wave_number}</Badge>
                                                <Badge className="bg-rose-100 text-rose-700">{suggestion.severity}</Badge>
                                                <Badge variant="outline">{suggestion.register}</Badge>
                                            </div>
                                            <span className="text-xs text-slate-500">{new Date(suggestion.created_date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="text-sm font-medium text-slate-900 mb-1">{suggestion.wave_item}</div>
                                        <div className="text-xs text-slate-600 mb-2 italic">"{suggestion.excerpt}..."</div>
                                        {suggestion.why_flagged && (
                                            <div className="text-xs text-slate-700 mb-2">
                                                <strong>Flagged:</strong> {suggestion.why_flagged}
                                            </div>
                                        )}
                                        {suggestion.feedback_comment && (
                                            <div className="text-xs text-rose-900 bg-rose-100 p-2 rounded">
                                                <strong>User Comment:</strong> {suggestion.feedback_comment}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {!analytics && !loading && (
                <Card>
                    <CardContent className="p-12 text-center">
                        <TrendingDown className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-600">Click "Load Analytics" to view feedback patterns</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}