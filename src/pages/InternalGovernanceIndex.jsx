import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Shield, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function InternalGovernanceIndex() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-8 h-8 text-indigo-600" />
            <h1 className="text-4xl font-bold text-slate-900">Governance Documentation</h1>
          </div>
          <p className="text-lg text-slate-600">
            Canonical reference for RevisionGrade™ product, Base44 engine, and shared contractual truth.
          </p>
          <Badge className="mt-3 bg-red-100 text-red-800 border-red-300">
            <Lock className="w-3 h-3 mr-1" />
            CONFIDENTIAL - Admin Only
          </Badge>
        </div>

        {/* Status Summary */}
        <Card className="mb-8 border-2 border-indigo-200 bg-gradient-to-br from-indigo-50 to-white">
          <CardHeader>
            <CardTitle>State of Base44 (Founder/Investor Ready)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-slate-700 leading-relaxed">
              Base44 has moved from concept to execution: the full-manuscript pipeline now runs as a deterministic state machine with retries and terminal outcomes, WAVE checks are isolated and timeout-bounded per chapter to prevent whole-run stalls, and Trusted Path™ is operationalized with a 3-zone structural readiness model that gates global polish until narrative integrity is strong enough. Help Center and in-app language now align with the no-ghostwriting / no-false-polish contract, and we're instantiating a three-document governance spine (RevisionGrade UX/PM responsibilities, Base44 responsibilities, and the Trusted Path™ contract + thresholds) to keep product promises and engine behavior permanently in sync.
            </p>
          </CardContent>
        </Card>

        {/* Core Principles */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Three-Tier Separation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-slate-700">
            <p><strong>1. Product promises</strong> are separate from <strong>engine internals</strong></p>
            <p><strong>2. Shared contracts</strong> bridge the two without bleed</p>
            <p><strong>3. IP protection</strong> is explicit and enforceable</p>
          </CardContent>
        </Card>

        {/* Canonical vs Index */}
        <Card className="mb-8 border-2 border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <p className="text-sm text-slate-700">
              <strong>Note</strong>: This index page is a <strong>navigation router</strong>, not a governance authority. 
              The three canonical documents below are the authoritative sources. 
              Any behavior, messaging, or threshold changes must update the relevant canonical page(s).
            </p>
          </CardContent>
        </Card>

        {/* Canonical Documents */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Canonical Documentation</h2>

          {/* Shared Contract */}
          <Link to={createPageUrl('InternalTrustedPathContract')}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-purple-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="w-5 h-5 text-purple-600" />
                      <h3 className="text-lg font-semibold text-slate-900">
                        Trusted Path™ Contract and Thresholds
                      </h3>
                    </div>
                    <Badge className="bg-purple-100 text-purple-800 mb-2">Joint Authority</Badge>
                    <p className="text-sm text-slate-600">
                      Binding contract between RevisionGrade product promises and Base44 engine behavior. 
                      Defines 3-zone threshold model, no-ghostwriting contract, and gating logic.
                    </p>
                  </div>
                  <FileText className="w-6 h-6 text-purple-600 ml-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* RevisionGrade Responsibilities */}
          <Link to={createPageUrl('InternalRevisionGradeResponsibilities')}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-indigo-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-indigo-600" />
                      <h3 className="text-lg font-semibold text-slate-900">
                        RevisionGrade UX/PM Responsibilities
                      </h3>
                    </div>
                    <Badge className="bg-indigo-100 text-indigo-800 mb-2">Product Authority</Badge>
                    <p className="text-sm text-slate-600">
                      Defines all user-facing promises, UX behavior, terminology, and product positioning. 
                      Owns how Trusted Path™, scoring, and messaging are explained to users.
                    </p>
                  </div>
                  <FileText className="w-6 h-6 text-indigo-600 ml-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Base44 Responsibilities */}
          <Link to={createPageUrl('InternalBase44Responsibilities')}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 border-emerald-200">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-emerald-600" />
                      <h3 className="text-lg font-semibold text-slate-900">
                        Base44 Responsibilities
                      </h3>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-800 mb-2">Engine Authority</Badge>
                    <p className="text-sm text-slate-600">
                      Defines engine behavior, evaluation logic, thresholds, and internal guarantees. 
                      Contains no marketing or UX copy—only system truth.
                    </p>
                  </div>
                  <FileText className="w-6 h-6 text-emerald-600 ml-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Authority Matrix */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Responsibility Matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Area</th>
                    <th className="text-left py-2 px-3">RevisionGrade UX/PM</th>
                    <th className="text-left py-2 px-3">Base44 Engineering</th>
                    <th className="text-left py-2 px-3">Joint</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  <tr className="border-b">
                    <td className="py-2 px-3">Product vision & promises</td>
                    <td className="py-2 px-3">✅ Owns</td>
                    <td className="py-2 px-3">Follows</td>
                    <td className="py-2 px-3">-</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3">Evaluation pipeline</td>
                    <td className="py-2 px-3">Consumes API</td>
                    <td className="py-2 px-3">✅ Owns</td>
                    <td className="py-2 px-3">-</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3">Structural thresholds</td>
                    <td className="py-2 px-3">Explains in UI</td>
                    <td className="py-2 px-3">✅ Computes</td>
                    <td className="py-2 px-3">Contract in Shared</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3">Trusted Path™ behavior</td>
                    <td className="py-2 px-3">Defines messaging</td>
                    <td className="py-2 px-3">✅ Implements</td>
                    <td className="py-2 px-3">Contract in Shared</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2 px-3">IP protection</td>
                    <td className="py-2 px-3">-</td>
                    <td className="py-2 px-3">-</td>
                    <td className="py-2 px-3">✅ Joint (Legal/Exec)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Legal Notice */}
        <Card className="mt-8 bg-slate-100 border-2 border-slate-300">
          <CardContent className="p-6">
            <h3 className="font-semibold text-slate-900 mb-2">⚖️ Legal Notice</h3>
            <p className="text-sm text-slate-700 mb-2">
              <strong>Proprietary Information</strong>: All documentation is proprietary to RevisionGrade™ 
              and protected by trade secret, copyright, and trademark law.
            </p>
            <p className="text-sm text-slate-700">
              <strong>IP Owner</strong>: Michael J. Meraw / RevisionGrade™
            </p>
            <p className="text-xs text-slate-600 mt-3">
              © 2025 RevisionGrade™. All rights reserved.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}