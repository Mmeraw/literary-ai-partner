'use client';

export default function AgentTrustHeader(props: {
  jobId: string;
  generatedAt: string;
  finalWorkTypeUsed: string;
  matrixVersion: string;
  criteriaPlan: {
    R?: unknown[];
    O?: unknown[];
    NA?: unknown[];
    C?: unknown[];
  };
}) {
  const r = props.criteriaPlan.R?.length ?? 0;
  const o = props.criteriaPlan.O?.length ?? 0;
  const na = props.criteriaPlan.NA?.length ?? 0;
  const c = props.criteriaPlan.C?.length ?? 0;

  return (
    <section className="bg-white rounded-lg shadow-sm p-6 mb-6" aria-label="Agent Trust Header">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Evaluation Transparency</h2>

      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-600">Work Type used</p>
          <p className="font-mono text-gray-900">{props.finalWorkTypeUsed}</p>
        </div>

        <div>
          <p className="text-gray-600">Matrix version</p>
          <p className="font-mono text-gray-900">{props.matrixVersion}</p>
        </div>

        <div>
          <p className="text-gray-600">Applicability summary</p>
          <p className="font-mono text-gray-900">
            R={r} · O={o} · NA={na} · C={c}
          </p>
        </div>

        <div>
          <p className="text-gray-600">Repro anchor</p>
          <p className="font-mono text-gray-900">
            jobId {props.jobId} · {props.generatedAt} · {props.matrixVersion}
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-700 mt-4">
        NA criteria were structurally excluded and were not evaluated.
      </p>
    </section>
  );
}
