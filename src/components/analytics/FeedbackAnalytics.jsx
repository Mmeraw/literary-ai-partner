import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Loader2, AlertTriangle, TrendingDown, Filter, BarChart3 } from 'lucide-react';
import { toast } from "sonner";
import {
    BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
    Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';

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

                    {/* Wave Item Charts */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="w-5 h-5" />
                                Top Rejected Wave Items
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={400}>
                                <BarChart 
                                    data={analytics.by_wave_item.slice(0, 10)}
                                    layout="vertical"
                                    margin={{ left: 150, right: 20, top: 5, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" />
                                    <YAxis 
                                        type="category" 
                                        dataKey="wave_item" 
                                        width={140}
                                        tick={{ fontSize: 11 }}
                                    />
                                    <Tooltip 
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-lg">
                                                        <div className="font-semibold text-sm mb-1">{data.wave_item}</div>
                                                        <div className="text-xs text-slate-600">Wave {data.wave_number}</div>
                                                        <div className="text-xs text-rose-600 font-medium mt-1">
                                                            {data.rejected_count} rejected / {data.total_suggestions} total
                                                        </div>
                                                        <div className="text-xs text-rose-700 font-bold mt-1">
                                                            {data.rejection_rate}% rejection rate
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="rejected_count" radius={[0, 4, 4, 0]}>
                                        {analytics.by_wave_item.slice(0, 10).map((entry, index) => (
                                            <Cell 
                                                key={`cell-${index}`} 
                                                fill={
                                                    parseFloat(entry.rejection_rate) > 50 ? '#dc2626' :
                                                    parseFloat(entry.rejection_rate) > 30 ? '#f59e0b' :
                                                    '#6366f1'
                                                }
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Severity x Register Grid */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="w-5 h-5" />
                                Rejection Rate by Severity & Register
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart 
                                    data={analytics.by_register}
                                    margin={{ left: 20, right: 20, top: 5, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="register" tick={{ fontSize: 11 }} />
                                    <YAxis label={{ value: 'Rejected Count', angle: -90, position: 'insideLeft' }} />
                                    <Tooltip />
                                    <Legend />
                                    <Bar dataKey="rejected_count" fill="#dc2626" name="Rejected" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="total_suggestions" fill="#6366f1" name="Total" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Time Series */}
                    {analytics.daily_trend?.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5" />
                                    Rejection Trend Over Time
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={analytics.daily_trend}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis 
                                            dataKey="date" 
                                            tick={{ fontSize: 11 }}
                                            tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        />
                                        <YAxis label={{ value: 'Rejections', angle: -90, position: 'insideLeft' }} />
                                        <Tooltip 
                                            labelFormatter={(date) => new Date(date).toLocaleDateString()}
                                            formatter={(value) => [value, 'Rejections']}
                                        />
                                        <Line 
                                            type="monotone" 
                                            dataKey="rejections" 
                                            stroke="#dc2626" 
                                            strokeWidth={2}
                                            dot={{ fill: '#dc2626' }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    )}

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