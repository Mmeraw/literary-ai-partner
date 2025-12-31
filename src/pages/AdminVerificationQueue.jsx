import React, { useState } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Shield, Check, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminVerificationQueue() {
    const [filter, setFilter] = useState('pending');
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const queryClient = useQueryClient();

    const { data: user } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: requests = [], isLoading } = useQuery({
        queryKey: ['verificationRequests', filter],
        queryFn: async () => {
            if (filter === 'all') {
                return await base44.entities.IndustryUser.list('-created_date');
            }
            return await base44.entities.IndustryUser.filter({ 
                verification_status: filter 
            }, '-created_date');
        },
        enabled: !!user && user.role === 'admin'
    });

    const handleApprove = async (requestId) => {
        try {
            toast.loading('Approving...', { id: 'verify' });
            await base44.functions.invoke('handleVerification', {
                request_id: requestId,
                action: 'approve'
            });
            toast.success('Verification approved', { id: 'verify' });
            queryClient.invalidateQueries({ queryKey: ['verificationRequests'] });
            setSelectedRequest(null);
        } catch (error) {
            toast.error(error.message || 'Approval failed', { id: 'verify' });
        }
    };

    const handleReject = async (requestId) => {
        if (!rejectionReason.trim()) {
            toast.error('Rejection reason required');
            return;
        }
        try {
            toast.loading('Rejecting...', { id: 'verify' });
            await base44.functions.invoke('handleVerification', {
                request_id: requestId,
                action: 'reject',
                reason: rejectionReason
            });
            toast.success('Verification rejected', { id: 'verify' });
            queryClient.invalidateQueries({ queryKey: ['verificationRequests'] });
            setSelectedRequest(null);
            setRejectionReason('');
        } catch (error) {
            toast.error(error.message || 'Rejection failed', { id: 'verify' });
        }
    };

    if (!user || user.role !== 'admin') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Card className="max-w-md">
                    <CardContent className="p-6 text-center">
                        <p className="text-red-600 font-semibold mb-2">Access Denied</p>
                        <p className="text-slate-600">Admin access required</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const pendingCount = requests.filter(r => r.verification_status === 'pending').length;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-6 py-12">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Verification Queue</h1>
                    <p className="text-slate-600">
                        Review and approve industry professional verification requests
                    </p>
                </div>

                {/* Filters */}
                <Card className="mb-6">
                    <CardContent className="p-4">
                        <div className="flex gap-2">
                            <Button
                                variant={filter === 'pending' ? 'default' : 'outline'}
                                onClick={() => setFilter('pending')}
                            >
                                Pending ({pendingCount})
                            </Button>
                            <Button
                                variant={filter === 'verified' ? 'default' : 'outline'}
                                onClick={() => setFilter('verified')}
                            >
                                Approved
                            </Button>
                            <Button
                                variant={filter === 'rejected' ? 'default' : 'outline'}
                                onClick={() => setFilter('rejected')}
                            >
                                Rejected
                            </Button>
                            <Button
                                variant={filter === 'all' ? 'default' : 'outline'}
                                onClick={() => setFilter('all')}
                            >
                                All
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Request List */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    </div>
                ) : requests.length === 0 ? (
                    <Card>
                        <CardContent className="p-12 text-center">
                            <Shield className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                            <p className="text-slate-600">No requests found</p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4">
                        {requests.map(request => (
                            <Card key={request.id} className="hover:shadow-lg transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-3">
                                                <h3 className="text-xl font-bold text-slate-900">
                                                    {request.full_name}
                                                </h3>
                                                <Badge className={
                                                    request.verification_status === 'verified' ? 'bg-green-100 text-green-700' :
                                                    request.verification_status === 'rejected' ? 'bg-red-100 text-red-700' :
                                                    request.verification_status === 'revoked' ? 'bg-slate-100 text-slate-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }>
                                                    {request.verification_status}
                                                </Badge>
                                            </div>
                                            <div className="grid md:grid-cols-2 gap-2 text-sm text-slate-700 mb-3">
                                                <div><strong>Company:</strong> {request.company}</div>
                                                <div><strong>Role:</strong> {request.role_type}</div>
                                                <div><strong>Email:</strong> {request.user_email}</div>
                                                <div><strong>Submitted:</strong> {new Date(request.created_date).toLocaleDateString()}</div>
                                            </div>
                                            {request.bio && (
                                                <p className="text-sm text-slate-600 mb-3">{request.bio}</p>
                                            )}
                                            <div className="flex gap-3">
                                                {request.linkedin_url && (
                                                    <a 
                                                        href={request.linkedin_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                                    >
                                                        LinkedIn <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                                {request.imdb_url && (
                                                    <a 
                                                        href={request.imdb_url} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                                                    >
                                                        IMDb <ExternalLink className="w-3 h-3" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                        {request.verification_status === 'pending' && (
                                            <div className="flex flex-col gap-2 ml-4">
                                                <Button
                                                    size="sm"
                                                    onClick={() => handleApprove(request.id)}
                                                    className="bg-green-600 hover:bg-green-700"
                                                >
                                                    <Check className="w-4 h-4 mr-1" />
                                                    Approve
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setSelectedRequest(request)}
                                                >
                                                    <X className="w-4 h-4 mr-1" />
                                                    Reject
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                {/* Rejection Modal */}
                {selectedRequest && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <Card className="max-w-lg w-full mx-4">
                            <CardHeader>
                                <CardTitle>Reject Verification Request</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-slate-600 mb-4">
                                    Rejecting: <strong>{selectedRequest.full_name}</strong>
                                </p>
                                <Textarea
                                    placeholder="Enter rejection reason (required)"
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    className="mb-4"
                                />
                                <div className="flex gap-2">
                                    <Button
                                        onClick={() => handleReject(selectedRequest.id)}
                                        className="bg-red-600 hover:bg-red-700"
                                    >
                                        Confirm Rejection
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setSelectedRequest(null);
                                            setRejectionReason('');
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}