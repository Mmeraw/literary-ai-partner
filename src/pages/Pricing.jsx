import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Sparkles, Crown, Zap, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const tiers = [
    {
        name: "Starter",
        price: 25,
        priceId: "price_starter_monthly",
        icon: Zap,
        color: "from-blue-500 to-cyan-600",
        features: [
            "Quick scene/chapter evaluation only",
            "25,000 words/month included",
            "12 Literary Agent Criteria",
            "Wave Revision System",
            "Email support"
        ],
        limitations: [
            "No full manuscript analysis",
            "No screenplay evaluation",
            "No progress dashboard",
            "Standard processing speed"
        ]
    },
    {
        name: "Professional",
        price: 99,
        priceId: "price_professional_monthly",
        icon: Sparkles,
        color: "from-indigo-500 to-purple-600",
        popular: true,
        features: [
            "Unlimited evaluation runs¹",
            "500,000 words/month included",
            "Full manuscript & screenplay evaluation",
            "Structure-aware analysis",
            "Clean revised downloads",
            "Editorial reports (PDF)",
            "Progress & pattern tracking",
            "Priority processing",
            "Priority email support"
        ],
        limitations: []
    }
    // Enterprise plan hidden for now
    // {
    //     name: "Enterprise",
    //     price: 200,
    //     priceId: "price_enterprise_monthly",
    //     icon: Crown,
    //     color: "from-purple-500 to-pink-600",
    //     features: [
    //         "Unlimited everything",
    //         "White-glove service",
    //         "Dedicated account manager",
    //         "Custom evaluation criteria",
    //         "Bulk manuscript processing",
    //         "24/7 priority support",
    //         "Custom integrations",
    //         "Team collaboration tools"
    //     ],
    //     roadmap: "Early access to new features: API access & integrations available to Enterprise first",
    //     limitations: []
    // }
];

export default function Pricing() {
    const [loadingPlan, setLoadingPlan] = useState(null);
    const [stripePrices, setStripePrices] = useState({});

    React.useEffect(() => {
        // Fetch real Stripe prices
        base44.functions.invoke('getStripePrices').then(response => {
            if (response.data.prices) {
                setStripePrices(response.data.prices);
            }
        }).catch(console.error);
    }, []);

    const handleSubscribe = async (tier) => {
        try {
            setLoadingPlan(tier.name);
            
            // Get the real price ID from Stripe
            const planKey = tier.name.toLowerCase();
            const priceId = stripePrices[planKey]?.price_id || tier.priceId;

            const response = await base44.functions.invoke('createCheckoutSession', {
                priceId: priceId,
                planName: tier.name
            });

            if (response.data.url) {
                window.location.href = response.data.url;
            } else {
                toast.error('Failed to create checkout session');
                setLoadingPlan(null);
            }
        } catch (error) {
            console.error('Checkout error:', error);
            toast.error(error.response?.data?.error || 'Failed to start checkout. Please try again.');
            setLoadingPlan(null);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            {/* Header */}
            <div className="relative overflow-hidden py-20">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-transparent to-transparent opacity-60" />
                <div className="relative max-w-4xl mx-auto px-6 text-center">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Simple, Transparent Pricing
                    </Badge>
                    <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
                        Choose Your Plan
                    </h1>
                    <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                        Professional editorial judgment, repeatable over time. All plans include PhD-calibrated analysis and the proprietary WAVE Revision System.
                    </p>
                </div>
            </div>

            {/* Pricing Cards */}
            <div className="max-w-7xl mx-auto px-6 pb-20">
                <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {tiers.map((tier, idx) => (
                        <motion.div
                            key={tier.name}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                        >
                            <Card className={`relative border-2 ${
                                tier.popular 
                                    ? 'border-indigo-500 shadow-2xl shadow-indigo-500/20' 
                                    : 'border-slate-200'
                            } hover:shadow-xl transition-all duration-300`}>
                                {tier.popular && (
                                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                                        <Badge className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-0 px-4 py-1">
                                            Most Popular
                                        </Badge>
                                    </div>
                                )}

                                <CardHeader className="pb-8">
                                    <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${tier.color} mb-4`}>
                                        <tier.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <CardTitle className="text-2xl">{tier.name}</CardTitle>
                                    <div className="mt-4">
                                        <span className="text-4xl font-bold text-slate-900">
                                            ${tier.price}
                                        </span>
                                        <span className="text-slate-600 ml-2">/month</span>
                                    </div>
                                </CardHeader>

                                <CardContent className="space-y-6">
                                    <div className="space-y-3">
                                        {tier.features.map((feature, i) => (
                                            <div key={i} className="flex items-start gap-3">
                                                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                                <span className="text-sm text-slate-700">{feature}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {tier.limitations.length > 0 && (
                                        <div className="pt-4 border-t border-slate-200 space-y-2">
                                            {tier.limitations.map((limitation, i) => (
                                                <div key={i} className="flex items-start gap-3">
                                                    <span className="text-slate-400 text-sm">• {limitation}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <Button
                                        className={`w-full h-12 ${
                                            tier.popular
                                                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700'
                                                : 'bg-slate-900 hover:bg-slate-800'
                                        }`}
                                        onClick={() => handleSubscribe(tier)}
                                        disabled={loadingPlan !== null}
                                    >
                                        {loadingPlan === tier.name ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            `Subscribe to ${tier.name}`
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* FAQ / Notes */}
                <div className="mt-16 max-w-3xl mx-auto">
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white">
                        <CardHeader>
                            <CardTitle>Usage & Billing Notes</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-slate-600">
                            <div>
                                <strong className="text-slate-900">¹ Unlimited Evaluation Runs:</strong> Refers to the number of analysis runs. Monthly usage is subject to the included word allowance, whichever comes first.
                            </div>
                            <div>
                                <strong className="text-slate-900">Free Starter Evaluation:</strong> New users receive 1-2 free evaluations (~2,000 words total) to experience the system. Account required after first evaluation.
                            </div>
                            <div>
                                <strong className="text-slate-900">Monthly Reset:</strong> Evaluation counts and word limits reset on the 1st of each month.
                            </div>
                            <div>
                                <strong className="text-slate-900">Cancellation:</strong> Cancel anytime. Access continues until the end of your billing period.
                            </div>
                            <div className="pt-4 border-t border-slate-200">
                                <p className="text-xs text-slate-500">
                                    Compare: Professional developmental edits typically cost $2,000–$14,000 for a single pass. 
                                    RevisionGrade™ provides unlimited evaluations, revision tracking, and progress intelligence for less than the cost of one human editorial pass.
                                </p>
                            </div>
                            <div className="pt-2 border-t border-slate-200">
                                <p className="text-xs text-slate-500 italic">
                                    Payment processing handled securely through Stripe. All subscriptions subject to Terms of Service.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}