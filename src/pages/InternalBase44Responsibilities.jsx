import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";

export default function InternalBase44Responsibilities() {
  const sections = [
    {
      title: "1. Evaluation Engine & State Machine",
      content: [
        "Designing and maintaining the full manuscript evaluation pipeline: Ingest → chapterization → CHX13/Spine → 13 agent criteria → WAVE tiers → aggregation",
        "Implementing a deterministic state machine for runs: States (`queued`, `running`, `ready`, `ready_with_errors`, `failed`); No 'stuck' jobs—every run must reach a terminal state",
        "Ensuring resumability and restart correctness: Force-Restart requeues stalled work, cleans stale chapter states, and does not create duplicate or orphaned runs"
      ],
      rule: "RevisionGrade UX/PM does not own backend state logic; they only consume the status API."
    },
    {
      title: "2. Structural Scoring & Thresholds",
      content: [
        "Computing Spine / CHX13 structural scores and exposing them via API in a stable schema",
        "Implementing the tiered threshold model: 0.0–5.9 (diagnostic only); 6.0–7.9 (guided rebuild + limited local edits); 8.0–10.0 (full Trusted Path™ capabilities)",
        "Enforcing gating rules server-side (what actions are allowed at each band)"
      ],
      rule: "RevisionGrade UX/PM controls how these bands and gates are explained visually, but not the logic itself."
    },
    {
      title: "3. Trusted Path™ Behavior Contract",
      content: [
        'Enforcing core principles: "Trusted Path™ refines strong structure and diagnoses weak structure—it does not ghost-write missing story for you"; "Edits apply only where structure supports them"',
        "Implementing mode logic: `standard` vs `transgressive` evaluation modes; Changing interpretation and feedback tone by mode, not underlying craft or error detection",
        "Implementing gating logic: Zone `failure` (0.0–5.9) = diagnostic only; Zone `conditional` (6.0–7.9) = limited edits in stable segments only; Zone `full` (8.0–10.0) = full automated polish enabled"
      ],
      rule: "RevisionGrade UX/PM defines naming, marketing language, and UI placement, but Base44 guarantees the behavior matches the contract."
    },
    {
      title: "4. WAVE System & Reliability",
      content: [
        "Running WAVE checks as independent, timeout-bounded tasks per chapter (each wave has its own timeout, error handling, and logging; a single wave failure cannot stall a chapter or full run)",
        "Implementing graceful degradation (on WAVE failures, fall back to agent-only scoring and mark `wave_errors` for later review)",
        "Ensuring per-chapter progressive persistence (chapters move through `wave_status` states with saves after each tier)"
      ],
      rule: "RevisionGrade UX/PM uses only the final summarized outputs and high-level flags."
    },
    {
      title: "5. Progress, Status API & Telemetry",
      content: [
        "Providing a single status endpoint with: Run state, Numeric progress, Per-phase indicators and error summaries",
        "Guaranteeing monotonic, realistic progress (no permanent stalls at intermediate percentages; retry caps and cleanup so every chapter reaches completed or failed)",
        "Emitting durable telemetry (logs/trace rows) to debug: Phase entry/exit, Timing, attempts, and failure reasons per chapter"
      ],
      rule: "RevisionGrade UX/PM owns only the presentation of this status (progress bars, banners, toasts)."
    },
    {
      title: "6. Output Contracts & Versioning",
      content: [
        "Never mutating the original manuscript; always outputting: Original version, Evaluated/revised version(s), Change summaries and risk maps",
        "Maintaining stable schemas for: Scores (Spine, CHX13, criteria), Trusted Path™ revisions + explanations, Structural gating reports",
        "Versioning outputs and APIs so front-end can safely evolve without breaking"
      ],
      rule: "RevisionGrade UX/PM decide which outputs to show where, but Base44 guarantees they exist and adhere to the contract."
    },
    {
      title: "7. Integrity & Content Validation",
      content: [
        "Checking manuscript integrity before evaluation (detect placeholders, meta-notes, duplicate sections, outline-heavy formatting, archive markers)",
        "Calculating `clean_score` and apply appropriate penalties",
        "Storing integrity reports in evaluation results for transparency"
      ],
      rule: "Base44 determines technical integrity; RevisionGrade UX/PM decides how to communicate it to users."
    },
    {
      title: "8. Evaluation Modes (Standard / Transgressive)",
      content: [
        "Implementing mode flags (`evaluation_mode`: `standard`, `transgressive`, `trauma_memoir`)",
        "Adapting behavior by mode: Standard (market-aligned, risk-sensitive feedback); Transgressive (craft-first, assumes intent, labels Risk/Market Notes separately); Trauma Memoir (treats content as testimony, evaluates authenticity and coherence)",
        "Maintaining consistent detection across modes, changing only interpretation and feedback language"
      ],
      rule: "RevisionGrade UX/PM defines mode descriptions and warnings; Base44 implements the behavioral differences."
    },
    {
      title: "9. Error Handling & Deterministic Completion",
      content: [
        "Implementing retry limits per chapter (default: 2 retries)",
        "Forcing terminal states for stale runs (watchdogs to detect stuck `wave_status=running` chapters; automatic cleanup after timeout thresholds)",
        "Ensuring 100% progress by counting both completed and failed chapters as 'done'",
        "Surfacing clear error messages in `evaluation_progress` and chapter-level `error_message` fields"
      ],
      rule: "RevisionGrade UX/PM decides how errors are displayed; Base44 guarantees they are captured and exposed."
    },
    {
      title: "10. Change Management & Communication",
      content: [
        "Notifying RevisionGrade UX/PM of behavior/API changes in advance (new thresholds or scoring logic, new states or fields, changes to Trusted Path™ behavior or output schemas)",
        "Maintaining internal documentation for all evaluation logic and state transitions",
        "Providing migration guides when breaking changes are necessary"
      ],
      rule: "RevisionGrade UX/PM maintains product docs; Base44 maintains engine docs; both reference Shared docs for contractual truth."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
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
            <FileText className="w-8 h-8 text-emerald-600" />
            <h1 className="text-4xl font-bold text-slate-900">Base44 Responsibilities</h1>
          </div>
          <div className="flex gap-2 mb-3">
            <Badge className="bg-emerald-100 text-emerald-800">Engine Authority</Badge>
            <Badge className="bg-slate-100 text-slate-800">Canonical Reference</Badge>
          </div>
          <p className="text-slate-600">
            <strong>Last Updated</strong>: 2025-12-30<br />
            <strong>Authority</strong>: Base44 Engineering Team<br />
            <strong>Scope</strong>: All engine behavior, evaluation logic, thresholds, and internal guarantees
          </p>
        </div>

        {/* Overview */}
        <Card className="mb-8 border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-700 space-y-2">
            <p>
              This document defines all engine behavior, evaluation logic, thresholds, and internal guarantees for the Base44 AI evaluation engine.
            </p>
            <p className="font-semibold text-emerald-900">
              Contains no marketing language or UX copy—purely "what the engine does and why."
            </p>
          </CardContent>
        </Card>

        {/* Sections */}
        {sections.map((section, idx) => (
          <Card key={idx} className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">{section.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h4 className="font-semibold text-slate-900 mb-2 text-sm">Responsibilities:</h4>
                <ul className="list-disc ml-6 space-y-1 text-sm text-slate-700">
                  {section.content.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              {section.rule && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-700">
                    <strong>Rule</strong>: {section.rule}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {/* Change Log */}
        <Card className="mb-8 bg-slate-50 border-2 border-slate-300">
          <CardHeader>
            <CardTitle>Change Log</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-3">Date</th>
                  <th className="text-left py-2 px-3">Author</th>
                  <th className="text-left py-2 px-3">Summary</th>
                </tr>
              </thead>
              <tbody className="text-slate-700">
                <tr className="border-b">
                  <td className="py-2 px-3">2025-12-30</td>
                  <td className="py-2 px-3">Base44 / RevisionGrade</td>
                  <td className="py-2 px-3">Initial canonical documentation created</td>
                </tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Authority Notice */}
        <Card className="bg-emerald-50 border-2 border-emerald-300">
          <CardContent className="p-6">
            <h3 className="font-semibold text-emerald-900 mb-3">Authority & Ownership</h3>
            <p className="text-sm text-slate-700 mb-2">
              <strong>Document Owner</strong>: Base44 Engineering Team<br />
              <strong>Review Cycle</strong>: Quarterly or upon major engine release<br />
              <strong>Change Protocol</strong>: Any modification to evaluation logic, thresholds, or output schemas requires:
            </p>
            <ol className="list-decimal ml-6 text-sm text-slate-700 space-y-1 mb-3">
              <li>Review against <code className="bg-white px-1 rounded">InternalTrustedPathContract</code></li>
              <li>Notification to RevisionGrade UX/PM for UI/copy updates</li>
              <li>Update to this document</li>
            </ol>
            <p className="text-sm font-semibold text-emerald-900">
              This document is authoritative for all engine behavior, evaluation logic, and system guarantees.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}