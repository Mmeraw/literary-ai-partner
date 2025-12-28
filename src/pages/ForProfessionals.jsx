import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, BookOpen, Users, Target, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function ForProfessionals() {
  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-16 sm:py-24">
          <div className="text-center mb-12">
            <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              For Agents, Editors, and Development Teams
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto">
              A Professional Evaluation Layer for Modern Manuscript Review
            </p>
          </div>

          <div className="prose prose-lg prose-slate max-w-none">
            <p className="text-lg text-slate-700 leading-relaxed">
              This system exists to support the realities of contemporary publishing—high submission volume, 
              limited time, and the need for fast, defensible early decisions.
            </p>
            <p className="text-lg text-slate-700 leading-relaxed mt-4">
              <strong>It is not a replacement for editorial judgment.</strong><br />
              It is a structured support layer designed to help professionals triage, prioritize, and assess 
              submissions more efficiently.
            </p>
          </div>
        </div>
      </div>

      {/* What This Is */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-slate-900 mb-6">What This Is</h2>
        <p className="text-lg text-slate-700 mb-6">
          A professional evaluation framework built around how agents, editors, and development teams 
          actually assess manuscripts.
        </p>
        
        <Card className="border-slate-200">
          <CardContent className="p-8">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-slate-900 mt-1 flex-shrink-0" />
                <p className="text-slate-700">
                  A 12-criterion story and structure evaluation framework grounded in industry practice
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-slate-900 mt-1 flex-shrink-0" />
                <p className="text-slate-700">
                  Explicit checks for common acquisition red flags
                </p>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-slate-900 mt-1 flex-shrink-0" />
                <p className="text-slate-700">
                  A meta-layer that evaluates clarity, coherence, and market readiness
                </p>
              </div>
            </div>
            <p className="text-slate-700 mt-6 pt-6 border-t border-slate-200">
              Together, these elements provide a consistent signal of whether a manuscript warrants deeper attention.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* What This Is Not */}
      <div className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">What This Is Not</h2>
          <p className="text-lg text-slate-700 mb-6">This system is not:</p>
          
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="flex items-start gap-3">
              <span className="text-slate-400 text-xl">×</span>
              <p className="text-slate-700">A replacement for editorial judgment</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-slate-400 text-xl">×</span>
              <p className="text-slate-700">A generative writing tool</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-slate-400 text-xl">×</span>
              <p className="text-slate-700">An automated acceptance or rejection engine</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-slate-400 text-xl">×</span>
              <p className="text-slate-700">A substitute for taste, experience, or instinct</p>
            </div>
          </div>
          
          <p className="text-lg text-slate-900 font-medium">
            It exists to support human decision-making, not automate it.
          </p>
        </div>
      </div>

      {/* Why This Exists */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-slate-900 mb-6">Why This Exists</h2>
        <p className="text-lg text-slate-700 mb-6">
          Publishing professionals face the same constraints across agencies and imprints:
        </p>

        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <BookOpen className="w-8 h-8 text-slate-700 mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">High submission volume</h3>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <Target className="w-8 h-8 text-slate-700 mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Limited reading time</h3>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <Users className="w-8 h-8 text-slate-700 mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Inconsistent early evaluations</h3>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <Shield className="w-8 h-8 text-slate-700 mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Pressure to justify pass decisions</h3>
            </CardContent>
          </Card>
        </div>

        <p className="text-lg text-slate-700">
          This framework addresses those realities by surfacing common failure points early—before time 
          and attention are overcommitted.
        </p>
        <p className="text-lg text-slate-700 mt-4">
          It focuses on clarity, structure, and readiness, not trend-chasing or stylistic preference.
        </p>
      </div>

      {/* How Professionals Use It */}
      <div className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">How Professionals Use It</h2>
          <p className="text-lg text-slate-700 mb-6">In practice, the system supports:</p>
          
          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-2.5 flex-shrink-0" />
              <p className="text-slate-700">Slush-pile triage and internal coverage alignment</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-2.5 flex-shrink-0" />
              <p className="text-slate-700">Early-stage filtering before full reads</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-2.5 flex-shrink-0" />
              <p className="text-slate-700">Shared evaluation language across assistants and editors</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-900 mt-2.5 flex-shrink-0" />
              <p className="text-slate-700">More consistent, defensible decision-making</p>
            </div>
          </div>

          <p className="text-lg text-slate-700">
            It functions as a quiet internal tool, not a public scoring mechanism.
          </p>
        </div>
      </div>

      {/* What Makes It Different */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-slate-900 mb-6">What Makes It Different</h2>
        <p className="text-lg text-slate-700 mb-6">
          Unlike generic scoring tools, this framework reflects how publishing professionals actually think:
        </p>

        <div className="space-y-4 mb-6">
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <p className="text-slate-700">It distinguishes craft issues from market misalignment</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <p className="text-slate-700">It identifies structural and conceptual breakdowns early</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <p className="text-slate-700">It evaluates whether a manuscript fulfills its own promise</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-6">
              <p className="text-slate-700">It supports judgment rather than replacing it</p>
            </CardContent>
          </Card>
        </div>

        <p className="text-lg text-slate-900 font-medium">
          The goal is not to rank creativity, but to clarify readiness.
        </p>
      </div>

      {/* Designed for Real Editorial Workflows */}
      <div className="bg-slate-50 border-y border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-16">
          <h2 className="text-3xl font-bold text-slate-900 mb-6">Designed for Real Editorial Workflows</h2>
          <p className="text-lg text-slate-700 mb-6">
            This system is intentionally discreet and adaptable.
          </p>
          
          <p className="text-lg text-slate-700 mb-4">It can be used:</p>
          <div className="space-y-2 mb-6">
            <p className="text-slate-700">• By individual agents or editors</p>
            <p className="text-slate-700">• Across editorial teams</p>
            <p className="text-slate-700">• As part of submission triage</p>
            <p className="text-slate-700">• For internal coverage and calibration</p>
          </div>

          <p className="text-lg text-slate-700">
            There are no public scores, no automated approvals, and no exposure of internal criteria.
          </p>
        </div>
      </div>

      {/* Why It Exists - Closing */}
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-slate-900 mb-6">Why It Exists</h2>
        <p className="text-lg text-slate-700 mb-6">
          Because most manuscripts do not fail for lack of imagination.
        </p>
        <p className="text-lg text-slate-700 mb-6">
          They fail because early structural, conceptual, or clarity issues obscure their potential.
        </p>
        <p className="text-lg text-slate-900 font-medium mb-8">
          This framework exists to surface those issues early—so professionals can spend their time 
          where it matters most.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-8">
          <a href="mailto:sales@revisiongrade.com">
            <Button size="lg" className="bg-slate-900 hover:bg-slate-800">
              Request Information
            </Button>
          </a>
          <a href={createPageUrl('Pricing')}>
            <Button size="lg" variant="outline" onClick={(e) => {
              e.preventDefault();
              window.location.href = createPageUrl('Pricing');
              setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
            }}>
              View Pricing
            </Button>
          </a>
        </div>
      </div>
    </div>
  );
}