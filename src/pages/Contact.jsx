import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Building2, Loader2, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function Contact() {
    const [isEnterprise, setIsEnterprise] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        company: '',
        subject: '',
        message: ''
    });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('plan') === 'enterprise') {
            setIsEnterprise(true);
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await base44.integrations.Core.SendEmail({
                to: 'michael@revisiongrade.com',
                subject: isEnterprise 
                    ? `Enterprise Inquiry: ${formData.company}` 
                    : `Contact Form: ${formData.subject}`,
                body: `
${isEnterprise ? 'ENTERPRISE INQUIRY' : 'CONTACT FORM SUBMISSION'}

Name: ${formData.name}
Email: ${formData.email}
${formData.company ? `Company: ${formData.company}\n` : ''}
${!isEnterprise ? `Subject: ${formData.subject}\n` : ''}
Message:
${formData.message}
                `
            });

            setIsSubmitted(true);
            toast.success('Message sent! We\'ll respond within 24-48 hours.');
        } catch (error) {
            console.error('Contact form error:', error);
            toast.error('Failed to send message. Please try emailing us directly.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-3xl mx-auto px-6 py-12">
                <div className="text-center mb-8">
                    {isEnterprise ? (
                        <>
                            <Building2 className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
                            <h1 className="text-3xl font-bold text-slate-900">Enterprise Sales Inquiry</h1>
                            <p className="mt-2 text-slate-600">
                                Let's discuss how RevisionGrade™ can scale your organization
                            </p>
                        </>
                    ) : (
                        <>
                            <h1 className="text-3xl font-bold text-slate-900">Contact Us</h1>
                            <p className="mt-2 text-slate-600">
                                We typically respond within 24-48 hours
                            </p>
                        </>
                    )}
                </div>

                {isSubmitted ? (
                    <Card className="border-0 shadow-lg">
                        <CardContent className="pt-12 pb-8 text-center">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-2">Message Received!</h3>
                            <p className="text-slate-600 mb-6">
                                We'll respond to <strong>{formData.email}</strong> within 24-48 hours.
                            </p>
                            <Button onClick={() => window.location.href = '/'}>
                                Return to Home
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <Card className="border-0 shadow-lg mb-6">
                            <CardHeader>
                                <CardTitle>
                                    {isEnterprise ? 'Tell us about your organization' : 'Send us a message'}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                                Name *
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
                                                Email *
                                            </label>
                                            <Input
                                                required
                                                type="email"
                                                value={formData.email}
                                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                placeholder="john@example.com"
                                            />
                                        </div>
                                    </div>

                                    {isEnterprise && (
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
                                    )}

                                    {!isEnterprise && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    Company (optional)
                                                </label>
                                                <Input
                                                    value={formData.company}
                                                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                                                    placeholder="Your company or organization"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                                    Subject *
                                                </label>
                                                <Input
                                                    required
                                                    value={formData.subject}
                                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                                    placeholder="How can we help?"
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Message *
                                        </label>
                                        <Textarea
                                            required
                                            value={formData.message}
                                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                            placeholder={isEnterprise 
                                                ? "Tell us about your organization's needs, team size, and evaluation volume..."
                                                : "Your message..."
                                            }
                                            className="h-32"
                                        />
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            'Send Message'
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card className="border-0 shadow-lg">
                            <CardHeader>
                                <CardTitle>Direct Email</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center gap-3 p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                                    <Mail className="w-5 h-5 text-indigo-600" />
                                    <a 
                                        href="mailto:support@revisiongrade.com"
                                        className="text-lg text-indigo-600 hover:text-indigo-700 font-medium"
                                    >
                                        support@revisiongrade.com
                                    </a>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}