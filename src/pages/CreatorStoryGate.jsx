import React, { useState } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Eye, EyeOff, Lock, Unlock, Check, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function CreatorStoryGate() {
    const queryClient = useQueryClient();

    const { data: user } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: manuscripts = [], isLoading: loadingManuscripts } = useQuery({
        queryKey: ['userManuscripts'],
        queryFn: () => base44.entities.Manuscript.filter({ 
            created_by: user.email,
            is_final: true 
        }),
        enabled: !!user
    });

    const { data: listings = [], isLoading: loadingListings } = useQuery({
        queryKey: ['userListings'],
        queryFn: () => base44.entities.ProjectListing.filter({ creator_email: user.email }),
        enabled: !!user
    });

    const { data: accessRequests = [], isLoading: loadingRequests } = useQuery({
        queryKey: ['accessRequests'],
        queryFn: async () => {
            const unlocks = await base44.entities.AccessUnlock.filter({ 
                creator_email: user.email 
            }, '-requested_at');
            
            // Enrich with industry user info
            const enriched = await Promise.all(unlocks.map(async unlock => {
                const industryUsers = await base44.entities.IndustryUser.filter({ 
                    user_email: unlock.industry_user_email 
                });
                const listing = listings.find(l => l.id === unlock.project_listing_id);
                return {
                    ...unlock,
                    industry_user: industryUsers[0],
                    listing
                };
            }));
            return enriched;
        },
        enabled: !!user && listings.length > 0
    });

    const handleVisibilityChange = async (listingId, newVisibility) => {
        try {
            await base44.entities.ProjectListing.update(listingId, { visibility: newVisibility });
            toast.success('Visibility updated');
            queryClient.invalidateQueries({ queryKey: ['userListings'] });
        } catch (error) {
            toast.error('Failed to update visibility');
        }
    };

    const handleAccessRequest = async (unlockId, action) => {
        try {
            toast.loading(`${action === 'approve' ? 'Approving' : action === 'deny' ? 'Denying' : 'Revoking'}...`, { id: 'access' });
            await base44.functions.invoke('handleAccessRequest', {
                unlock_id: unlockId,
                action
            });
            toast.success(`Access ${action}d`, { id: 'access' });
            queryClient.invalidateQueries({ queryKey: ['accessRequests'] });
        } catch (error) {
            toast.error(error.message || 'Action failed', { id: 'access' });
        }
    };

    const pendingRequests = accessRequests.filter(r => r.status === 'pending');
    const activeAccess = accessRequests.filter(r => r.status === 'approved');

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">StoryGate Creator Dashboard</h1>
                    <p className="text-slate-600">
                        Manage project visibility and access requests
                    </p>
                </div>

                {/* Pending Requests */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-600" />
                            Pending Access Requests ({pendingRequests.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingRequests ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                            </div>
                        ) : pendingRequests.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-6">No pending requests</p>
                        ) : (
                            <div className="space-y-4">
                                {pendingRequests.map(request => (
                                    <div key={request.id} className="p-4 rounded-lg border border-amber-200 bg-amber-50">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-slate-900 mb-1">
                                                    {request.listing?.title || 'Unknown Project'}
                                                </h4>
                                                <p className="text-sm text-slate-700 mb-2">
                                                    <strong>{request.industry_user?.full_name}</strong> ({request.industry_user?.company})
                                                </p>
                                                {request.request_message && (
                                                    <p className="text-sm text-slate-600 italic mb-2">
                                                        "{request.request_message}"
                                                    </p>
                                                )}
                                                <p className="text-xs text-slate-500">
                                                    Requested {new Date(request.requested_at).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleAccessRequest(request.id, 'approve')}
                                                    className="bg-green-600 hover:bg-green-700"
                                                >
                                                    <Check className="w-4 h-4 mr-1" />
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleAccessRequest(request.id, 'deny')}
                                                >
                                                    <X className="w-4 h-4 mr-1" />
                                                    Deny
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Active Access */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Active Access ({activeAccess.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {activeAccess.length === 0 ? (
                            <p className="text-sm text-slate-500 text-center py-6">No active access granted</p>
                        ) : (
                            <div className="space-y-3">
                                {activeAccess.map(access => (
                                    <div key={access.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                                        <div>
                                            <p className="font-medium text-slate-900">
                                                {access.listing?.title || 'Unknown Project'}
                                            </p>
                                            <p className="text-sm text-slate-600">
                                                {access.industry_user?.full_name} ({access.industry_user?.company})
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                Approved {new Date(access.approved_at).toLocaleString()}
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleAccessRequest(access.id, 'revoke')}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            Revoke
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Project Listings */}
                <Card>
                    <CardHeader>
                        <CardTitle>Your Project Listings</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingListings || loadingManuscripts ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                            </div>
                        ) : listings.length === 0 ? (
                            <div className="text-center py-8">
                                <p className="text-slate-600 mb-4">No projects listed on StoryGate yet</p>
                                <p className="text-sm text-slate-500 mb-4">
                                    Only final manuscripts can be listed
                                </p>
                                {manuscripts.length > 0 ? (
                                    <Button>Create Listing from Final Manuscript</Button>
                                ) : (
                                    <p className="text-sm text-slate-500">
                                        Mark a manuscript as Final to enable StoryGate listing
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {listings.map(listing => (
                                    <div key={listing.id} className="p-4 rounded-lg border border-slate-200">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-slate-900 mb-1">{listing.title}</h4>
                                                <div className="flex gap-2 mb-2">
                                                    <Badge variant="outline">{listing.format}</Badge>
                                                    {listing.genre && <Badge variant="outline">{listing.genre}</Badge>}
                                                </div>
                                            </div>
                                            <Badge className={
                                                listing.visibility === 'private' ? 'bg-slate-100 text-slate-700' :
                                                listing.visibility === 'discoverable' ? 'bg-green-100 text-green-700' :
                                                'bg-amber-100 text-amber-700'
                                            }>
                                                {listing.visibility === 'private' ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                                                {listing.visibility}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <label className="flex items-center gap-2">
                                                <span className="text-slate-600">Visibility:</span>
                                                <select
                                                    value={listing.visibility}
                                                    onChange={(e) => handleVisibilityChange(listing.id, e.target.value)}
                                                    className="rounded border-slate-300 text-sm"
                                                >
                                                    <option value="private">Private</option>
                                                    <option value="discoverable">Discoverable</option>
                                                    <option value="restricted">Restricted</option>
                                                </select>
                                            </label>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}