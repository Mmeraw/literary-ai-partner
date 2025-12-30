import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from "@/components/ui/button";

export default function InternalRevisionGradeResponsibilities() {
  const sections = [
    {
      title: "1. Product Vision, Positioning & Promises",
      content: [
        "Defining who RevisionGrade serves (authors, agents, editors, producers)",
        "What is promised at each tier (Quick Evaluate vs Full Manuscript vs Trusted Path™)",
        "Ensuring all public claims align with Base44 contract: Structure-first, no ghostwriting; Diagnosis + guided repair, not 'push-button publishing'"
      ],
      canonical: [
        '"Trusted Path™ refines strong structure and diagnoses weak structure—it does not ghost-write missing story for you."',
        '"Edits apply only where structure supports them; otherwise, Trusted Path guides rebuild before polish."',
        '"RevisionGrade provides AI-generated analysis calibrated against professional editorial standards. It does not replace human editorial judgment—final decisions remain with the author."'
      ]
    },
    {
      title: "2. Information Architecture & Help Center",
      content: [
        "Designing the Help Center / knowledge base structure (categories: Getting Started, CHX13 & Scores, Trusted Path™, WAVE System, Account & Billing)",
        "Writing and updating help articles that explain Spine/CHX13 bands and Trusted Path™ thresholds in user language",
        "Keeping UI copy, FAQs, and Help Center consistent with Base44's behavioral contracts and API fields"
      ]
    },
    {
      title: "3. UX Flows & Screen Behavior",
      content: [
        "Designing end-to-end flows: Upload → evaluation summary → choice of Manual Review vs Trusted Path™; Structural gating screens → Structural Repair Path → re-run",
        "Defining how each status from Base44 maps to UI states: `running` → progress screen; `ready` / `ready_with_errors` → results screen with banners",
        "Specifying behavior for controls: When Force Restart is visible/enabled; What happens on click"
      ]
    },
    {
      title: "4. Copy, Tone & Mode-Specific Messaging",
      content: [
        "Writing all UI copy around Trusted Path™, CHX13, WAVE, and Transgressive Mode (activation modals, warnings, tooltips, banners, completion screens)",
        "Maintaining tone by mode: Standard Mode (market-aligned, risk-sensitive feedback); Transgressive Mode (craft-first, boundary-aware, labeled Risk / Market Notes section)",
        "Defining 'no ghostwriting' and 'no guarantee' language consistently across Marketing pages, In-app copy, Help Center and Terms of Service"
      ]
    },
    {
      title: "5. Progress UI, Feedback & Error Handling",
      content: [
        "Designing progress visualization that consumes Base44's fields (bars, phase labels, 'warming up' hints, estimated feel)",
        "Specifying user-facing messages for common states (slow starts, partial success / `ready_with_errors`)",
        "Defining support escalation paths in UI ('Still stuck?' → link to Help Center or contact form)"
      ]
    },
    {
      title: "6. Feature Flags, Plans & Access Control",
      content: [
        "Deciding which users see which features and when (which plans get Quick Evaluate only vs Full Manuscript vs Trusted Path™; when Transgressive Mode is available)",
        "Owning the feature flag matrix (environment, tier, A/B experiments)",
        "Ensuring that gating visible in the UI matches back-end permissions"
      ]
    },
    {
      title: "7. Data Presentation & Safeguards",
      content: [
        "Choosing which scores and diagnostics to expose (how Spine/CHX13 are visualized; which WAVE findings are shown and at what granularity)",
        "Defining safe defaults for early-stage users (recommended paths, warnings before destructive actions)",
        "Aligning UI with privacy & expectation management (what is stored, how drafts are versioned, that original manuscripts remain untouched)"
      ]
    },
    {
      title: "8. Internal Communication & Change Management",
      content: [
        "Maintaining a single source of truth doc and updating it when behavior or messaging changes",
        "Reviewing Base44 changes that affect thresholds, new states or fields, changes in Trusted Path™ behavior or wording requirements",
        "Coordinating rollouts so that when Base44 changes behavior, corresponding UI copy and Help Center content are updated"
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
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
            <FileText className="w-8 h-8 text-indigo-600" />
            <h1 className="text-4xl font-bold text-slate-900">RevisionGrade UX/PM Responsibilities</h1>
          </div>
          <div className="flex gap-2 mb-3">
            <Badge className="bg-indigo-100 text-indigo-800">Product Authority</Badge>
            <Badge className="bg-slate-100 text-slate-800">Canonical Reference</Badge>
          </div>
          <p className="text-slate-600">
            <strong>Last Updated</strong>: 2025-12-30<br />
            <strong>Last Reviewed</strong>: 2025-12-30<br />
            <strong>Authority</strong>: RevisionGrade Product Owner<br />
            <strong>Scope</strong>: All user-facing promises, UX behavior, terminology, and product positioning<br />
            <strong>Next Review Trigger</strong>: Any changes to user promises, UX messaging, or Trusted Path copy
          </p>
        </div>

        {/* Change Control Rules */}
        <Card className="mb-8 border-2 border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle>Change Control Rules</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-slate-700">
            <p>
              <strong>If user promises or UX messaging changes</strong>: Update this document + InternalTrustedPathContract
            </p>
            <p>
              <strong>If engine exposes new fields or behaviors</strong>: Coordinate with Base44 to update UI/copy surfaces before deployment
            </p>
            <p className="font-semibold text-indigo-900 mt-3">
              This is the enforcement mechanism that prevents product drift from engine reality.
            </p>
          </CardContent>
        </Card>

        {/* Overview */}
        <Card className="mb-8 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="text-slate-700 space-y-2">
            <p>
              This document defines all user-facing promises, UX behavior, terminology, and product positioning for RevisionGrade™.
            </p>
            <p className="font-semibold text-indigo-900">
              CRITICAL: Base44 must not independently change user-facing promises without UX/PM sign-off.
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

              {section.canonical && (
                <div className="mt-4 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                  <h4 className="font-semibold text-indigo-900 mb-2 text-sm">Canonical Language (Mandatory):</h4>
                  {section.canonical.map((quote, i) => (
                    <blockquote key={i} className="border-l-4 border-indigo-400 pl-3 italic text-slate-700 text-sm mb-2">
                      {quote}
                    </blockquote>
                  ))}
                </div>
              )}

              {idx === 0 && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-700">
                    <strong>Rule</strong>: Base44 provides raw behavior and field definitions; RevisionGrade explains them.
                  </p>
                </div>
              )}

              {idx === 2 && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-700">
                    <strong>Rule</strong>: Base44 provides status and events; RevisionGrade decides how they look and feel.
                  </p>
                </div>
              )}

              {idx === 3 && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-700">
                    <strong>Rule</strong>: Base44 must follow the provided wording patterns (verbs to use/avoid), not invent its own tone.
                  </p>
                </div>
              )}

              {idx === 4 && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-700">
                    <strong>Rule</strong>: Base44 guarantees the numeric/semantic signals; RevisionGrade turns them into understandable, reassuring feedback.
                  </p>
                </div>
              )}

              {idx === 5 && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-700">
                    <strong>Rule</strong>: Base44 respects flags/entitlements passed in but does not decide pricing or segmentation.
                  </p>
                </div>
              )}

              {idx === 6 && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-700">
                    <strong>Rule</strong>: Base44 ensures data exists and is versioned; RevisionGrade decides what and how much to reveal.
                  </p>
                </div>
              )}

              {idx === 7 && (
                <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="text-xs text-slate-700">
                    <strong>Rule</strong>: Base44 informs of engine changes early; RevisionGrade ensures user-facing surfaces stay in sync.
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
        <Card className="bg-indigo-50 border-2 border-indigo-300">
          <CardContent className="p-6">
            <h3 className="font-semibold text-indigo-900 mb-3">Authority & Ownership</h3>
            <p className="text-sm text-slate-700 mb-2">
              <strong>Document Owner</strong>: RevisionGrade Product/UX Team<br />
              <strong>Review Cycle</strong>: Quarterly or upon major feature release<br />
              <strong>Change Protocol</strong>: Any modification to user-facing promises requires UX/PM approval and cross-reference to <code className="bg-white px-1 rounded">InternalTrustedPathContract</code>
            </p>
            <p className="text-sm font-semibold text-indigo-900 mt-3">
              This document is authoritative for all product, UX, and user-facing decisions.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}