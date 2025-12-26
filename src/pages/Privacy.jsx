import React from 'react';

export default function Privacy() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
            <div className="max-w-4xl mx-auto px-6 py-12">
                <h1 className="text-3xl font-bold text-slate-900 mb-8">Privacy Policy</h1>
                
                <div className="prose prose-slate max-w-none space-y-6 text-slate-700">
                    <section>
                        <h2 className="text-2xl font-semibold text-slate-900 mb-3">Information We Collect</h2>
                        <p>
                            We collect information you provide when using RevisionGrade, including manuscripts, 
                            screenplays, and evaluation results.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-slate-900 mb-3">How We Use Your Information</h2>
                        <p>
                            Your data is used solely to provide evaluation services. We use AI services to analyze 
                            your submissions and generate feedback.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-slate-900 mb-3">Data Security</h2>
                        <p>
                            We implement industry-standard security measures to protect your manuscripts and personal information.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-slate-900 mb-3">Your Rights</h2>
                        <p>
                            You retain all rights to your creative work. You may delete your data at any time.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-2xl font-semibold text-slate-900 mb-3">Contact</h2>
                        <p>
                            For privacy concerns, contact us at{' '}
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