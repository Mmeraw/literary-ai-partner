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
        name: "Basic",
        price: 19,
        priceId: "price_basic_monthly",
        icon: Zap,
        color: "from-blue-500 to-cyan-600",
        features: [
            "Up to ~40,000–50,000 words/month",
            "Unlimited uploads and evaluation runs within allowance",
            "Core structural feedback",
            "High-level craft signals",
            "Excerpt- and section-level use",
            "No longitudinal tracking",
            "No comparative analysis"
        ],
        microcopy: "Designed for testing RevisionGrade on real material without committing to full‑manuscript work.",
        limitations: []
    },
    {
        name: "Pro",
        price: 99,
        priceId: "price_pro_monthly",
        icon: Sparkles,
        color: "from-indigo-500 to-purple-600",
        popular: true,
        features: [
            "Up to ~200,000–250,000 words/month",
            "Unlimited uploads, evaluations, and revisions within allowance",
            "Full-manuscript coverage with WAVE (13 criteria)",
            "Pattern detection across drafts and progress tracking",
            "Editorial summaries, diagnostics, and clean revision exports",
            "Work‑tied outputs: synopsis, query letter, pitches, market comparables, author biography, agent package, film adaptation package"
        ],
        microcopy: "Enough capacity for multiple full passes on a novel in active revision.",
        limitations: []
    },
    {
        name: "Professional",
        price: 149,
        priceId: "price_professional_monthly",
        icon: Crown,
        color: "from-purple-500 to-pink-600",
        features: [
            "Everything in Pro/Core",
            "Same or higher word allowance",
            "Comparative Analysis Report",
            "Genre-context diagnostics",
            "Optional comparative snapshot against published norms",
            "One primary manuscript per period positioned for high‑stakes review (querying, submission, or adaptation)"
        ],
        microcopy: "For writers preparing to query, submit, or professionally position their work.",
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
            <div className="relative overflow-hidden py-16 sm:py-20">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100 via-transparent to-transparent opacity-60" />
                <div className="relative max-w-4xl mx-auto px-4 sm:px-6 text-center">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Sparkles className="w-4 h-4 mr-2" />
                        Simple, Transparent Pricing
                    </Badge>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
                        Choose Your Plan
                    </h1>
                    <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto">
                        All RevisionGrade plans include unlimited projects and evaluation runs, metered only by total words analyzed per month. There are no limits on uploads, revisions, diagnostics, or outputs within your monthly word allowance. When you reach your limit, new analyses pause until your next reset or plan upgrade. Past results remain fully accessible.
                    </p>
                </div>
            </div>

            {/* Pricing Cards */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
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
                                    {tier.microcopy && (
                                       <p className="text-sm text-slate-600 mt-2 italic">{tier.microcopy}</p>
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
                                        ) : (
                                            `Get Started`
                                        )}
                                    </Button>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* FAQ: What happens at the limit */}
                <div className="mt-16 max-w-4xl mx-auto">
                    <div className="mb-8 p-6 rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50 border border-slate-200">
                        <h3 className="font-semibold text-slate-900 mb-3">What happens at the limit?</h3>
                        <p className="text-sm text-slate-700">
                            When you reach your monthly word allowance, new analyses pause. You can still view, export, and work with all previous results. Analysis resumes automatically at your next monthly reset or when you upgrade.
                        </p>
                    </div>

                {/* Comparison Tables */}
                <div className="mb-12 space-y-12">
                    {/* Table 1: Writing & Revision Tools */}
                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-slate-200">
                            <h3 className="font-semibold text-slate-900">RevisionGrade vs Other Writing Tools*</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="px-6 py-3 text-left font-semibold text-slate-900">Capability</th>
                                        <th className="px-6 py-3 text-center font-semibold text-slate-700">AutoCrit</th>
                                        <th className="px-6 py-3 text-center font-semibold text-slate-700">ProWritingAid</th>
                                        <th className="px-6 py-3 text-center font-semibold text-slate-700">Grammarly</th>
                                        <th className="px-6 py-3 text-center font-semibold text-indigo-700">RevisionGrade*</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <tr><td className="px-6 py-3 text-slate-700">Manuscript diagnostics</td><td className="px-6 py-3 text-center">✅</td><td className="px-6 py-3 text-center">✅</td><td className="px-6 py-3 text-center">⚠️</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr className="bg-slate-50"><td className="px-6 py-3 text-slate-700">Evidence-backed critiques</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr><td className="px-6 py-3 text-slate-700">Canon drift protection</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr className="bg-slate-50"><td className="px-6 py-3 text-slate-700">Chapter → Scene conversion</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr><td className="px-6 py-3 text-slate-700">Novel → Screenplay conversion</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr className="bg-slate-50"><td className="px-6 py-3 text-slate-700">Work‑tied synopsis generation</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr><td className="px-6 py-3 text-slate-700">Work‑tied query letter generation</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr className="bg-slate-50"><td className="px-6 py-3 text-slate-700">Work‑tied pitches</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr><td className="px-6 py-3 text-slate-700">Work‑tied market comparables</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr className="bg-slate-50"><td className="px-6 py-3 text-slate-700">Work‑tied author biography</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr><td className="px-6 py-3 text-slate-700">Work‑tied agent package</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr className="bg-slate-50"><td className="px-6 py-3 text-slate-700">Work‑tied film adaptation package</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center">❌</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
                            *See Storygate Studio™ below for professional access and submission governance.
                        </div>
                    </div>

                    {/* Transitional Line */}
                    <div className="text-center py-6">
                        <p className="text-lg font-semibold text-slate-900">
                            RevisionGrade creates and evaluates professional materials.<br />
                            Storygate Studio™ governs who can access them.
                        </p>
                    </div>

                    {/* Table 2: Storygate Studio */}
                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="px-6 py-4 bg-gradient-to-r from-red-50 to-pink-50 border-b border-slate-200">
                            <h3 className="font-semibold text-slate-900">Professional Access & Governance (Storygate Studio™)</h3>
                            <p className="text-sm text-slate-600 mt-1">Not a writing tool — a secure, curated access layer</p>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200">
                                        <th className="px-6 py-3 text-left font-semibold text-slate-900">Storygate Studio™ Capability</th>
                                        <th className="px-6 py-3 text-center font-semibold text-slate-700">Included</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    <tr><td className="px-6 py-3 text-slate-700">Verified industry users only</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr className="bg-slate-50"><td className="px-6 py-3 text-slate-700">Request → creator approval per project</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr><td className="px-6 py-3 text-slate-700">Creator‑controlled visibility by role</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr className="bg-slate-50"><td className="px-6 py-3 text-slate-700">Secure access to professional packages</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr><td className="px-6 py-3 text-slate-700">Eligibility thresholds (quality + presentation)</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr className="bg-slate-50"><td className="px-6 py-3 text-slate-700">Optional evaluation summary visibility</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr><td className="px-6 py-3 text-slate-700">Canon‑locked materials</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr className="bg-slate-50"><td className="px-6 py-3 text-slate-700">Submission workflows (queues, status, provenance)</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr><td className="px-6 py-3 text-slate-700">Full access audit trail (view, request, unlock, revoke)</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                    <tr className="bg-slate-50"><td className="px-6 py-3 text-slate-700">Curated, selective exposure</td><td className="px-6 py-3 text-center text-indigo-700 font-semibold">✅</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
                            Storygate Studio™ is an access and governance layer. It is not representation, a sales platform, or a guarantee of opportunity.
                        </div>
                    </div>

                    {/* Studio Access & Pricing */}
                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-6">
                        <h3 className="font-semibold text-slate-900 mb-3">Is Storygate Studio™ free?</h3>
                        <p className="text-sm text-slate-700 mb-4">
                            Yes. Storygate Studio™ does not charge creators just to list or post their work. Projects must meet two professional standards:
                        </p>
                        <ol className="list-decimal list-inside text-sm text-slate-700 space-y-2 mb-4">
                            <li>A single, professionally formatted presentation package (pitch/logline, synopsis, key materials) as a PDF, created with RevisionGrade or independently.</li>
                            <li>A minimum quality threshold, such as a qualifying RevisionGrade evaluation or an equivalent professional assessment.</li>
                        </ol>
                        <p className="text-sm text-slate-600 italic">
                            Storygate Studio™ is free for eligible projects. It is a secure access and governance layer—not a marketplace and not representation—and access does not guarantee opportunities.
                        </p>
                    </div>
                </div>

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