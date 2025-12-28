import React from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Building2, Users, Shield, Zap, CheckCircle2, 
    BarChart3, Lock, Sparkles, ArrowRight, Crown,
    FileText, Target, TrendingUp
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';
import DemoRequestForm from '@/components/enterprise/DemoRequestForm';

const useCases = [
    {
        icon: Building2,
        title: "Literary Agencies",
        description: "Pre-screen submissions with consistent criteria. Train junior readers. Standardize rejection logic across your team.",
        metrics: "50-200+ manuscripts/month",
        color: "from-indigo-500 to-blue-600"
    },
    {
        icon: Users,
        title: "Publishing Houses",
        description: "Filter slush pile at scale. Score acquisitions consistently. Track editorial judgment across imprints.",
        metrics: "100-500+ manuscripts/month",
        color: "from-purple-500 to-pink-600"
    },
    {
        icon: FileText,
        title: "MFA Programs",
        description: "Grade student portfolios objectively. Track craft development over semesters. Standardize workshop feedback.",
        metrics: "50-200 students/semester",
        color: "from-emerald-500 to-teal-600"
    },
    {
        icon: Target,
        title: "Content Studios",
        description: "Evaluate screenplays at scale. Maintain consistent story standards. Accelerate development pipeline.",
        metrics: "30-150+ scripts/month",
        color: "from-amber-500 to-orange-600"
    }
];

const features = [
    {
        icon: Shield,
        title: "Team Dashboard",
        description: "View all evaluations across your organization. Track patterns, scores, and team performance in real-time."
    },
    {
        icon: Users,
        title: "10-50 User Seats",
        description: "Role-based access (Admin, Evaluator, Viewer). Add/remove users as your team scales."
    },
    {
        icon: Zap,
        title: "Custom Criteria",
        description: "Weight evaluation criteria per your organization's standards. Adapt WAVE checks to your editorial voice."
    },
    {
        icon: BarChart3,
        title: "Bulk Processing",
        description: "Upload multiple manuscripts simultaneously. Process slush piles efficiently with batch evaluations."
    },
    {
        icon: Lock,
        title: "API Access",
        description: "Integrate with QueryTracker, Manuscript Wishlist, or your internal CMS. Automated workflow connections."
    },
    {
        icon: Crown,
        title: "White-Label Options",
        description: "Brand the platform as your own. Custom domains, logos, and email templates for large organizations."
    }
];

const comparisonData = [
    {
        aspect: "Evaluation Time",
        traditional: "2-4 weeks per manuscript",
        revisiongrade: "5-15 minutes per manuscript",
        improvement: "95% faster"
    },
    {
        aspect: "Reader Consistency",
        traditional: "High variance across readers",
        revisiongrade: "Standardized scoring criteria",
        improvement: "100% consistency"
    },
    {
        aspect: "Cost per Evaluation",
        traditional: "$50-200 (staff time)",
        revisiongrade: "$2-5 (automated)",
        improvement: "96% cost reduction"
    },
    {
        aspect: "Scalability",
        traditional: "Limited by staff bandwidth",
        revisiongrade: "Unlimited capacity",
        improvement: "Infinite scale"
    }
];

export default function Enterprise() {
    const [showDemoForm, setShowDemoForm] = React.useState(false);

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 to-indigo-900 py-20">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-600/20 via-transparent to-transparent" />
                
                <div className="relative max-w-6xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <Badge className="mb-6 px-4 py-2 bg-white/10 text-white border-white/20">
                            <Crown className="w-4 h-4 mr-2" />
                            RevisionGrade™ Enterprise
                        </Badge>
                        
                        <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
                            Publishing Infrastructure
                            <span className="block mt-2 text-indigo-300">
                                Built for Scale
                            </span>
                        </h1>
                        
                        <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-8">
                            Standardize manuscript evaluation across your agency, publishing house, MFA program, or studio. 
                            Process submissions at scale with consistent, PhD-calibrated criteria.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Button 
                                size="lg" 
                                className="h-14 px-8 bg-white text-slate-900 hover:bg-slate-100"
                                onClick={() => setShowDemoForm(true)}
                            >
                                <Sparkles className="w-5 h-5 mr-2" />
                                Book a Demo
                                <ArrowRight className="w-5 h-5 ml-2" />
                            </Button>
                            <Link to={createPageUrl('Contact') + '?plan=enterprise'}>
                                <Button 
                                    size="lg" 
                                    variant="outline" 
                                    className="h-14 px-8 border-white/30 text-white hover:bg-white/10"
                                >
                                    Talk to Sales
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid md:grid-cols-4 gap-6 mt-12">
                        {[
                            { value: "95%", label: "Faster Evaluation" },
                            { value: "100%", label: "Consistency" },
                            { value: "96%", label: "Cost Reduction" },
                            { value: "Unlimited", label: "Capacity" }
                        ].map((stat, idx) => (
                            <div key={idx} className="text-center p-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20">
                                <div className="text-3xl font-bold text-white mb-1">{stat.value}</div>
                                <div className="text-sm text-slate-300">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Use Cases */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">
                        Built for Professional Organizations
                    </h2>
                    <p className="text-xl text-slate-600">
                        From literary agencies to content studios—scale your evaluation workflow
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                    {useCases.map((useCase, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: idx * 0.1 }}
                            viewport={{ once: true }}
                        >
                            <Card className="border-0 shadow-lg hover:shadow-xl transition-all h-full">
                                <CardHeader>
                                    <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${useCase.color} mb-4`}>
                                        <useCase.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <CardTitle className="text-xl">{useCase.title}</CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    <p className="text-slate-600">{useCase.description}</p>
                                    <Badge variant="outline" className="text-xs">
                                        {useCase.metrics}
                                    </Badge>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Enterprise Features */}
            <div className="bg-slate-900 py-16">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl font-bold text-white mb-4">
                            Enterprise Features
                        </h2>
                        <p className="text-slate-300 text-lg">
                            Everything you need to scale editorial operations
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {features.map((feature, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                viewport={{ once: true }}
                                className="p-6 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all"
                            >
                                <feature.icon className="w-8 h-8 text-indigo-400 mb-4" />
                                <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                                <p className="text-slate-400 text-sm">{feature.description}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Comparison Table */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">
                        Traditional vs. RevisionGrade™ Enterprise
                    </h2>
                    <p className="text-slate-600">
                        See the operational impact
                    </p>
                </div>

                <Card className="border-0 shadow-xl">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Aspect</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">Traditional Process</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-slate-900">RevisionGrade™</th>
                                        <th className="px-6 py-4 text-left text-sm font-semibold text-indigo-900">Improvement</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {comparisonData.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900">{row.aspect}</td>
                                            <td className="px-6 py-4 text-slate-600">{row.traditional}</td>
                                            <td className="px-6 py-4 text-slate-600">{row.revisiongrade}</td>
                                            <td className="px-6 py-4">
                                                <Badge className="bg-emerald-100 text-emerald-800">
                                                    {row.improvement}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ROI Calculator */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 py-16">
                <div className="max-w-4xl mx-auto px-6">
                    <Card className="border-0 shadow-xl">
                        <CardHeader className="text-center pb-8">
                            <CardTitle className="text-2xl">Estimated ROI for Your Organization</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="p-6 rounded-xl bg-slate-50 border border-slate-200">
                                    <div className="text-sm text-slate-600 mb-2">Current Cost (Traditional)</div>
                                    <div className="text-3xl font-bold text-slate-900 mb-1">$15,000</div>
                                    <div className="text-xs text-slate-500">3 readers × 100 manuscripts/mo @ $50 each</div>
                                </div>
                                <div className="p-6 rounded-xl bg-emerald-50 border border-emerald-200">
                                    <div className="text-sm text-emerald-700 mb-2">With RevisionGrade™</div>
                                    <div className="text-3xl font-bold text-emerald-900 mb-1">$2,000</div>
                                    <div className="text-xs text-emerald-600">Enterprise plan with unlimited capacity</div>
                                </div>
                            </div>
                            <div className="p-6 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center">
                                <div className="text-lg mb-2">Annual Savings</div>
                                <div className="text-4xl font-bold">$156,000</div>
                                <div className="text-sm text-indigo-200 mt-2">87% cost reduction while increasing throughput</div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Security & Compliance */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <div className="text-center mb-12">
                    <h2 className="text-3xl font-bold text-slate-900 mb-4">
                        Enterprise-Grade Security
                    </h2>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {[
                        { icon: Shield, title: "SOC 2 Compliant", description: "Enterprise security standards" },
                        { icon: Lock, title: "SSO Integration", description: "SAML 2.0 authentication" },
                        { icon: FileText, title: "Data Privacy", description: "GDPR & CCPA compliant" }
                    ].map((item, idx) => (
                        <Card key={idx} className="border-0 shadow-md text-center">
                            <CardContent className="pt-8">
                                <item.icon className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
                                <h3 className="font-semibold text-slate-900 mb-2">{item.title}</h3>
                                <p className="text-sm text-slate-600">{item.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* CTA Section */}
            <div className="bg-slate-900 py-16">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-3xl font-bold text-white mb-4">
                        Ready to Scale Your Editorial Operations?
                    </h2>
                    <p className="text-xl text-slate-300 mb-8">
                        Join agencies, publishers, and programs using RevisionGrade™ Enterprise
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Button 
                            size="lg" 
                            className="h-14 px-8 bg-white text-slate-900 hover:bg-slate-100"
                            onClick={() => setShowDemoForm(true)}
                        >
                            <Sparkles className="w-5 h-5 mr-2" />
                            Book a Demo
                        </Button>
                        <Link to={createPageUrl('Contact') + '?plan=enterprise'}>
                            <Button 
                                size="lg" 
                                variant="outline" 
                                className="h-14 px-8 border-white/30 text-white hover:bg-white/10"
                            >
                                Contact Sales
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Demo Request Modal */}
            {showDemoForm && (
                <DemoRequestForm onClose={() => setShowDemoForm(false)} />
            )}
        </div>
    );
}