import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Loader2, CheckCircle2, HelpCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Contact() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        category: '',
        subject: '',
        message: '',
        confirmed: false
    });

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.confirmed) {
            toast.error('Please confirm you understand product usage questions are handled in-app');
            return;
        }

        setIsSubmitting(true);

        try {
            // Route to sales@ or support@ based on category
            const isEnterpriseOrPartnership = ['enterprise', 'partnership'].includes(formData.category);
            const recipientEmail = isEnterpriseOrPartnership 
                ? 'sales@revisiongrade.com' 
                : 'support@revisiongrade.com';

            await base44.integrations.Core.SendEmail({
                to: recipientEmail,
                subject: `[${formData.category.toUpperCase()}] ${formData.subject}`,
                body: `
REVISIONGRADE CONTACT FORM

Category: ${formData.category}
Email: ${formData.email}
Subject: ${formData.subject}

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
                    <h1 className="text-3xl font-bold text-slate-900">Contact RevisionGrade</h1>
                    <p className="mt-2 text-slate-600">
                        For billing, account access, or partnership inquiries only.
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                        Product usage questions are supported through in-app documentation.
                    </p>
                </div>

                {isSubmitted ? (
                    <Card className="border-0 shadow-lg">
                        <CardContent className="pt-12 pb-8 text-center">
                            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-2">Message Sent!</h3>
                            <p className="text-slate-600 mb-6">
                                We'll respond to <strong>{formData.email}</strong> within 24-48 hours.
                            </p>
                            <Button onClick={() => window.location.href = createPageUrl('Home')}>
                                Return to Home
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <Card className="border-0 shadow-lg mb-6">
                            <CardHeader>
                                <CardTitle>Contact Form</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Email address *
                                        </label>
                                        <Input
                                            required
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="you@example.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Category *
                                        </label>
                                        <Select
                                            required
                                            value={formData.category}
                                            onValueChange={(value) => setFormData({ ...formData, category: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="billing">Billing or subscription issue</SelectItem>
                                                <SelectItem value="account">Account access or login</SelectItem>
                                                <SelectItem value="enterprise">Enterprise / agency inquiry</SelectItem>
                                                <SelectItem value="partnership">Partnership or media</SelectItem>
                                                <SelectItem value="legal">Legal or privacy</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Subject *
                                        </label>
                                        <Input
                                            required
                                            value={formData.subject}
                                            onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                            placeholder="Short summary of your request"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Message *
                                        </label>
                                        <Textarea
                                            required
                                            value={formData.message}
                                            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                            placeholder="Please include only information relevant to the selected category."
                                            className="h-32"
                                        />
                                    </div>

                                    <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
                                        <Checkbox
                                            id="confirm"
                                            checked={formData.confirmed}
                                            onCheckedChange={(checked) => setFormData({ ...formData, confirmed: checked })}
                                        />
                                        <label htmlFor="confirm" className="text-sm text-slate-700 leading-relaxed cursor-pointer">
                                            I understand that product usage questions are handled through the in-app Resource Guide and not via email.
                                        </label>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                                        disabled={isSubmitting || !formData.confirmed}
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

                        <div className="p-6 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
                            <HelpCircle className="w-8 h-8 text-indigo-600 mx-auto mb-3" />
                            <h4 className="font-semibold text-slate-900 mb-2">Looking for help using RevisionGrade?</h4>
                            <p className="text-sm text-slate-600 mb-4">
                                Visit the in-app Resource Guide for walkthroughs, workflows, and documentation.
                            </p>
                            <Link to={createPageUrl('FAQ')}>
                                <Button variant="outline" className="border-indigo-300 text-indigo-700 hover:bg-indigo-100">
                                    View Resource Guide
                                </Button>
                            </Link>
                        </div>

                        <div className="mt-6 text-center">
                            <p className="text-sm text-slate-500 mb-2">Or email us directly:</p>
                            <div className="flex flex-col sm:flex-row justify-center gap-4">
                                <a 
                                    href="mailto:support@revisiongrade.com"
                                    className="flex items-center justify-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
                                >
                                    <Mail className="w-4 h-4" />
                                    support@revisiongrade.com
                                </a>
                                <a 
                                    href="mailto:sales@revisiongrade.com"
                                    className="flex items-center justify-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
                                >
                                    <Mail className="w-4 h-4" />
                                    sales@revisiongrade.com
                                </a>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}