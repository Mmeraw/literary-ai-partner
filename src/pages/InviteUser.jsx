import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Mail, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function InviteUser() {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('user');
    const [loading, setLoading] = useState(false);
    const [user, setUser] = useState(null);

    React.useEffect(() => {
        const checkAuth = async () => {
            try {
                const userData = await base44.auth.me();
                setUser(userData);
                
                if (userData.role !== 'admin') {
                    toast.error('Only admins can invite users');
                }
            } catch (err) {
                toast.error('Please log in');
            }
        };
        checkAuth();
    }, []);

    const handleInvite = async (e) => {
        e.preventDefault();
        
        if (!email) {
            toast.error('Please enter an email address');
            return;
        }

        if (user?.role !== 'admin') {
            toast.error('Only admins can invite users');
            return;
        }

        setLoading(true);
        try {
            await base44.users.inviteUser(email, role);
            toast.success(`Invitation sent to ${email}!`);
            setEmail('');
        } catch (error) {
            console.error('Invite error:', error);
            toast.error(error.message || 'Failed to send invitation');
        } finally {
            setLoading(false);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (user.role !== 'admin') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-6">
                <Card className="max-w-md">
                    <CardContent className="pt-6 text-center">
                        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-slate-900 mb-2">Admin Access Required</h2>
                        <p className="text-slate-600">Only administrators can invite users to this app.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-12">
            <div className="max-w-2xl mx-auto px-6">
                <div className="text-center mb-8">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <UserPlus className="w-4 h-4 mr-2" />
                        Admin Only
                    </Badge>
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">
                        Invite Users
                    </h1>
                    <p className="text-slate-600">
                        Send invitations to allow specific people to access the app
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Send Invitation</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleInvite} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                    <Input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="user@example.com"
                                        className="pl-10"
                                        disabled={loading}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Role
                                </label>
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setRole('user')}
                                        className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                                            role === 'user'
                                                ? 'border-indigo-600 bg-indigo-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                        disabled={loading}
                                    >
                                        <div className="font-medium text-slate-900">User</div>
                                        <div className="text-xs text-slate-600">Regular access</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRole('admin')}
                                        className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                                            role === 'admin'
                                                ? 'border-indigo-600 bg-indigo-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                        disabled={loading}
                                    >
                                        <div className="font-medium text-slate-900">Admin</div>
                                        <div className="text-xs text-slate-600">Can invite others</div>
                                    </button>
                                </div>
                            </div>

                            <Button
                                type="submit"
                                className="w-full bg-indigo-600 hover:bg-indigo-700"
                                disabled={loading || !email}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Sending Invitation...
                                    </>
                                ) : (
                                    <>
                                        <UserPlus className="w-4 h-4 mr-2" />
                                        Send Invitation
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="mt-6 border-indigo-100">
                    <CardContent className="pt-6">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                            <div className="text-sm text-slate-600 space-y-2">
                                <p>
                                    <strong>How it works:</strong> The invited person will receive an email with a link to create their account and access the app.
                                </p>
                                <p>
                                    <strong>Regular users</strong> can access all features but cannot invite others.
                                </p>
                                <p>
                                    <strong>Admin users</strong> can invite additional users (both regular and admin roles).
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}