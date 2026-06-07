'use client';

/**
 * Canon Governance Summary — renders Gate 15, Golden Spine, and Dialogue Canon
 * audit results in the evaluation report.
 *
 * Renders only when at least one artifact is present. Degrades gracefully —
 * each section is independent and renders only if its artifact exists.
 */

import type { Gate15AuditArtifact } from '@/lib/evaluation/gate15/gate15_orchestrator';
import type { GoldenSpineArtifact } from '@/lib/evaluation/goldenSpine/goldenSpineAudit';
import type { DialogueCanonAuditArtifact } from '@/lib/evaluation/dialogueCanon/dialogueCanonAudit';
import type { RevisionCanonMetadata } from '@/lib/evaluation/revisionCanonMetadata';

interface Props {
  gate15: Gate15AuditArtifact | null;
  goldenSpine: GoldenSpineArtifact | null;
  dialogueCanon: DialogueCanonAuditArtifact | null;
  revisionCanonMeta?: RevisionCanonMetadata | null;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PASS: 'bg-emerald-100 text-emerald-800',
    FAIL: 'bg-red-100 text-red-800',
    SKIPPED: 'bg-gray-100 text-gray-600',
    complete: 'bg-emerald-100 text-emerald-800',
    skipped: 'bg-gray-100 text-gray-600',
    pass: 'bg-emerald-100 text-emerald-800',
    warning: 'bg-amber-100 text-amber-800',
    fail: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function Gate15Section({ data }: { data: Gate15AuditArtifact }) {
  const { gate15_1, gate15_2 } = data;
  const isSkipped = data.overallStatus === 'SKIPPED';

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
        Gate 15 — Paired Gate Audit
        <StatusBadge status={data.overallStatus} />
      </h3>

      {data.skippedBecause && (
        <p className="text-sm text-gray-500 mb-3">Skipped: {data.skippedBecause}</p>
      )}
      {data.activatedBecause && (
        <p className="text-sm text-gray-500 mb-3">Activated: {data.activatedBecause}</p>
      )}

      {!isSkipped && (
        <div className="space-y-4">
          {/* Gate 15.1 — Mechanical Purity */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              Gate 15.1 — Structural Purity
              <StatusBadge status={gate15_1.overallStatus} />
            </h4>
            {gate15_1.layer1 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-1 pr-3 text-gray-600 font-medium">Check</th>
                      <th className="text-right py-1 pr-3 text-gray-600 font-medium">Count</th>
                      <th className="text-right py-1 pr-3 text-gray-600 font-medium">Normalized</th>
                      <th className="text-right py-1 pr-3 text-gray-600 font-medium">Threshold</th>
                      <th className="text-center py-1 text-gray-600 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-1 pr-3 text-gray-700">Q1 — Attribution Density</td>
                      <td className="py-1 pr-3 text-right text-gray-900">{gate15_1.layer1.attributionDensity.count}</td>
                      <td className="py-1 pr-3 text-right text-gray-900">{gate15_1.layer1.attributionDensity.normalized}/1000</td>
                      <td className="py-1 pr-3 text-right text-gray-500">≤{gate15_1.layer1.attributionDensity.threshold}/1000</td>
                      <td className="py-1 text-center"><StatusBadge status={gate15_1.layer1.attributionDensity.status} /></td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-1 pr-3 text-gray-700">Q2 — Soft-Tag Cap</td>
                      <td className="py-1 pr-3 text-right text-gray-900">{gate15_1.layer1.softTags.count}</td>
                      <td className="py-1 pr-3 text-right text-gray-900">{gate15_1.layer1.softTags.normalized}/ch</td>
                      <td className="py-1 pr-3 text-right text-gray-500">≤{gate15_1.layer1.softTags.threshold}/ch</td>
                      <td className="py-1 text-center"><StatusBadge status={gate15_1.layer1.softTags.status} /></td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-1 pr-3 text-gray-700">Q3 — Thought-Verb Tolerance</td>
                      <td className="py-1 pr-3 text-right text-gray-900">{gate15_1.layer1.thoughtVerbs.count}</td>
                      <td className="py-1 pr-3 text-right text-gray-900">{gate15_1.layer1.thoughtVerbs.normalized}/ch</td>
                      <td className="py-1 pr-3 text-right text-gray-500">≤{gate15_1.layer1.thoughtVerbs.threshold}/ch</td>
                      <td className="py-1 text-center"><StatusBadge status={gate15_1.layer1.thoughtVerbs.status} /></td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-1 pr-3 text-gray-700">Q4 — Physiological Filler Cap</td>
                      <td className="py-1 pr-3 text-right text-gray-900">{gate15_1.layer1.physiologicalFillers.count}</td>
                      <td className="py-1 pr-3 text-right text-gray-900">{gate15_1.layer1.physiologicalFillers.normalized}/ch</td>
                      <td className="py-1 pr-3 text-right text-gray-500">≤{gate15_1.layer1.physiologicalFillers.threshold}/ch</td>
                      <td className="py-1 text-center"><StatusBadge status={gate15_1.layer1.physiologicalFillers.status} /></td>
                    </tr>
                    <tr>
                      <td className="py-1 pr-3 text-gray-700">Q5 — Boundary Test</td>
                      <td className="py-1 pr-3 text-right text-gray-900">—</td>
                      <td className="py-1 pr-3 text-right text-gray-900">
                        {gate15_1.layer1.boundaryTest.unmatchedQuotes} quotes, {gate15_1.layer1.boundaryTest.unmatchedItalics} italics
                      </td>
                      <td className="py-1 pr-3 text-right text-gray-500">0 unmatched</td>
                      <td className="py-1 text-center"><StatusBadge status={gate15_1.layer1.boundaryTest.status} /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-2">
              {gate15_1.wordCount.toLocaleString()} words, {gate15_1.chapterEquivalents} chapter equivalents (4,000 words/ch)
            </p>
          </div>

          {/* Gate 15.2 — Overcorrection Firewall */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              Gate 15.2 — Voice &amp; Meaning Protection
              <StatusBadge status={gate15_2.overallStatus} />
            </h4>
            {gate15_2.skippedBecause ? (
              <p className="text-sm text-gray-500">Skipped: {gate15_2.skippedBecause}</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-emerald-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-emerald-700">{gate15_2.protectedSegments}</div>
                    <div className="text-xs text-emerald-600">Protected</div>
                  </div>
                  <div className="bg-amber-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-amber-700">{gate15_2.trimSegments}</div>
                    <div className="text-xs text-amber-600">Trim</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-red-700">{gate15_2.cutSegments}</div>
                    <div className="text-xs text-red-600">Cut</div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 text-center">
                    <div className="text-lg font-semibold text-gray-700">{gate15_2.totalCandidates}</div>
                    <div className="text-xs text-gray-600">Total</div>
                  </div>
                </div>
                <p className="text-sm text-gray-600">
                  Overcorrection risk: <span className={`font-medium ${
                    gate15_2.overcorrectionRiskLevel === 'high' ? 'text-red-700' :
                    gate15_2.overcorrectionRiskLevel === 'moderate' ? 'text-amber-700' : 'text-emerald-700'
                  }`}>{gate15_2.overcorrectionRiskLevel}</span>
                </p>
                {gate15_2.detectionAreas.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-1 pr-3 text-gray-600 font-medium">Detection Area</th>
                          <th className="text-right py-1 pr-3 text-gray-600 font-medium">Candidates</th>
                          <th className="text-right py-1 pr-3 text-gray-600 font-medium">Protected</th>
                          <th className="text-right py-1 pr-3 text-gray-600 font-medium">Trim</th>
                          <th className="text-right py-1 text-gray-600 font-medium">Cut</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gate15_2.detectionAreas.map((area) => (
                          <tr key={area.area} className="border-b border-gray-100">
                            <td className="py-1 pr-3 text-gray-700">{area.area.replace(/_/g, ' ')}</td>
                            <td className="py-1 pr-3 text-right text-gray-900">{area.candidateCount}</td>
                            <td className="py-1 pr-3 text-right text-emerald-700">{area.protectedCount}</td>
                            <td className="py-1 pr-3 text-right text-amber-700">{area.trimCount}</td>
                            <td className="py-1 text-right text-red-700">{area.cutCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary findings */}
      {data.summaryFindings.length > 0 && (
        <div className="mt-3 bg-gray-50 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Findings</h4>
          <ul className="list-none pl-0 text-sm text-gray-700 space-y-0.5">
            {data.summaryFindings.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GoldenSpineSection({ data }: { data: GoldenSpineArtifact }) {
  if (data.overallStatus === 'skipped') {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          Golden Spine — Motif Ledger
          <StatusBadge status="skipped" />
        </h3>
        <p className="text-sm text-gray-500">{data.skippedBecause}</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
        Golden Spine — Motif Ledger
        <StatusBadge status="complete" />
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          data.continuityScore === 'strong' ? 'bg-emerald-100 text-emerald-800' :
          data.continuityScore === 'moderate' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
        }`}>
          {data.continuityScore} continuity
        </span>
      </h3>

      {/* Narrative spines */}
      {data.spines.length > 0 && (
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Narrative Spines</h4>
          <div className="flex flex-wrap gap-2">
            {data.spines.map((spine, i) => (
              <span key={i} className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                spine.type === 'primary' ? 'bg-indigo-100 text-indigo-800' : 'bg-gray-100 text-gray-700'
              }`}>
                {spine.label} {spine.evidence[0] && `(${spine.evidence[0]})`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Motif ledger table */}
      {data.motifLedger.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-1 pr-3 text-gray-600 font-medium">Motif</th>
                <th className="text-left py-1 pr-3 text-gray-600 font-medium">Type</th>
                <th className="text-right py-1 pr-3 text-gray-600 font-medium">Count</th>
                <th className="text-left py-1 pr-3 text-gray-600 font-medium">First</th>
                <th className="text-left py-1 pr-3 text-gray-600 font-medium">Last</th>
                <th className="text-center py-1 pr-3 text-gray-600 font-medium">Payoff</th>
                <th className="text-center py-1 text-gray-600 font-medium">Revision</th>
              </tr>
            </thead>
            <tbody>
              {data.motifLedger.slice(0, 15).map((motif, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-1 pr-3 text-gray-900 font-medium">{motif.motif}</td>
                  <td className="py-1 pr-3 text-gray-600">{motif.category}</td>
                  <td className="py-1 pr-3 text-right text-gray-900">{motif.occurrences}</td>
                  <td className="py-1 pr-3 text-gray-600 text-xs">{motif.firstAppearance}</td>
                  <td className="py-1 pr-3 text-gray-600 text-xs">{motif.lastAppearance}</td>
                  <td className="py-1 pr-3 text-center">
                    <StatusBadge status={motif.payoffStatus === 'paid' ? 'pass' : motif.payoffStatus === 'overused' ? 'warning' : motif.payoffStatus === 'partial' ? 'warning' : 'fail'} />
                  </td>
                  <td className="py-1 text-center text-xs text-gray-600">{motif.revisionNeed}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.motifLedger.length > 15 && (
            <p className="text-xs text-gray-500 mt-1">Showing 15 of {data.motifLedger.length} motifs</p>
          )}
        </div>
      )}

      {data.summaryFindings.length > 0 && (
        <div className="mt-3 bg-gray-50 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Findings</h4>
          <ul className="list-none pl-0 text-sm text-gray-700 space-y-0.5">
            {data.summaryFindings.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DialogueCanonSection({ data }: { data: DialogueCanonAuditArtifact }) {
  if (data.overallStatus === 'skipped') {
    return (
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
          Dialogue Canon Audit
          <StatusBadge status="skipped" />
        </h3>
        <p className="text-sm text-gray-500">{data.skippedBecause}</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
        Dialogue Canon Audit
        <StatusBadge status={data.dialogueStatus} />
      </h3>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-gray-900">{data.metrics.totalDialogueLines}</div>
          <div className="text-xs text-gray-600">Dialogue Lines</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-gray-900">{data.metrics.uniqueSpeakers}</div>
          <div className="text-xs text-gray-600">Unique Speakers</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-gray-900">{data.metrics.avgWordsPerDialogueLine}</div>
          <div className="text-xs text-gray-600">Avg Words/Line</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-emerald-700">{data.metrics.attributedLines}</div>
          <div className="text-xs text-gray-600">Attributed</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-amber-700">{data.metrics.unattributedLines}</div>
          <div className="text-xs text-gray-600">Unattributed</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <div className="text-lg font-semibold text-gray-900">{(data.metrics.expositionLeakageRate * 100).toFixed(1)}%</div>
          <div className="text-xs text-gray-600">Exposition Leakage</div>
        </div>
      </div>

      {/* Exposition leakage instances */}
      {data.expositionLeakage.length > 0 && (
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Exposition Leakage ({data.expositionLeakage.length})</h4>
          <ul className="list-none pl-0 text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
            {data.expositionLeakage.slice(0, 5).map((inst, i) => (
              <li key={i} className="bg-red-50 rounded p-1.5">
                &ldquo;{inst.text}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Protected speech */}
      {data.protectedSpeech.length > 0 && (
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-gray-700 mb-1">Protected Speech Segments ({data.protectedSpeech.length})</h4>
          <ul className="list-none pl-0 text-xs text-gray-600 space-y-1 max-h-32 overflow-y-auto">
            {data.protectedSpeech.slice(0, 5).map((seg, i) => (
              <li key={i} className="bg-emerald-50 rounded p-1.5">
                <span className="font-medium text-emerald-700">[{seg.protectionReason}]</span> &ldquo;{seg.text}&rdquo;
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.summaryFindings.length > 0 && (
        <div className="mt-3 bg-gray-50 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Findings</h4>
          <ul className="list-none pl-0 text-sm text-gray-700 space-y-0.5">
            {data.summaryFindings.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function RevisionCanonMetadataSection({ data }: { data: RevisionCanonMetadata }) {
  if (data.overallStatus === 'skipped') {
    return (
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-800 mb-1">Revision Canon Metadata</h3>
        <p className="text-xs text-gray-500">Skipped: {data.skippedBecause}</p>
      </div>
    );
  }

  const categories = data.attributions.reduce<Record<string, number>>((acc, a) => {
    acc[a.canonRiskCategory] = (acc[a.canonRiskCategory] || 0) + 1;
    return acc;
  }, {});

  const gate15Count = data.attributions.filter(a => a.gate15Related).length;
  const spineCount = data.attributions.filter(a => a.goldenSpineRelated).length;
  const dialogueCount = data.attributions.filter(a => a.dialogueCanonRelated).length;

  return (
    <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
      <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
        Revision Canon Metadata
        <StatusBadge status={data.overallStatus} />
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-lg font-bold text-gray-900">{data.attributions.length}</div>
          <div className="text-xs text-gray-500">Criteria Enriched</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-lg font-bold text-indigo-600">{gate15Count}</div>
          <div className="text-xs text-gray-500">Gate 15 Linked</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-lg font-bold text-purple-600">{spineCount}</div>
          <div className="text-xs text-gray-500">Spine Linked</div>
        </div>
        <div className="text-center p-2 bg-gray-50 rounded">
          <div className="text-lg font-bold text-amber-600">{dialogueCount}</div>
          <div className="text-xs text-gray-500">Dialogue Linked</div>
        </div>
      </div>

      {Object.keys(categories).length > 0 && (
        <div className="mb-3">
          <h4 className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Risk Categories</h4>
          <div className="flex flex-wrap gap-1">
            {Object.entries(categories).map(([cat, count]) => (
              <span key={cat} className="px-2 py-0.5 text-xs bg-indigo-50 text-indigo-700 rounded">
                {cat.replace(/_/g, ' ')} ({count})
              </span>
            ))}
          </div>
        </div>
      )}

      {data.summaryFindings.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">Findings</h4>
          <ul className="list-none pl-0 text-sm text-gray-700 space-y-0.5">
            {data.summaryFindings.map((f, i) => (
              <li key={i}>• {f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function CanonGovernanceSummary({ gate15, goldenSpine, dialogueCanon, revisionCanonMeta }: Props) {
  return (
    <div>
      {gate15 && <Gate15Section data={gate15} />}
      {goldenSpine && <GoldenSpineSection data={goldenSpine} />}
      {dialogueCanon && <DialogueCanonSection data={dialogueCanon} />}
      {revisionCanonMeta && <RevisionCanonMetadataSection data={revisionCanonMeta} />}
    </div>
  );
}
