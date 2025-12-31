import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Lock, Shield, FileText, TrendingUp, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function StoryGatePortal() {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterGenre, setFilterGenre] = useState('all');
    const [filterFormat, setFilterFormat] = useState('all');

    const { data: user } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: industryUser } = useQuery({
        queryKey: ['industryUser', user?.email],
        queryFn: async () => {
            const results = await base44.entities.IndustryUser.filter({ user_email: user.email });
            return results[0];
        },
        enabled: !!user
    });

    const { data: listings = [], isLoading } = useQuery({
        queryKey: ['projectListings'],
        queryFn: async () => {
            return await base44.entities.ProjectListing.filter({ 
                visibility: 'discoverable',
                active: true 
            }, '-created_date');
        },
        enabled: !!industryUser && industryUser.verification_status === 'verified'
    });

    const handleRequestAccess = async (listingId) => {
        try {
            toast.loading('Requesting access...', { id: 'access' });
            await base44.functions.invoke('requestProjectAccess', {
                listing_id: listingId
            });
            toast.success('Access request sent to creator', { id: 'access' });
        } catch (error) {
            toast.error(error.message || 'Request failed', { id: 'access' });
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="p-6">
                        <p className="text-slate-600 mb-4">Please sign in to access StoryGate Portal</p>
                        <Button onClick={() => base44.auth.redirectToLogin()}>
                            Sign In
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!industryUser) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Card className="max-w-2xl">
                    <CardContent className="p-8">
                        <div className="text-center">
                            <Shield className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Industry Verification Required</h2>
                            <p className="text-slate-600 mb-6">
                                Access to StoryGate Portal requires verified industry credentials.
                            </p>
                            <Link to={createPageUrl('IndustryVerification')}>
                                <Button className="bg-indigo-600 hover:bg-indigo-700">
                                    Apply for Verification
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (industryUser.verification_status === 'pending') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Card className="max-w-2xl">
                    <CardContent className="p-8 text-center">
                        <Loader2 className="w-12 h-12 text-indigo-600 mx-auto mb-4 animate-spin" />
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Verification Pending</h2>
                        <p className="text-slate-600">
                            Your industry credentials are being reviewed. You'll be notified once approved.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (industryUser.verification_status === 'rejected' || industryUser.suspended) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Card className="max-w-2xl border-red-200">
                    <CardContent className="p-8 text-center">
                        <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
                        <p className="text-slate-600">
                            {industryUser.suspended 
                                ? 'Your account has been suspended. Please contact support.'
                                : 'Your verification application was not approved.'}
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const filteredListings = listings.filter(listing => {
        const matchesSearch = !searchQuery || 
            listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            listing.logline?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesGenre = filterGenre === 'all' || listing.genre === filterGenre;
        const matchesFormat = filterFormat === 'all' || listing.format === filterFormat;
        return matchesSearch && matchesGenre && matchesFormat;
    });

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-6 py-12">
                {/* Compliance Banner */}
                <Card className="mb-8 border-indigo-200 bg-indigo-50">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <Shield className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm text-indigo-900 font-medium mb-1">
                                    StoryGate Portal Disclaimer
                                </p>
                                <p className="text-xs text-indigo-800">
                                    StoryGate is not an agency, broker, or representative. Access to materials does not imply endorsement, 
                                    obligation, or commercial intent. All interactions occur solely between participating parties. All activity is logged.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">StoryGate Portal</h1>
                    <p className="text-slate-600">
                        Discover vetted creative works. Access requires creator approval.
                    </p>
                </div>

                {/* Filters */}
                <Card className="mb-6">
                    <CardContent className="p-4">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <Input
                                    placeholder="Search projects..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full"
                                />
                            </div>
                            <Button variant="outline" onClick={() => {
                                setSearchQuery('');
                                setFilterGenre('all');
                                setFilterFormat('all');
                            }}>
                                Clear
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Listings */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    </div>
                ) : filteredListings.length === 0 ? (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                            <p className="text-slate-600">No projects available</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-6">
                        {filteredListings.map(listing => (
                            <Card key={listing.id} className="hover:shadow-lg transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="text-xl font-bold text-slate-900 mb-2">{listing.title}</h3>
                                            <div className="flex gap-2 mb-3">
                                                <Badge variant="outline">{listing.format}</Badge>
                                                {listing.genre && <Badge variant="outline">{listing.genre}</Badge>}
                                                {listing.stage && <Badge variant="outline">{listing.stage}</Badge>}
                                            </div>
                                            {listing.logline && (
                                                <p className="text-sm text-slate-700 mb-3">{listing.logline}</p>
                                            )}
                                            {listing.synopsis_public && (
                                                <p className="text-sm text-slate-600 mb-3">{listing.synopsis_public}</p>
                                            )}
                                            <div className="flex items-center gap-4 text-sm text-slate-600">
                                                {listing.word_count && (
                                                    <span>{listing.word_count.toLocaleString()} words</span>
                                                )}
                                                {listing.revisiongrade_score && (
                                                    <div className="flex items-center gap-1">
                                                        <TrendingUp className="w-4 h-4" />
                                                        <span>RevisionGrade: {listing.revisiongrade_score.toFixed(1)}/10</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2 ml-4">
                                            <Button
                                                onClick={() => handleRequestAccess(listing.id)}
                                                className="bg-indigo-600 hover:bg-indigo-700"
                                            >
                                                <Lock className="w-4 h-4 mr-2" />
                                                Request Access
                                            </Button>
                                            {listing.access_requires_approval && (
                                                <p className="text-xs text-slate-500 text-center">Requires approval</p>
                                            )}
                                        </div>
                                    </div>
                                    {listing.materials_available?.length > 0 && (
                                        <div className="pt-3 border-t border-slate-200">
                                            <p className="text-xs text-slate-500 mb-1">Available materials:</p>
                                            <div className="flex gap-2">
                                                {listing.materials_available.map(material => (
                                                    <Badge key={material} variant="secondary" className="text-xs">
                                                        {material}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}