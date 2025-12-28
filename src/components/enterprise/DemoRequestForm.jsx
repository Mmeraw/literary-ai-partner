import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function DemoRequestForm({ onClose }) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        company: '',
        role: '',
        organization_type: '',
        team_size: '',
        use_case: '',
        phone: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Send email notification
            await base44.integrations.Core.SendEmail({
                to: 'michael@revisiongrade.com',
                subject: `Enterprise Demo Request: ${formData.company}`,
                body: `
New Enterprise Demo Request:

Name: ${formData.name}
Email: ${formData.email}
Company: ${formData.company}
Role: ${formData.role}
Organization Type: ${formData.organization_type}
Team Size: ${formData.team_size}
Phone: ${formData.phone || 'Not provided'}

Use Case:
${formData.use_case}
                `
            });

            setIsSubmitted(true);
            toast.success('Demo request submitted! We\'ll contact you within 24 hours.');
        } catch (error) {
            console.error('Demo request error:', error);
            toast.error('Failed to submit demo request. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <Card className="max-w-md w-full border-0 shadow-2xl">
                    <CardContent className="pt-12 pb-8 text-center">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 mb-2">Request Received!</h3>
                        <p className="text-slate-600 mb-6">
                            We'll contact you within 24 hours to schedule your demo.
                        </p>
                        <Button onClick={onClose} className="w-full">
                            Close
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <Card className="max-w-2xl w-full border-0 shadow-2xl my-8">
                <CardHeader className="relative">
                    <button
                        onClick={onClose}
                        className="absolute right-4 top-4 p-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                    <CardTitle className="text-2xl">Request Enterprise Demo</CardTitle>
                    <p className="text-sm text-slate-600 mt-2">
                        See how RevisionGrade™ Enterprise can scale your editorial operations
                    </p>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Full Name *
                                </label>
                                <Input
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="John Smith"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Work Email *
                                </label>
                                <Input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="john@agency.com"
                                />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Company/Organization *
                                </label>
                                <Input
                                    required
                                    value={formData.company}
                                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                    placeholder="Acme Literary Agency"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Your Role *
                                </label>
                                <Input
                                    required
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    placeholder="Managing Director"
                                />
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Organization Type *
                                </label>
                                <select
                                    required
                                    value={formData.organization_type}
                                    onChange={(e) => setFormData({ ...formData, organization_type: e.target.value })}
                                    className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                                >
                                    <option value="">Select type...</option>
                                    <option value="literary_agency">Literary Agency</option>
                                    <option value="publishing_house">Publishing House</option>
                                    <option value="mfa_program">MFA Program</option>
                                    <option value="content_studio">Content Studio</option>
                                    <option value="editing_collective">Editing Collective</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Team Size *
                                </label>
                                <select
                                    required
                                    value={formData.team_size}
                                    onChange={(e) => setFormData({ ...formData, team_size: e.target.value })}
                                    className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                                >
                                    <option value="">Select size...</option>
                                    <option value="3-10">3-10 people</option>
                                    <option value="11-25">11-25 people</option>
                                    <option value="26-50">26-50 people</option>
                                    <option value="51-100">51-100 people</option>
                                    <option value="100+">100+ people</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Phone (optional)
                            </label>
                            <Input
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                placeholder="+1 (555) 123-4567"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Tell us about your use case *
                            </label>
                            <Textarea
                                required
                                value={formData.use_case}
                                onChange={(e) => setFormData({ ...formData, use_case: e.target.value })}
                                placeholder="What are you looking to accomplish? How many manuscripts/scripts do you process monthly?"
                                className="h-24"
                            />
                        </div>

                        <div className="flex gap-3 pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                className="flex-1"
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Submitting...
                                    </>
                                ) : (
                                    'Request Demo'
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}