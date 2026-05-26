export default function TermsPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto max-w-4xl px-6 py-20">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Terms</p>
        <h1 className="mt-6 font-rg-serif text-5xl leading-tight md:text-6xl">Terms of service</h1>
        <div className="mt-10 space-y-8 text-lg leading-8 text-rg-cream2/80">
          <p>
            These terms are a public-facing working version for RevisionGrade™ and should be reviewed by counsel before public commercial launch.
          </p>

          <section className="rounded-2xl border border-rg-gold/30 bg-rg-ink2/70 p-6">
            <p className="font-rg-mono text-xs uppercase tracking-[0.2em] text-rg-gold">Payments, refunds, and digital services</p>
            <div className="mt-5 space-y-5">
              <p>
                RevisionGrade evaluations are custom digital services. Once a manuscript, excerpt, query package, or related writing material has been submitted for evaluation and processing has begun, the purchase is final.
              </p>
              <p>
                Each evaluation consumes computational, editorial, and system resources immediately. RevisionGrade does not provide refunds based on disagreement with the score, dissatisfaction with editorial findings, change of mind, market outcome, agent response, or a user’s decision not to use the report.
              </p>
              <p>
                Refunds may be considered only in limited cases, including duplicate charges, billing error, or a verified system failure where RevisionGrade is unable to deliver the purchased evaluation and no replacement credit or corrected report is provided.
              </p>
              <p>
                Subscription fees are not refundable once the billing period begins. Users may cancel future renewal at any time before the next billing date.
              </p>
              <p>
                Nothing in this policy limits any non-waivable consumer rights required by applicable law.
              </p>
            </div>
          </section>

          <section>
            <p className="font-rg-mono text-xs uppercase tracking-[0.2em] text-rg-gold">Required acknowledgement</p>
            <p className="mt-3">
              Before paid checkout or paid evaluation processing begins, users may be required to confirm that they understand RevisionGrade evaluations are custom digital services and that the purchase becomes final once processing begins.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}
