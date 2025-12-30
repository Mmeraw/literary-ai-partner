import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Shield, CheckCircle2, BookOpen } from 'lucide-react';

export default function SlurHandlingPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-100 text-red-700 text-sm font-medium mb-4">
            <Shield className="w-4 h-4" />
            Policy Document
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">
            Slur Handling Policy
          </h1>
          <p className="text-lg text-slate-600">
            Base44 / RevisionGrade approach to high-risk language detection and classification
          </p>
        </div>

        {/* Introduction */}
        <Card className="mb-6 border-l-4 border-l-indigo-500">
          <CardContent className="p-6">
            <p className="text-slate-700">
              This system is designed to recognize, classify, and constrain slur and hate-speech usage in manuscripts. 
              <strong> It does not generate new slurs or "punch up" bigotry.</strong>
            </p>
          </CardContent>
        </Card>

        {/* Section 1: What Counts */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              1. What counts as a slur or hate expression
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Paradigmatic slurs</h3>
              <p className="text-slate-600 text-sm">
                Canonical, widely recognized epithets tied to race, ethnicity, religion, sexuality, gender, disability, 
                or nationality (e.g., anti-Black, antisemitic, homophobic, transphobic, ableist terms).
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Reclaimed labels</h3>
              <p className="text-slate-600 text-sm">
                Historically derogatory words used as in-group identity ("queer", "dyke", etc.), which can be affirming 
                in-group and harmful from out-group speakers.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Implicit group hate</h3>
              <p className="text-slate-600 text-sm">
                Dehumanizing or violent language aimed at groups even without a dictionary slur 
                (e.g., "these people are animals", "round them up and ship them back").
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Compound insults and stereotypes</h3>
              <p className="text-slate-600 text-sm">
                Constructions like "[group] trash", "[slur]-lover", "all [group] are X", "they're taking all our jobs", 
                which combine identity with negative predicates.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Risk Buckets */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-600" />
              2. Risk buckets and actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-slate-600 mb-4">
              Each detected case is assigned a <Badge variant="outline">risk_bucket</Badge> and a <Badge variant="outline">usage_type</Badge>, 
              which determine what Base44 may or may not do:
            </p>

            {/* MARKET_RISK */}
            <div className="border-l-4 border-l-red-500 pl-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-red-100 text-red-700">MARKET_RISK</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">What it covers:</p>
                  <ul className="list-disc list-inside text-slate-600 ml-2">
                    <li>Explicit paradigmatic slurs in hostile or group-label use</li>
                    <li>Dehumanizing or violent group rhetoric, with or without a slur</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-slate-900">System behavior:</p>
                  <ul className="list-disc list-inside text-slate-600 ml-2">
                    <li>Always flag for review (e.g., MARKET_RISK_REVIEW)</li>
                    <li>Never auto-rewrite, "soften," or suggest alternative wordings that preserve the insult</li>
                    <li>May trigger retailer/platform content-risk warnings, depending on client configuration</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* VOICE_AUTHENTIC */}
            <div className="border-l-4 border-l-green-500 pl-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-green-100 text-green-700">VOICE_AUTHENTIC</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">What it covers:</p>
                  <ul className="list-disc list-inside text-slate-600 ml-2">
                    <li>In-group reclamation of slurs</li>
                    <li>Community self-labels and event titles ("Queer and trans poetry night")</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-slate-900">System behavior:</p>
                  <ul className="list-disc list-inside text-slate-600 ml-2">
                    <li>Preserve text as-is</li>
                    <li>Track as sensitive but do not block, and do not suggest the term to out-group speakers or neutral narrators</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* HISTORICAL_CONTEXT_ONLY */}
            <div className="border-l-4 border-l-amber-500 pl-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-amber-100 text-amber-700">HISTORICAL_CONTEXT_ONLY</Badge>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">What it covers:</p>
                  <ul className="list-disc list-inside text-slate-600 ml-2">
                    <li>Analytical, educational, or historical discussion of slurs as objects ("a weapon disguised as language")</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-slate-900">System behavior:</p>
                  <ul className="list-disc list-inside text-slate-600 ml-2">
                    <li>Preserve text as-is</li>
                    <li>Optionally recommend a brief context or content note when usage is frequent or especially severe</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* VOICE_CONTEXT_ALLOWED */}
            <div className="border-l-4 border-l-blue-500 pl-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge className="bg-blue-100 text-blue-700">VOICE_CONTEXT_ALLOWED</Badge>
                <span className="text-xs text-slate-500">(implicit abuse)</span>
              </div>
              <div className="space-y-2 text-sm">
                <div>
                  <p className="font-medium text-slate-900">What it covers:</p>
                  <ul className="list-disc list-inside text-slate-600 ml-2">
                    <li>Implicit references ("the word you don't repeat", "the insult hit harder than the punch") where the slur is not quoted</li>
                  </ul>
                </div>
                <div>
                  <p className="font-medium text-slate-900">System behavior:</p>
                  <ul className="list-disc list-inside text-slate-600 ml-2">
                    <li>Preserve and do not attempt to fill in or guess the missing term</li>
                    <li>May note emotional impact but no rewrite or censorship is applied</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Hard Prohibitions */}
        <Card className="mb-6 border-2 border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertCircle className="w-5 h-5" />
              3. Hard prohibitions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-800 mb-3">Base44 and RevisionGrade must not:</p>
            <ul className="list-disc list-inside text-sm text-red-900 space-y-2">
              <li>Generate or propose new slurs, variants, or more "colorful" bigotry</li>
              <li>Auto-rewrite a slur into a different slur, or into a euphemism that keeps the same hateful proposition</li>
              <li>Suggest slurs (even reclaimed ones) to out-group speakers or neutral narrators</li>
            </ul>
            <div className="mt-4 pt-4 border-t border-red-200">
              <p className="text-sm text-red-800">
                <strong>When in doubt, the system prefers:</strong>
              </p>
              <p className="text-sm text-red-900 mt-2">
                <span className="font-semibold">Flag + preserve</span> (for narrative authenticity, reclamation, or historical context)
              </p>
              <p className="text-sm text-red-700 mt-1">
                Over <span className="font-semibold">modify or normalize</span> (which risks erasing authorial intent or laundering hate speech).
              </p>
            </div>
          </CardContent>
        </Card>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              Frequently Asked Questions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Q1. Will Base44 remove slurs from my manuscript?</h3>
              <p className="text-sm text-slate-600">
                <strong>No.</strong> Base44 does not silently remove or normalize slurs. It flags them, classifies their role 
                (hostile, reclaimed, historical, implicit), and tells you where there may be market, legal, or reputational risk. 
                You decide whether to revise.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Q2. Can Base44 suggest "safer" alternatives?</h3>
              <p className="text-sm text-slate-600">
                <strong>Only at the concept level.</strong> For high-risk content it may suggest reframing (e.g., shifting from 
                explicit epithet to implied harm, or using narrative distance) but it will not propose another slur or an equivalent insult.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Q3. How does it distinguish reclaimed from hostile use?</h3>
              <p className="text-sm text-slate-600 mb-2">The system combines:</p>
              <ul className="list-disc list-inside text-sm text-slate-600 ml-4 space-y-1">
                <li>Speaker identity and stance (in-group vs out-group)</li>
                <li>Narrative framing (celebratory, neutral, condemning, or hateful)</li>
                <li>Lexicon metadata marking which terms are commonly reclaimed</li>
              </ul>
              <p className="text-sm text-slate-600 mt-2">
                If the same word appears in both reclaimed and hostile contexts, different examples in TS-GOLD-V1-SLUR 
                teach Base44 to treat them differently.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Q4. What about scenes with bigoted characters?</h3>
              <p className="text-sm text-slate-600 mb-2">
                <strong>Those are allowed and expected.</strong> Base44's job is to:
              </p>
              <ul className="list-disc list-inside text-sm text-slate-600 ml-4 space-y-1">
                <li>Mark explicit bigotry as MARKET_RISK rather than "style"</li>
                <li>Confirm when the narrative condemns that bigotry (e.g., recoil, consequences, framing), 
                    so you can argue editorial intent if challenged</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Q5. Does this restrict what I'm allowed to write?</h3>
              <p className="text-sm text-slate-600">
                <strong>No.</strong> It does not block your manuscript. It surfaces where and how slur-adjacent language appears, 
                and what different stakeholders (retailers, platforms, sensitivity readers) may see as risk. You remain in control 
                of every creative decision.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-slate-900 mb-2">Q6. How does this relate to inclusive language guidance?</h3>
              <p className="text-sm text-slate-600">
                Inclusive-language guides recommend avoiding slurs, dehumanizing labels, and many ableist or sexist terms, 
                particularly in authorial/narrative voice. Base44 encodes these norms as alerts and suggestions, not mandatory rewrites.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer Note */}
        <div className="mt-8 p-4 rounded-lg bg-indigo-50 border border-indigo-200">
          <p className="text-sm text-indigo-900">
            <strong>Note:</strong> This policy applies to Base44's detection and classification system. 
            Final publication decisions remain with authors, editors, and publishers.
          </p>
        </div>
      </div>
    </div>
  );
}