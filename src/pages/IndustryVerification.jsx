import React, { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Shield, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function IndustryVerification() {
    const [formData, setFormData] = useState({
        full_name: '',
        company: '',
        role_type: '',
        bio: '',
        linkedin_url: '',
        imdb_url: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: user } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me()
    });

    const { data: existingApplication } = useQuery({
        queryKey: ['industryUser', user?.email],
        queryFn: async () => {
            const results = await base44.entities.IndustryUser.filter({ user_email: user.email });
            return results[0];
        },
        enabled: !!user
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!formData.full_name || !formData.company || !formData.role_type) {
            toast.error('Please fill in all required fields');
            return;
        }

        setIsSubmitting(true);

        try {
            if (existingApplication) {
                await base44.entities.IndustryUser.update(existingApplication.id, {
                    ...formData,
                    user_email: user.email,
                    verification_status: 'pending'
                });
            } else {
                await base44.entities.IndustryUser.create({
                    ...formData,
                    user_email: user.email,
                    verification_status: 'pending'
                });
            }

            toast.success('Verification application submitted');
        } catch (error) {
            toast.error('Failed to submit application');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Button onClick={() => base44.auth.redirectToLogin()}>Sign In</Button>
            </div>
        );
    }

    if (existingApplication?.verification_status === 'verified') {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Card className="max-w-lg">
                    <CardContent className="p-8 text-center">
                        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">Verified</h2>
                        <p className="text-slate-600 mb-4">
                            Your industry credentials are verified. You can access StoryGate Portal.
                        </p>
                        <Button onClick={() => window.location.href = '/StoryGatePortal'}>
                            Go to Portal
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-3xl mx-auto px-6 py-12">
                <div className="text-center mb-8">
                    <Shield className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Industry Verification</h1>
                    <p className="text-slate-600">
                        Apply for verified access to StoryGate Portal
                    </p>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Verification Application</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Full Name *
                                </label>
                                <Input
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Company / Agency *
                                </label>
                                <Input
                                    value={formData.company}
                                    onChange={(e) => setFormData({...formData, company: e.target.value})}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Role *
                                </label>
                                <Select 
                                    value={formData.role_type} 
                                    onValueChange={(value) => setFormData({...formData, role_type: value})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="agent">Literary Agent</SelectItem>
                                        <SelectItem value="producer">Producer</SelectItem>
                                        <SelectItem value="executive">Executive</SelectItem>
                                        <SelectItem value="manager">Manager</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Professional Bio
                                </label>
                                <Textarea
                                    value={formData.bio}
                                    onChange={(e) => setFormData({...formData, bio: e.target.value})}
                                    placeholder="Brief bio and credentials"
                                    className="h-24"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    LinkedIn Profile URL
                                </label>
                                <Input
                                    type="url"
                                    value={formData.linkedin_url}
                                    onChange={(e) => setFormData({...formData, linkedin_url: e.target.value})}
                                    placeholder="https://linkedin.com/in/..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    IMDb Profile URL (if applicable)
                                </label>
                                <Input
                                    type="url"
                                    value={formData.imdb_url}
                                    onChange={(e) => setFormData({...formData, imdb_url: e.target.value})}
                                    placeholder="https://imdb.com/name/..."
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    'Submit Application'
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}