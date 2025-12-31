import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Sparkles, Crown, Zap, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';

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
            "Complete agent-ready pipeline: Grade → Pitch → Synopsis → Bio → Comps → Agents → Query",
            "Unlimited evaluation runs¹",
            "500,000 words/month included",
            "Full manuscript & screenplay evaluation",
            "Editorial Growth Tracking — persistent skill tracking across submissions",
            "Revision Effectiveness Analysis — see if your changes actually improved the work",
            "Recurring pattern detection — identify what you keep getting wrong",
            "AI-generated submission assets (pitches, synopses, bio, comparables)",
            "Agent discovery & query letter builder",
            "Clean revised downloads",
            "Editorial reports (PDF)",
            "Priority processing",
            "Priority email support"
        ],
        limitations: []
    },
    {
        name: "Enterprise",
        price: "Custom",
        priceId: "price_enterprise_monthly",
        icon: Crown,
        color: "from-purple-500 to-pink-600",
        enterprise: true,
        features: [
            "Everything in Professional, plus:",
            "Team dashboard — view all evaluations across organization",
            "10-50 user seats included",
            "Custom criteria weighting per organization",
            "Bulk manuscript processing & API access",
            "White-label options for agencies",
            "User permission levels (admin, evaluator, viewer)",
            "Dedicated account manager",
            "Custom integrations & workflow automation",
            "24/7 priority support",
            "Onboarding & training for teams"
        ],
        description: "For literary agencies, editing teams, publishing houses, MFA programs, and content studios",
        limitations: []
    }
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
            
            // Enterprise requires contact
            if (tier.enterprise) {
                window.location.href = createPageUrl('Contact') + '?plan=enterprise';
                return;
            }
            
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
                <div className="grid md:grid-cols-3 gap-8">
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
                                        {tier.enterprise ? (
                                            <div>
                                                <span className="text-4xl font-bold text-slate-900">
                                                    Custom
                                                </span>
                                                <span className="text-slate-600 ml-2 block text-sm mt-1">Contact for pricing</span>
                                            </div>
                                        ) : (
                                            <>
                                                <span className="text-4xl font-bold text-slate-900">
                                                    ${tier.price}
                                                </span>
                                                <span className="text-slate-600 ml-2">/month</span>
                                            </>
                                        )}
                                    </div>
                                    {tier.description && (
                                        <p className="text-sm text-slate-600 mt-2">{tier.description}</p>
                                    )}
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
                                                : tier.enterprise
                                                ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
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
                                        ) : tier.enterprise ? (
                                            'Contact Sales'
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
                <div className="mt-16 max-w-3xl mx-auto space-y-6">
                    {/* Fair Use & Transparency */}
                    <Card className="border-2 border-indigo-200 bg-white shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-lg">Usage & Fair Use Policy</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-slate-700">
                                Each plan includes a monthly allocation of AI processing capacity, measured in tokens. 
                                This allows us to deliver high-quality analysis while keeping pricing fair and predictable.
                            </p>
                            <div className="space-y-2 text-sm text-slate-700">
                                <p className="font-semibold">To ensure performance for all users:</p>
                                <ul className="ml-4 space-y-1">
                                    <li>• Token usage resets monthly</li>
                                    <li>• Usage is tracked per account</li>
                                    <li>• Excessive or automated usage may be rate-limited</li>
                                    <li>• Additional capacity can be added at any time</li>
                                </ul>
                            </div>
                            <p className="text-sm text-slate-600 italic">
                                We design our system to prioritize quality over volume, ensuring every analysis receives full attention and computational depth.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Token Budget Table */}
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white">
                        <CardHeader>
                            <CardTitle>Monthly Token Budgets by Tier</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b-2 border-slate-300">
                                            <th className="text-left py-2 font-semibold text-slate-900">Tier</th>
                                            <th className="text-left py-2 font-semibold text-slate-900">Monthly Tokens</th>
                                            <th className="text-left py-2 font-semibold text-slate-900">Model Access</th>
                                            <th className="text-left py-2 font-semibold text-slate-900">Intended Use</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-slate-700">
                                        <tr className="border-b border-slate-200">
                                            <td className="py-3">Starter</td>
                                            <td className="py-3">250,000</td>
                                            <td className="py-3">GPT-4o-mini only</td>
                                            <td className="py-3">Sampling, short excerpts, exploratory feedback</td>
                                        </tr>
                                        <tr className="border-b border-slate-200">
                                            <td className="py-3">Professional</td>
                                            <td className="py-3">2,000,000</td>
                                            <td className="py-3">GPT-4o-mini + GPT-4o</td>
                                            <td className="py-3">Full manuscripts, iterative revision</td>
                                        </tr>
                                        <tr>
                                            <td className="py-3">Enterprise</td>
                                            <td className="py-3">Custom (10M–50M+)</td>
                                            <td className="py-3">All models</td>
                                            <td className="py-3">High-volume teams, institutional use</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Transparent Cost Philosophy */}
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-indigo-50 to-purple-50">
                        <CardHeader>
                            <CardTitle className="text-lg">Transparent Cost Philosophy</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 text-sm">
                            <p className="text-slate-700">
                                RevisionGrade uses industry-standard AI models with transparent pricing. 
                                We do not inflate usage or obscure costs.
                            </p>
                            <div>
                                <p className="font-semibold text-slate-900">Our goal is simple:</p>
                                <p className="text-slate-700">
                                    Give writers access to professional-grade analysis at a fraction of traditional editorial pricing.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Usage & Billing Notes */}
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-white">
                        <CardHeader>
                            <CardTitle>Usage & Billing Notes</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm text-slate-600">
                            <div>
                                <strong className="text-slate-900">¹ Unlimited Evaluation Runs:</strong> Refers to the number of analysis runs. Monthly usage is subject to the included word allowance, whichever comes first.
                            </div>
                            <div>
                                <strong className="text-slate-900">Editorial Growth Tracking (Professional only):</strong> RevisionGrade remembers you. 
                                Track your development as a writer over time with persistent skill tracking, trend-based scoring, and revision effectiveness analysis. 
                                Competitors reset to zero on every document—RevisionGrade builds a longitudinal record of your craft evolution.
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