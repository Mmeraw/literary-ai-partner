import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ArrowLeft, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";

export default function InternalTrustedPathContract() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <Link to={createPageUrl('InternalGovernanceIndex')}>
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Governance Index
          </Button>
        </Link>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-8 h-8 text-purple-600" />
            <h1 className="text-4xl font-bold text-slate-900">Trusted Path™ Contract and Thresholds</h1>
          </div>
          <div className="flex gap-2 mb-3">
            <Badge className="bg-purple-100 text-purple-800">Joint Authority</Badge>
            <Badge className="bg-slate-100 text-slate-800">Canonical Reference</Badge>
          </div>
          <p className="text-slate-600">
            <strong>Last Updated</strong>: 2025-12-30<br />
            <strong>Authority</strong>: Joint (RevisionGrade UX/PM + Base44 Engineering)<br />
            <strong>Change Protocol</strong>: Requires approval from both parties
          </p>
        </div>

        {/* Core Principles */}
        <Card className="mb-8 border-2 border-purple-200">
          <CardHeader>
            <CardTitle>Core Principles (Non-Negotiable)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-purple-900 mb-2">1. Structure-First Philosophy</h3>
              <blockquote className="border-l-4 border-purple-400 pl-4 italic text-slate-700 mb-2">
                "Trusted Path™ refines strong structure and diagnoses weak structure—it does not ghost-write missing story for you."
              </blockquote>
              <p className="text-sm text-slate-600">
                <strong>Meaning</strong>: Trusted Path™ operates on the assumption that narrative architecture (spine, beats, causality, stakes) is already present. 
                Where structure is weak, Trusted Path™ provides diagnostic guidance, not automated repair.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-purple-900 mb-2">2. No Ghostwriting Contract</h3>
              <blockquote className="border-l-4 border-purple-400 pl-4 italic text-slate-700 mb-2">
                "Trusted Path™ does not write your book for you."
              </blockquote>
              <p className="text-sm text-slate-600">
                <strong>Meaning</strong>: Trusted Path™ refines execution: clarity, coherence, pacing, consistency. 
                It does not invent plot points, create characters, or manufacture thematic depth.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-purple-900 mb-2">3. Conditional Refinement</h3>
              <blockquote className="border-l-4 border-purple-400 pl-4 italic text-slate-700 mb-2">
                "Edits apply only where structure supports them; otherwise, Trusted Path guides rebuild before polish."
              </blockquote>
              <p className="text-sm text-slate-600">
                <strong>Meaning</strong>: Trusted Path™ evaluates structural readiness before applying line-level revisions. 
                Below structural thresholds, it gates automated polish and redirects to repair paths.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Three-Zone Model */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Three-Zone Threshold Model</h2>

          {/* Zone 1: Failure */}
          <Card className="mb-6 border-2 border-red-200 bg-gradient-to-br from-red-50 to-white">
            <CardHeader>
              <CardTitle className="text-red-900">Zone 1: Structural Failure (0.0–5.9)</CardTitle>
              <Badge className="bg-red-100 text-red-800 w-fit">Diagnostic Only</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">What Base44 Does</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-slate-700">
                  <li>Runs full structural analysis (Spine/CHX13)</li>
                  <li>Identifies missing or unstable narrative elements: missing beats, broken causality, unclear stakes, character motive gaps, unanchored scenes</li>
                  <li>Outputs a <strong>Repair Map</strong>: prioritized list of structural issues with recommended sequence of work</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-2">What Trusted Path™ Does NOT Do</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-red-700">
                  <li>❌ No line-level or stylistic rewriting</li>
                  <li>❌ No WAVE polish (or only diagnostic WAVE, no auto-apply)</li>
                  <li>❌ No "Apply Best Revisions" button</li>
                </ul>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-2 text-sm">What Users See</h4>
                <div className="text-xs text-slate-700 font-mono bg-white p-2 rounded">
                  ⚠️ Structural readiness below threshold (6.0).<br />
                  Trusted Path™ is in diagnostic mode only.<br /><br />
                  Your manuscript lacks sufficient structural integrity<br />
                  for safe automated revision. Applying polish here<br />
                  would hide core problems rather than fix them.<br /><br />
                  → Start Structural Repair Path
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Zone 2: Conditional */}
          <Card className="mb-6 border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white">
            <CardHeader>
              <CardTitle className="text-amber-900">Zone 2: Conditional Readiness (6.0–7.9)</CardTitle>
              <Badge className="bg-amber-100 text-amber-800 w-fit">Guided Rebuild with Limited Edits</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">What Base44 Does</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-slate-700">
                  <li>Diagnoses structural weaknesses and gaps</li>
                  <li>Proposes scaffolded fixes (missing scenes, bridges, beats) as options</li>
                  <li>Allows localized line-level edits only in segments that meet internal stability criteria</li>
                  <li>Labels any local edits as "safe-zone edits" and explains why they were eligible</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-2">What Trusted Path™ Does</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-slate-700">
                  <li>✅ Applies <strong>High and Medium priority</strong> suggestions in structurally stable segments</li>
                  <li>✅ Limits quantity (e.g., max 20 safe edits per session)</li>
                  <li>⚠️ Keeps full-manuscript polish locked or clearly marked as "not recommended yet"</li>
                </ul>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-2 text-sm">What Users See</h4>
                <div className="text-xs text-slate-700 font-mono bg-white p-2 rounded">
                  ⚠️ Conditional readiness (6.0–7.9).<br />
                  Trusted Path™ will apply limited edits only in stable segments.<br /><br />
                  Your story has emerging structure but is not consistently stable.<br />
                  Focus on rebuilding architecture first. We'll polish where it's safe.<br /><br />
                  → Apply Safe Edits (20 changes)<br />
                  → View Structural Diagnosis
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Zone 3: Full */}
          <Card className="mb-6 border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
            <CardHeader>
              <CardTitle className="text-emerald-900">Zone 3: Full Trusted Path™ (8.0–10.0)</CardTitle>
              <Badge className="bg-emerald-100 text-emerald-800 w-fit">Full Automated Revision Enabled</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2">What Base44 Does</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-slate-700">
                  <li>Applies vetted line-level and stylistic revisions across the manuscript where structure supports them</li>
                  <li>Maintains authorial intent, without inventing new plotlines, themes, or characters</li>
                  <li>Surfaces remaining structural risks transparently while still allowing global polish</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 mb-2">What Trusted Path™ Does</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-slate-700">
                  <li>✅ Applies <strong>High, Medium, and Low priority</strong> suggestions globally</li>
                  <li>✅ Refines execution: clarity, coherence, pacing, consistency</li>
                  <li>✅ Provides before/after diffs and undo functionality</li>
                </ul>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-2 text-sm">What Users See</h4>
                <div className="text-xs text-slate-700 font-mono bg-white p-2 rounded">
                  ✅ Full Trusted Path™ enabled (8.0+).<br />
                  Structure supports automated polish.<br /><br />
                  Core narrative integrity is present. Trusted Path™ can<br />
                  safely refine execution without pretending to fix a broken story.<br /><br />
                  → Apply Trusted Path™ (247 changes)<br />
                  → Review Changes Manually
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gating Logic */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Gating Logic (Server-Side Enforcement)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-700">
              Base44 must enforce these rules server-side in: <code className="bg-slate-100 px-1 rounded">functions/generateRevisionSuggestions</code>, 
              <code className="bg-slate-100 px-1 rounded ml-1">functions/evaluateFullManuscript</code>, and any future revision workflows.
            </p>

            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Zone Detection Algorithm</h4>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto">
{`const getTrustedPathZone = (score) => {
  if (score < 6.0) return 'failure';     // Diagnostic only
  if (score < 8.0) return 'conditional'; // Limited polish
  return 'full';                         // Full polish enabled
};`}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Gating Response (Failure Zone)</h4>
              <p className="text-sm text-slate-700 mb-2">
                When <code className="bg-slate-100 px-1 rounded">zone === 'failure'</code>, polish requests return:
              </p>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto">
{`{
  "error": "structural_gating",
  "message": "Structural readiness below threshold (6.0). Trusted Path™ is in diagnostic mode only.",
  "zone": "failure",
  "score": 4.2,
  "recommendations": [
    "Focus on structural repair: missing beats, broken causality, unclear stakes",
    "Address character motive gaps and scene purpose",
    "Re-run evaluation after structural changes to unlock polish"
  ]
}`}
              </pre>
              <p className="text-sm text-slate-600 mt-2">
                <strong>HTTP Status</strong>: <code className="bg-slate-100 px-1 rounded">403 Forbidden</code>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Terminology Standards */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Terminology Standards</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-emerald-900 mb-2">✅ Preferred Terms</h4>
              <ul className="list-disc ml-6 space-y-1 text-sm text-slate-700">
                <li><strong>Trusted Path™</strong> (product name, headings, marketing)</li>
                <li><strong>Trusted Path</strong> (UI buttons, actionable elements)</li>
                <li><strong>Structural Failure Zone</strong> (0.0–5.9)</li>
                <li><strong>Conditional Readiness Zone</strong> (6.0–7.9)</li>
                <li><strong>Full Trusted Path Zone</strong> (8.0–10.0)</li>
                <li><strong>Structural Repair Path</strong> (diagnostic workflow)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-red-900 mb-2">❌ Avoid</h4>
              <ul className="list-disc ml-6 space-y-1 text-sm text-slate-700">
                <li>"Auto-fix"</li>
                <li>"One-click publishing"</li>
                <li>"AI ghostwriter"</li>
                <li>"Guaranteed results"</li>
                <li>"Industry-ready" (without qualification)</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* API Contract */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>API Contract</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-slate-700">
              Base44 must expose the following fields in evaluation results:
            </p>

            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Manuscript Level</h4>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto">
{`{
  "revisiongrade_overall": 7.3,
  "spine_score": 7.5,
  "revisiongrade_breakdown": {
    "trusted_path_zone": "conditional",
    "trusted_path_can_polish": "limited",
    "spine_score": 7.5,
    "average_chapter_score": 7.1,
    "integrity_clean": true
  }
}`}
              </pre>
            </div>

            <div>
              <h4 className="font-semibold text-slate-900 mb-2">Session Level (Revision Suggestions)</h4>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded-lg text-xs overflow-x-auto">
{`{
  "session_id": "abc123",
  "trusted_path_zone": "full",
  "trusted_path_can_polish": true,
  "suggestions": [...]
}`}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* Change Management */}
        <Card className="mb-8 bg-amber-50 border-2 border-amber-300">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <CardTitle>Change Management Protocol</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-700 mb-3">
              Any changes to this contract require:
            </p>
            <ol className="list-decimal ml-6 space-y-2 text-sm text-slate-700">
              <li><strong>Joint Review</strong>: Both RevisionGrade UX/PM and Base44 Engineering must approve</li>
              <li><strong>User Communication</strong>: If behavior changes, Help Center must be updated before deployment</li>
              <li><strong>Version Update</strong>: This document's "Last Updated" date must be modified</li>
              <li><strong>Cross-Reference Check</strong>: Update corresponding sections in RevisionGrade and Base44 responsibility docs</li>
            </ol>
          </CardContent>
        </Card>

        {/* Legal Notice */}
        <Card className="bg-slate-100 border-2 border-slate-300">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-3">⚖️ Legal & IP Protection</h3>
            <p className="text-sm text-slate-700 mb-2">
              <strong>Proprietary Technology</strong>: The three-zone threshold model, structural gating logic, and Trusted Path™ behavioral contract are proprietary to RevisionGrade™.
            </p>
            <p className="text-sm text-slate-700 mb-2">
              <strong>Attribution</strong>: Trusted Path™, CHX13, WAVE Revision System, and the Structure-Before-Polish methodology are intellectual property of Michael J. Meraw and RevisionGrade™.
            </p>
            <p className="text-sm text-slate-700 mb-3">
              <strong>Unauthorized Use</strong>: Any replication, adaptation, or derivative implementation of this threshold model without explicit written permission constitutes intellectual property infringement.
            </p>
            <p className="text-xs text-slate-600">
              © 2025 RevisionGrade™. All rights reserved.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}