import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Lock, Brain, FileCheck, CheckCircle2, Eye } from 'lucide-react';

export default function SecurityAndEthics() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                {/* Header */}
                <div className="text-center mb-12">
                    <Badge className="mb-4 px-4 py-2 bg-indigo-100 text-indigo-700 border-indigo-200">
                        <Shield className="w-4 h-4 mr-2" />
                        Security & Ethics
                    </Badge>
                    <h1 className="text-4xl font-bold text-slate-900 mb-4">
                        🔒 Your Work Is Safe Here — And Here's Why
                    </h1>
                    <p className="text-lg text-slate-600 max-w-3xl mx-auto">
                        We built RevisionGrade for writers who care deeply about their work.
                        That means everything you upload is protected by clear rules, technical safeguards, 
                        and security controls aligned with industry standards.
                    </p>
                </div>

                {/* Main Content */}
                <div className="space-y-8">
                    {/* Your Writing Stays Yours */}
                    <Card className="border-2 border-indigo-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <Lock className="w-6 h-6 text-indigo-600" />
                                🔐 Your Writing Stays Yours
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-slate-700 font-semibold">What this means in practice:</p>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">We do not train models on your manuscript—ever.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">Your work is not shared, resold, or added to any public dataset.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">Your content is used only to generate your evaluations, revisions, and outputs.</span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* You Stay in Control */}
                    <Card className="border-2 border-purple-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <Brain className="w-6 h-6 text-purple-600" />
                                🧠 You Stay in Control
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-slate-700">RevisionGrade is built so nothing happens behind your back:</p>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">Revisions are user-initiated, not automatic.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">"Final" is a lock, not a label: when you mark a version Final, it becomes read-only.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">If you want to keep working, you clone the Final and continue—your locked version stays untouched.</span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Clear History, No Surprises */}
                    <Card className="border-2 border-emerald-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <FileCheck className="w-6 h-6 text-emerald-600" />
                                🧾 Clear History, No Surprises
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-slate-700">Think of RevisionGrade as version control for writers:</p>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">Evaluations and revisions are saved as separate runs/versions.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">You can always see what changed, when, and why.</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">No silent overwrites. If something changes, it's because you clicked a button.</span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Secure by Design */}
                    <Card className="border-2 border-slate-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <Shield className="w-6 h-6 text-slate-600" />
                                🔒 Secure by Design
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-slate-700">Your work is protected with standard, modern safeguards:</p>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">Encryption in transit and encryption at rest</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">Strict access controls (only you—and authorized systems—can access your files)</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">Audit-friendly activity tracking for key actions</span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Compliance Signals */}
                    <Card className="border-2 border-blue-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <CheckCircle2 className="w-6 h-6 text-blue-600" />
                                ✅ Compliance Signals That Matter
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-slate-700">
                                We follow a security posture aligned with professional and enterprise expectations:
                            </p>
                            <ul className="space-y-3">
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">SOC 2–aligned controls (security, access control, auditability)</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">GDPR-ready data handling (access, export, deletion workflows)</span>
                                </li>
                                <li className="flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <span className="text-slate-700">Built to support studio/agency workflows where confidentiality matters</span>
                                </li>
                            </ul>
                        </CardContent>
                    </Card>

                    {/* Transparent System */}
                    <Card className="border-2 border-amber-200">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-3 text-2xl">
                                <Eye className="w-6 h-6 text-amber-600" />
                                🧭 Transparent System, Not a Black Box
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-slate-700">
                                RevisionGrade isn't "AI that rewrites your book."
                                It's a structured pipeline you can understand:
                            </p>
                            <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                                <p className="text-center font-semibold text-slate-900">
                                    Upload → Evaluate → Revise → Mark Final → Output
                                </p>
                            </div>
                            <p className="text-slate-700">
                                That structure protects your work—because the system can't drift into hidden edits or unclear states.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Bottom Banner */}
                    <Card className="bg-gradient-to-r from-indigo-600 to-purple-600 border-0">
                        <CardContent className="p-8 text-center">
                            <p className="text-xl font-bold text-white mb-2">
                                SOC 2–aligned. Encrypted. No training on your work. No silent overwrites.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}