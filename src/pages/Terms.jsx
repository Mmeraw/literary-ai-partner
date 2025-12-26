import React from 'react';

export default function Terms() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8">Terms of Service</h1>
                
                <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
                    <section>
                        <h2 className="text-2xl font-semibold text-slate-900 mb-3">Service Description</h2>
                        <p>
                            RevisionGrade provides AI-powered manuscript and screenplay evaluation services 
                            using the WAVE Revision System and 12 literary agent criteria.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-slate-900 mb-3">Intellectual Property</h2>
                        <p>
                            You retain full ownership of all creative work submitted. RevisionGrade retains 
                            ownership of the WAVE Revision System methodology and evaluation framework.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-slate-900 mb-3">Acceptable Use</h2>
                        <p>
                            Users must not abuse the service, share accounts, or use the platform for 
                            illegal purposes. Rate limits and usage tiers apply.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-slate-900 mb-3">Disclaimers</h2>
                        <p>
                            Evaluations are provided as-is for educational purposes. RevisionGrade does not 
                            guarantee publication or representation outcomes.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-slate-900 mb-3">Limitation of Liability</h2>
                        <p>
                            RevisionGrade is not liable for publishing outcomes, lost opportunities, or 
                            subjective disagreements with evaluation results.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-slate-900 mb-3">Contact</h2>
                        <p>
                            For questions about these terms, contact{' '}
                            <a href="mailto:support@revisiongrade.com" className="text-indigo-600 hover:text-indigo-700">
                                support@revisiongrade.com
                            </a>
                        </p>
                    </section>

                    <p className="text-sm text-slate-500 mt-8">
                        Last updated: December 2025
                    </p>
                </div>
            </div>
        </div>
    );
}