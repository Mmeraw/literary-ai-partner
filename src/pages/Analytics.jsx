import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import FeedbackAnalytics from '@/components/analytics/FeedbackAnalytics';
import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
    Eye, Clock, Globe, Smartphone, Users, TrendingUp,
    Calendar, Monitor, Tablet, Phone, ThumbsDown
} from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export default function Analytics() {
    const [dateRange, setDateRange] = useState(7); // Last 7 days

    // Fetch analytics data
    const { data: analytics = [], isLoading } = useQuery({
        queryKey: ['analytics', dateRange],
        queryFn: async () => {
            const startDate = startOfDay(subDays(new Date(), dateRange));
            const allData = await base44.entities.Analytics.list('-created_date', 10000);
            return allData.filter(item => new Date(item.created_date) >= startDate);
        }
    });

    // Calculate metrics
    const metrics = useMemo(() => {
        const uniqueVisitors = new Set(analytics.map(a => a.visitor_id)).size;
        const uniqueSessions = new Set(analytics.map(a => a.session_id)).size;
        const authenticatedUsers = new Set(analytics.filter(a => a.user_id).map(a => a.user_id)).size;
        
        return {
            totalViews: analytics.length,
            uniqueVisitors,
            uniqueSessions,
            authenticatedUsers,
            avgSessionLength: uniqueSessions > 0 ? (analytics.length / uniqueSessions).toFixed(1) : 0
        };
    }, [analytics]);

    // Page views by page
    const pageViews = useMemo(() => {
        const counts = {};
        analytics.forEach(a => {
            counts[a.page] = (counts[a.page] || 0) + 1;
        });
        return Object.entries(counts)
            .map(([page, views]) => ({ page, views }))
            .sort((a, b) => b.views - a.views);
    }, [analytics]);

    // Views by hour of day
    const viewsByHour = useMemo(() => {
        const hours = Array(24).fill(0);
        analytics.forEach(a => {
            const hour = new Date(a.created_date).getHours();
            hours[hour]++;
        });
        return hours.map((count, hour) => ({
            hour: `${hour}:00`,
            views: count
        }));
    }, [analytics]);

    // Views by day
    const viewsByDay = useMemo(() => {
        const days = {};
        analytics.forEach(a => {
            const day = format(new Date(a.created_date), 'MMM dd');
            days[day] = (days[day] || 0) + 1;
        });
        return Object.entries(days).map(([date, views]) => ({ date, views }));
    }, [analytics]);

    // Device breakdown
    const deviceBreakdown = useMemo(() => {
        const devices = {};
        analytics.forEach(a => {
            devices[a.device_type] = (devices[a.device_type] || 0) + 1;
        });
        return Object.entries(devices).map(([name, value]) => ({ name, value }));
    }, [analytics]);

    // Referrer sources
    const referrerSources = useMemo(() => {
        const sources = {};
        analytics.forEach(a => {
            const ref = a.referrer === 'direct' ? 'Direct' : new URL(a.referrer).hostname;
            sources[ref] = (sources[ref] || 0) + 1;
        });
        return Object.entries(sources)
            .map(([source, count]) => ({ source, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
    }, [analytics]);

    const getDeviceIcon = (type) => {
        switch (type) {
            case 'mobile': return <Phone className="w-4 h-4" />;
            case 'tablet': return <Tablet className="w-4 h-4" />;
            default: return <Monitor className="w-4 h-4" />;
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-slate-600">Loading analytics...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Analytics Dashboard</h1>
                    <p className="text-slate-600">Track visitor behavior and usage patterns</p>
                    
                    <div className="flex gap-2 mt-4">
                        {[7, 14, 30, 90].map(days => (
                            <Badge
                                key={days}
                                variant={dateRange === days ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => setDateRange(days)}
                            >
                                Last {days} days
                            </Badge>
                        ))}
                    </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-600">Total Views</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="text-2xl font-bold">{metrics.totalViews}</div>
                                <Eye className="w-5 h-5 text-indigo-600" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-600">Unique Visitors</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="text-2xl font-bold">{metrics.uniqueVisitors}</div>
                                <Users className="w-5 h-5 text-purple-600" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-600">Sessions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="text-2xl font-bold">{metrics.uniqueSessions}</div>
                                <TrendingUp className="w-5 h-5 text-green-600" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-600">Signed-In Users</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="text-2xl font-bold">{metrics.authenticatedUsers}</div>
                                <Users className="w-5 h-5 text-blue-600" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-medium text-slate-600">Avg Pages/Session</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="text-2xl font-bold">{metrics.avgSessionLength}</div>
                                <Calendar className="w-5 h-5 text-orange-600" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Charts */}
                <Tabs defaultValue="pages" className="space-y-6">
                    <TabsList>
                        <TabsTrigger value="pages">Pages</TabsTrigger>
                        <TabsTrigger value="time">Time Patterns</TabsTrigger>
                        <TabsTrigger value="devices">Devices</TabsTrigger>
                        <TabsTrigger value="sources">Traffic Sources</TabsTrigger>
                        <TabsTrigger value="feedback">
                            <ThumbsDown className="w-4 h-4 mr-2" />
                            Feedback
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pages">
                        <Card>
                            <CardHeader>
                                <CardTitle>Page Views</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ResponsiveContainer width="100%" height={400}>
                                    <BarChart data={pageViews}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis dataKey="page" />
                                        <YAxis />
                                        <Tooltip />
                                        <Bar dataKey="views" fill="#6366f1" />
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="time">
                        <div className="grid gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Views by Hour of Day</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <LineChart data={viewsByHour}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="hour" />
                                            <YAxis />
                                            <Tooltip />
                                            <Line type="monotone" dataKey="views" stroke="#8b5cf6" strokeWidth={2} />
                                        </LineChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Views by Day</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={viewsByDay}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" />
                                            <YAxis />
                                            <Tooltip />
                                            <Bar dataKey="views" fill="#ec4899" />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="devices">
                        <div className="grid md:grid-cols-2 gap-6">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Device Distribution</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <PieChart>
                                            <Pie
                                                data={deviceBreakdown}
                                                cx="50%"
                                                cy="50%"
                                                labelLine={false}
                                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                                outerRadius={100}
                                                fill="#8884d8"
                                                dataKey="value"
                                            >
                                                {deviceBreakdown.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Device Breakdown</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {deviceBreakdown.map((device, idx) => (
                                            <div key={device.name} className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-lg`} style={{ backgroundColor: COLORS[idx % COLORS.length] + '20' }}>
                                                        {getDeviceIcon(device.name)}
                                                    </div>
                                                    <span className="capitalize font-medium">{device.name}</span>
                                                </div>
                                                <Badge>{device.value} views</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </TabsContent>

                    <TabsContent value="sources">
                        <Card>
                            <CardHeader>
                                <CardTitle>Top Traffic Sources</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {referrerSources.map((source, idx) => (
                                        <div key={source.source} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
                                                    {idx + 1}
                                                </div>
                                                <span className="font-medium">{source.source}</span>
                                            </div>
                                            <Badge variant="outline">{source.count} visits</Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="feedback">
                        <FeedbackAnalytics />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}