import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail } from 'lucide-react';

export default function Contact() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-3xl mx-auto px-6 py-12">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-slate-900">Contact Us</h1>
                    <p className="mt-2 text-slate-600">
                        We typically respond within 48 hours
                    </p>
                </div>

                <Card className="border-0 shadow-lg">
                    <CardHeader>
                        <CardTitle>For Inquiries</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-3 p-4 rounded-lg bg-indigo-50 border border-indigo-200">
                            <Mail className="w-5 h-5 text-indigo-600" />
                            <a 
                                href="mailto:support@literaryaipartner.com"
                                className="text-lg text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                                support@literaryaipartner.com
                            </a>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}