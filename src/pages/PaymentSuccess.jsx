import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import confetti from 'canvas-confetti';

export default function PaymentSuccess() {
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Trigger confetti
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
        });

        setTimeout(() => setLoading(false), 1500);
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto mb-4" />
                    <p className="text-slate-600">Processing your subscription...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-2xl mx-auto px-6 py-20">
                <Card className="border-0 shadow-2xl">
                    <CardHeader className="text-center pb-8">
                        <div className="inline-flex p-4 rounded-full bg-green-100 mx-auto mb-4">
                            <CheckCircle2 className="w-12 h-12 text-green-600" />
                        </div>
                        <CardTitle className="text-3xl">Payment Successful!</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 text-center">
                        <p className="text-slate-600 text-lg">
                            Thank you for subscribing to RevisionGrade. Your account has been upgraded and you now have full access to all features.
                        </p>
                        
                        <div className="pt-6 space-y-3">
                            <Link to={createPageUrl('Dashboard')}>
                                <Button className="w-full h-12 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                                    Go to Dashboard
                                </Button>
                            </Link>
                            <Link to={createPageUrl('Evaluate')}>
                                <Button variant="outline" className="w-full h-12">
                                    Start Evaluating
                                </Button>
                            </Link>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}