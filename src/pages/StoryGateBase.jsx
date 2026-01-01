import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, FileText, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

export default function StoryGateBase() {
    return (
        <div className="min-h-screen bg-slate-50">
            {/* Above-the-Fold */}
            <div className="bg-white border-b border-slate-200">
                <div className="max-w-6xl mx-auto px-6 py-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center"
                    >
                        <h1 className="text-5xl font-bold text-slate-900 mb-4">
                            StoryGate
                        </h1>
                        <p className="text-2xl text-slate-700 mb-6 font-light">
                            A secure, curated gateway to high-grade manuscripts and screen projects.
                        </p>
                        <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed mb-8">
                            StoryGate provides industry professionals with controlled access to projects that meet defined quality and presentation standards.<br />
                            Only work that meets established criteria is eligible for viewing.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <Link to={createPageUrl('IndustryVerification')}>
                                <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-6 text-lg">
                                    Request Industry Access
                                </Button>
                            </Link>
                            <Button
                                size="lg"
                                variant="outline"
                                onClick={() => window.location.href = createPageUrl('StoryGatePortal')}
                                className="border-slate-300 text-slate-700 px-8 py-6 text-lg"
                            >
                                Sign in as Industry User
                            </Button>
                        </div>
                        <p className="text-sm text-slate-500 mt-6">
                            Verified industry only. Access is logged. Creators control visibility.
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* How StoryGate Works */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <h2 className="text-3xl font-semibold text-slate-900 mb-8">How StoryGate Works</h2>
                <div className="grid md:grid-cols-2 gap-6">
                    {[
                        {
                            icon: Shield,
                            title: "Verified access only",
                            description: "Industry professionals apply for access and are approved before viewing materials."
                        },
                        {
                            icon: Lock,
                            title: "Request → Creator approval",
                            description: "Industry users request access to specific projects; creators approve or decline on a per-project basis."
                        },
                        {
                            icon: FileText,
                            title: "Audit trail",
                            description: "All access, unlocks, and key interactions are logged."
                        },
                        {
                            icon: CheckCircle2,
                            title: "Creator control",
                            description: "Creators decide which materials are visible to which viewers and roles."
                        }
                    ].map((item, idx) => (
                        <Card key={idx} className="border-slate-200">
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-2 rounded-lg bg-slate-100">
                                        <item.icon className="w-6 h-6 text-slate-700" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-2">{item.title}</h3>
                                        <p className="text-slate-600 leading-relaxed">{item.description}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* What You'll See Inside */}
            <div className="bg-white py-16">
                <div className="max-w-6xl mx-auto px-6">
                    <h2 className="text-3xl font-semibold text-slate-900 mb-6">What You'll See Inside</h2>
                    <p className="text-slate-600 mb-6">
                        Depending on creator permissions, verified industry users may view:
                    </p>
                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                        {[
                            "Logline and short pitch",
                            "One-page synopsis or series overview",
                            "Sample pages or pilot script",
                            "Optional materials: lookbook, comparable titles, audience positioning, adaptation notes",
                            "Optional evaluation summary (RevisionGrade score or equivalent professional assessment)"
                        ].map((item, idx) => (
                            <div key={idx} className="flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                                <span className="text-slate-700">{item}</span>
                            </div>
                        ))}
                    </div>
                    <p className="text-slate-600 italic">
                        Creators determine which materials are visible to which roles.
                    </p>
                </div>
            </div>

            {/* Eligibility & Quality Requirements */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <h2 className="text-3xl font-semibold text-slate-900 mb-6">Eligibility & Quality Requirements</h2>
                <p className="text-slate-600 mb-8">
                    Placement in StoryGate is conditional. Projects must satisfy both presentation and quality requirements.
                </p>

                {/* Rule 1 */}
                <Card className="mb-6 border-2 border-slate-200">
                    <CardContent className="p-8">
                        <h3 className="text-2xl font-semibold text-slate-900 mb-4">
                            Rule 1 — Professional Presentation Package (Required)
                        </h3>
                        <p className="text-slate-700 mb-4">
                            Creators must submit one professionally formatted PDF containing:
                        </p>
                        <ul className="list-disc list-inside space-y-2 mb-6 text-slate-700">
                            <li>Pitch / logline</li>
                            <li>Synopsis</li>
                            <li>Key supporting materials</li>
                        </ul>
                        <p className="text-slate-700 mb-4">
                            Creators may satisfy this requirement by:
                        </p>
                        <ul className="list-disc list-inside space-y-2 mb-6 text-slate-700">
                            <li>Using the RevisionGrade Film Adaptation Package, or</li>
                            <li>Submitting an equivalent professional package created independently or by another service.</li>
                        </ul>
                        <p className="text-slate-600 italic mb-4">
                            This package is a professional development artifact, not a substitute for a full manuscript, script, or series bible; its purpose is to demonstrate clarity of concept, cohesion, and industry awareness.
                        </p>
                        <p className="text-slate-900 font-medium">
                            There is no requirement to purchase RevisionGrade services to qualify.
                        </p>
                    </CardContent>
                </Card>

                {/* Rule 2 */}
                <Card className="border-2 border-slate-200">
                    <CardContent className="p-8">
                        <h3 className="text-2xl font-semibold text-slate-900 mb-4">
                            Rule 2 — Minimum Quality Threshold (Required)
                        </h3>
                        <p className="text-slate-700 mb-4">
                            Projects must demonstrate a minimum professional standard through one of the following:
                        </p>
                        <div className="space-y-4 mb-6">
                            <div className="pl-4 border-l-4 border-slate-300">
                                <p className="font-medium text-slate-900 mb-2">
                                    • A RevisionGrade score of 8.0 or higher in the relevant evaluation, or
                                </p>
                                <p className="font-medium text-slate-900 mb-2">
                                    • A documented equivalent professional evaluation, such as:
                                </p>
                                <ul className="list-disc list-inside pl-4 space-y-1 text-slate-700">
                                    <li>Literary agent evaluation</li>
                                    <li>Producer or development executive assessment</li>
                                    <li>Third-party professional analysis</li>
                                </ul>
                            </div>
                        </div>
                        <p className="text-slate-600 mb-4">
                            Equivalent professional evaluations should assess structure, readiness, clarity, and viability using a transparent, defensible methodology, and produce a clearly articulated evaluative outcome suitable for comparison.
                        </p>
                        <p className="text-slate-700 mb-2 font-medium">
                            Equivalent evaluations must include:
                        </p>
                        <ul className="list-disc list-inside space-y-1 mb-6 text-slate-700">
                            <li>Clear methodology</li>
                            <li>A defensible quality conclusion</li>
                            <li>Supporting documentation (PDF or report)</li>
                        </ul>
                        <p className="text-slate-900 font-semibold">
                            Both Rule 1 and Rule 2 must be satisfied for eligibility.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Creator Responsibilities */}
            <div className="bg-white py-16">
                <div className="max-w-6xl mx-auto px-6">
                    <h2 className="text-3xl font-semibold text-slate-900 mb-6">Creator Responsibilities</h2>
                    <p className="text-slate-700 mb-4">Creators must:</p>
                    <ul className="space-y-3">
                        {[
                            "Provide a complete professional package (single PDF)",
                            "Confirm rights ownership or control for the submitted work",
                            "Meet the quality threshold through a RevisionGrade evaluation or an equivalent professional evaluation",
                            "Acknowledge that StoryGate is selective and that submission does not guarantee response, review, or acceptance"
                        ].map((item, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                                <span className="text-slate-700">{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Industry Verification & Access Control */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <h2 className="text-3xl font-semibold text-slate-900 mb-6">Industry Verification & Access Control</h2>
                <ul className="space-y-3">
                    {[
                        "Industry professionals apply for verification by submitting role and credentials.",
                        "Approved users receive \"Verified Industry\" status.",
                        "Unverified users see only minimal, non-sensitive project listings.",
                        "Verified users may request access to specific projects.",
                        "Creators approve or deny access requests.",
                        "All activity is logged."
                    ].map((item, idx) => (
                        <li key={idx} className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0 mt-2" />
                            <span className="text-slate-700">{item}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Compliance, Logging & Governance */}
            <div className="bg-slate-100 py-16">
                <div className="max-w-6xl mx-auto px-6">
                    <h2 className="text-3xl font-semibold text-slate-900 mb-6">Compliance, Logging & Governance</h2>
                    <p className="text-slate-700 mb-4">The system records:</p>
                    <ul className="grid md:grid-cols-2 gap-3 mb-6">
                        {[
                            "Account ID and role",
                            "Project ID",
                            "Event type (view, request, unlock, revoke)",
                            "Timestamp",
                            "Access grant source (creator approval or admin action)"
                        ].map((item, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-slate-500 flex-shrink-0 mt-2" />
                                <span className="text-slate-700">{item}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="text-slate-600 italic">
                        StoryGate is an access layer, not a representation agreement, not a sales platform, and not a guarantee of opportunity.
                    </p>
                </div>
            </div>

            {/* Footer CTAs */}
            <div className="bg-white border-t border-slate-200 py-16">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid md:grid-cols-2 gap-8">
                        <Card className="border-2 border-slate-200">
                            <CardContent className="p-8 text-center">
                                <h3 className="text-xl font-semibold text-slate-900 mb-4">For Industry</h3>
                                <Link to={createPageUrl('IndustryVerification')}>
                                    <Button size="lg" className="bg-slate-900 hover:bg-slate-800 text-white w-full">
                                        Request Industry Access
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                        <Card className="border-2 border-slate-200">
                            <CardContent className="p-8 text-center">
                                <h3 className="text-xl font-semibold text-slate-900 mb-4">For Creators</h3>
                                <div className="space-y-3">
                                    <Link to={createPageUrl('UploadManuscript')}>
                                        <Button size="lg" variant="outline" className="w-full border-slate-300">
                                            Get a RevisionGrade Evaluation
                                        </Button>
                                    </Link>
                                    <Link to={createPageUrl('FilmAdaptation')}>
                                        <Button size="lg" variant="outline" className="w-full border-slate-300">
                                            Learn About the Film Adaptation Package
                                        </Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}