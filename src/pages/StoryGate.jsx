import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, FileText, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { motion } from 'framer-motion';

export default function StoryGate() {
    return (
        <div className="min-h-screen" style={{ backgroundColor: '#0E0E0E' }}>
            {/* Above-the-Fold */}
            <div className="border-b" style={{ borderColor: '#A98E4A' }}>
                <div className="max-w-6xl mx-auto px-6 py-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        className="text-center"
                    >
                        <h1 className="text-5xl font-bold mb-4" style={{ color: '#7A1E1E' }}>
                            StoryGate
                        </h1>
                        <p className="text-2xl mb-6 font-light" style={{ color: '#F2EFEA' }}>
                            A secure, curated gateway to high-grade manuscripts and screen projects.
                        </p>
                        <p className="text-lg max-w-3xl mx-auto leading-relaxed mb-8" style={{ color: '#D4D4D4' }}>
                            StoryGate provides industry professionals with controlled access to projects that meet defined quality and presentation standards.<br />
                            Only work that meets established criteria is eligible for viewing.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <Link to={createPageUrl('IndustryVerification')}>
                                <Button size="lg" className="px-8 py-6 text-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: '#7A1E1E', color: '#F2EFEA' }}>
                                    Request Industry Access
                                </Button>
                            </Link>
                            <Button
                                size="lg"
                                variant="outline"
                                onClick={() => window.location.href = createPageUrl('StoryGatePortal')}
                                className="px-8 py-6 text-lg"
                                style={{ borderColor: '#A98E4A', color: '#F2EFEA', backgroundColor: 'transparent' }}
                            >
                                Sign in as Industry User
                            </Button>
                        </div>
                        <p className="text-sm mt-6" style={{ color: '#7B7B7B' }}>
                            Verified industry only. Access is logged. Creators control visibility.
                        </p>
                    </motion.div>
                </div>
            </div>

            {/* How StoryGate Works */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <h2 className="text-3xl font-semibold mb-8" style={{ color: '#7A1E1E' }}>How StoryGate Works</h2>
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
                        <Card key={idx} style={{ borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                            <CardContent className="p-6">
                                <div className="flex items-start gap-4">
                                    <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(169, 142, 74, 0.2)' }}>
                                        <item.icon className="w-6 h-6" style={{ color: '#A98E4A' }} />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-semibold mb-2" style={{ color: '#F2EFEA' }}>{item.title}</h3>
                                        <p className="leading-relaxed" style={{ color: '#D4D4D4' }}>{item.description}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* What You'll See Inside */}
            <div className="py-16" style={{ backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                <div className="max-w-6xl mx-auto px-6">
                    <h2 className="text-3xl font-semibold mb-6" style={{ color: '#7A1E1E' }}>What You'll See Inside</h2>
                    <p className="mb-6" style={{ color: '#D4D4D4' }}>
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
                                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#A98E4A' }} />
                                <span style={{ color: '#F2EFEA' }}>{item}</span>
                            </div>
                        ))}
                    </div>
                    <p className="italic" style={{ color: '#7B7B7B' }}>
                        Creators determine which materials are visible to which roles.
                    </p>
                </div>
            </div>

            {/* Eligibility & Quality Requirements */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <h2 className="text-3xl font-semibold mb-6" style={{ color: '#7A1E1E' }}>Eligibility & Quality Requirements</h2>
                <p className="mb-8" style={{ color: '#D4D4D4' }}>
                    Placement in StoryGate is conditional. Projects must satisfy both presentation and quality requirements.
                </p>

                {/* Rule 1 */}
                <Card className="mb-6" style={{ borderWidth: '2px', borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                    <CardContent className="p-8">
                        <h3 className="text-2xl font-semibold mb-4" style={{ color: '#7A1E1E' }}>
                            Rule 1 — Professional Presentation Package (Required)
                        </h3>
                        <p className="mb-4" style={{ color: '#D4D4D4' }}>
                            Creators must submit one professionally formatted PDF containing:
                        </p>
                        <ul className="list-disc list-inside space-y-2 mb-6" style={{ color: '#D4D4D4' }}>
                            <li>Pitch / logline</li>
                            <li>Synopsis</li>
                            <li>Key supporting materials</li>
                        </ul>
                        <p className="mb-4" style={{ color: '#D4D4D4' }}>
                            Creators may satisfy this requirement by:
                        </p>
                        <ul className="list-disc list-inside space-y-2 mb-6" style={{ color: '#D4D4D4' }}>
                            <li>Using the RevisionGrade Film Adaptation Package, or</li>
                            <li>Submitting an equivalent professional package created independently or by another service.</li>
                        </ul>
                        <p className="italic mb-4" style={{ color: '#7B7B7B' }}>
                            This package is a professional development artifact, not a substitute for a full manuscript, script, or series bible; its purpose is to demonstrate clarity of concept, cohesion, and industry awareness.
                        </p>
                        <p className="font-medium" style={{ color: '#F2EFEA' }}>
                            There is no requirement to purchase RevisionGrade services to qualify.
                        </p>
                    </CardContent>
                </Card>

                {/* Rule 2 */}
                <Card style={{ borderWidth: '2px', borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                    <CardContent className="p-8">
                        <h3 className="text-2xl font-semibold mb-4" style={{ color: '#7A1E1E' }}>
                            Rule 2 — Minimum Quality Threshold (Required)
                        </h3>
                        <p className="mb-4" style={{ color: '#D4D4D4' }}>
                            Projects must demonstrate a minimum professional standard through one of the following:
                        </p>
                        <div className="space-y-4 mb-6">
                            <div className="pl-4" style={{ borderLeftWidth: '4px', borderLeftColor: '#A98E4A' }}>
                                <p className="font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                    • A RevisionGrade score of 8.0 or higher in the relevant evaluation, or
                                </p>
                                <p className="font-medium mb-2" style={{ color: '#F2EFEA' }}>
                                    • A documented equivalent professional evaluation, such as:
                                </p>
                                <ul className="list-disc list-inside pl-4 space-y-1" style={{ color: '#D4D4D4' }}>
                                    <li>Literary agent evaluation</li>
                                    <li>Producer or development executive assessment</li>
                                    <li>Third-party professional analysis</li>
                                </ul>
                            </div>
                        </div>
                        <p className="mb-4" style={{ color: '#7B7B7B' }}>
                            Equivalent professional evaluations should assess structure, readiness, clarity, and viability using a transparent, defensible methodology, and produce a clearly articulated evaluative outcome suitable for comparison.
                        </p>
                        <p className="mb-2 font-medium" style={{ color: '#D4D4D4' }}>
                            Equivalent evaluations must include:
                        </p>
                        <ul className="list-disc list-inside space-y-1 mb-6" style={{ color: '#D4D4D4' }}>
                            <li>Clear methodology</li>
                            <li>A defensible quality conclusion</li>
                            <li>Supporting documentation (PDF or report)</li>
                        </ul>
                        <p className="font-semibold" style={{ color: '#F2EFEA' }}>
                            Both Rule 1 and Rule 2 must be satisfied for eligibility.
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Creator Responsibilities */}
            <div className="py-16" style={{ backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                <div className="max-w-6xl mx-auto px-6">
                    <h2 className="text-3xl font-semibold mb-6" style={{ color: '#7A1E1E' }}>Creator Responsibilities</h2>
                    <p className="mb-4" style={{ color: '#D4D4D4' }}>Creators must:</p>
                    <ul className="space-y-3">
                        {[
                            "Provide a complete professional package (single PDF)",
                            "Confirm rights ownership or control for the submitted work",
                            "Meet the quality threshold through a RevisionGrade evaluation or an equivalent professional evaluation",
                            "Acknowledge that StoryGate is selective and that submission does not guarantee response, review, or acceptance"
                        ].map((item, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#A98E4A' }} />
                                <span style={{ color: '#F2EFEA' }}>{item}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Industry Verification & Access Control */}
            <div className="max-w-6xl mx-auto px-6 py-16">
                <h2 className="text-3xl font-semibold mb-6" style={{ color: '#7A1E1E' }}>Industry Verification & Access Control</h2>
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
                            <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ backgroundColor: '#A98E4A' }} />
                            <span style={{ color: '#D4D4D4' }}>{item}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Compliance, Logging & Governance */}
            <div className="py-16" style={{ backgroundColor: 'rgba(169, 142, 74, 0.1)' }}>
                <div className="max-w-6xl mx-auto px-6">
                    <h2 className="text-3xl font-semibold mb-6" style={{ color: '#7A1E1E' }}>Compliance, Logging & Governance</h2>
                    <p className="mb-4" style={{ color: '#D4D4D4' }}>The system records:</p>
                    <ul className="grid md:grid-cols-2 gap-3 mb-6">
                        {[
                            "Account ID and role",
                            "Project ID",
                            "Event type (view, request, unlock, revoke)",
                            "Timestamp",
                            "Access grant source (creator approval or admin action)"
                        ].map((item, idx) => (
                            <li key={idx} className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full flex-shrink-0 mt-2" style={{ backgroundColor: '#A98E4A' }} />
                                <span style={{ color: '#F2EFEA' }}>{item}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="italic" style={{ color: '#7B7B7B' }}>
                        StoryGate is an access layer, not a representation agreement, not a sales platform, and not a guarantee of opportunity.
                    </p>
                </div>
            </div>

            {/* Footer CTAs */}
            <div className="border-t py-16" style={{ borderColor: '#A98E4A' }}>
                <div className="max-w-6xl mx-auto px-6">
                    <div className="grid md:grid-cols-2 gap-8">
                        <Card style={{ borderWidth: '2px', borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                            <CardContent className="p-8 text-center">
                                <h3 className="text-xl font-semibold mb-4" style={{ color: '#7A1E1E' }}>For Industry</h3>
                                <Link to={createPageUrl('IndustryVerification')}>
                                    <Button size="lg" className="w-full hover:opacity-90 transition-opacity" style={{ backgroundColor: '#7A1E1E', color: '#F2EFEA' }}>
                                        Request Industry Access
                                    </Button>
                                </Link>
                            </CardContent>
                        </Card>
                        <Card style={{ borderWidth: '2px', borderColor: '#A98E4A', backgroundColor: 'rgba(14, 14, 14, 0.8)' }}>
                            <CardContent className="p-8 text-center">
                                <h3 className="text-xl font-semibold mb-4" style={{ color: '#7A1E1E' }}>For Creators</h3>
                                <div className="space-y-3">
                                    <Link to={createPageUrl('UploadManuscript')}>
                                        <Button size="lg" variant="outline" className="w-full" style={{ borderColor: '#A98E4A', color: '#F2EFEA', backgroundColor: 'transparent' }}>
                                            Get a RevisionGrade Evaluation
                                        </Button>
                                    </Link>
                                    <Link to={createPageUrl('FilmAdaptation')}>
                                        <Button size="lg" variant="outline" className="w-full" style={{ borderColor: '#A98E4A', color: '#F2EFEA', backgroundColor: 'transparent' }}>
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