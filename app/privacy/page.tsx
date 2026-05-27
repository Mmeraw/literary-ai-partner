const sections = [
  {
    title: "1. Our privacy promise",
    body: [
      "RevisionGrade is built for writers. Manuscripts, notes, evaluation reports, revision decisions, and readiness materials are treated as confidential creative work.",
      "We do not sell manuscript content, account data, evaluation outputs, or revision materials. We use information to operate the service, protect the platform, process payments, provide support, and improve reliability.",
    ],
  },
  {
    title: "2. Information we collect",
    body: [
      "Account information such as name, email address, login identifiers, authentication metadata, account settings, and communications with us.",
      "Project information such as uploaded manuscripts, excerpts, titles, notes, evaluation artifacts, reports, revision opportunities, Revise Queue decisions, TrustedPath selections, exports, and version history.",
      "Usage, device, and security information such as pages viewed, workflow events, timestamps, browser or device information, IP address, diagnostic logs, error reports, and abuse-prevention signals.",
      "Payment-related information such as payment status, plan, credits, transaction identifiers, billing metadata, and limited payment details supplied by our payment processor. We do not intentionally store full card numbers.",
    ],
  },
  {
    title: "3. How we use information",
    body: [
      "To provide manuscript evaluation, readiness analysis, revision planning, Revise Queue workflows, TrustedPath workflows, exports, dashboards, account access, and customer support.",
      "To generate and store evaluation reports, revision opportunities, decision ledgers, progress analytics, and manuscript version history for your account.",
      "To maintain security, prevent abuse, debug failures, monitor system health, preserve audit logs, enforce terms, and comply with legal, tax, accounting, fraud-prevention, and dispute-resolution obligations.",
    ],
  },
  {
    title: "4. AI processing and manuscript confidentiality",
    body: [
      "RevisionGrade uses AI and deterministic software systems to read, evaluate, summarize, and generate revision-related outputs from manuscripts and author-supplied materials.",
      "Manuscript content may be processed by service providers that help us operate evaluation, hosting, storage, analytics, security, logging, payment, email, and support systems. They are authorized to process information only for service-related purposes.",
      "You keep ownership of your manuscript. RevisionGrade does not claim copyright ownership in uploaded manuscripts. Outputs are diagnostic and editorial-assistance materials, and the author remains responsible for creative decisions.",
      "We do not use manuscript content for public marketing examples or share it with agents, publishers, producers, or industry users unless you choose a creator-controlled workflow that permits that sharing.",
    ],
  },
  {
    title: "5. Sharing, retention, and deletion",
    body: [
      "We may share information with vendors that provide infrastructure, hosting, database, analytics, authentication, payment, email, security, logging, and AI-processing support. We may also disclose information when required by law, safety needs, fraud prevention, rights enforcement, or a business transfer.",
      "We keep account data, manuscripts, reports, ledgers, exports, logs, and related records for as long as needed to provide the service, maintain version history, resolve disputes, preserve security, and satisfy legal obligations.",
      "You may request deletion of account data or manuscript materials. Some records may be retained when necessary for security, fraud prevention, legal compliance, tax or accounting obligations, backups, or dispute resolution.",
    ],
  },
  {
    title: "6. Security and user rights",
    body: [
      "We use administrative, technical, and organizational safeguards designed to protect personal information and manuscript materials against unauthorized access, loss, misuse, alteration, or disclosure. No online service can guarantee absolute security.",
      "Depending on where you live, you may have rights to request access, correction, deletion, portability, restriction, objection, withdrawal of consent, or information about how your data is used and disclosed. We may need to verify your identity before fulfilling a request.",
      "RevisionGrade may use cookies, local storage, analytics tools, and similar technologies to keep you signed in, remember preferences, measure traffic, debug errors, improve performance, and protect the service.",
    ],
  },
  {
    title: "7. Children, international users, and updates",
    body: [
      "RevisionGrade is intended for adults and is not directed to children under 13. If you believe a child provided information to us, contact us so we can review and delete it where appropriate.",
      "RevisionGrade may process and store information in the United States and other countries where our service providers operate. Those locations may have data-protection laws different from those in your jurisdiction.",
      "We may update this Privacy Policy as RevisionGrade evolves. The updated version will be posted on this page with a new effective date. Material changes may be communicated through the service or by other reasonable means.",
    ],
  },
  {
    title: "8. Contact",
    body: [
      "For privacy requests or questions, contact RevisionGrade through the support or contact channel listed on the website. Please include enough information for us to identify your account and process your request.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="bg-rg-ink text-rg-cream">
      <section className="mx-auto max-w-4xl px-6 py-20">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">Privacy</p>
        <h1 className="mt-6 font-rg-serif text-5xl leading-tight md:text-6xl">Privacy Policy</h1>
        <p className="mt-6 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-cream2/55">Effective date: May 26, 2026</p>
        <div className="mt-10 space-y-6 text-lg leading-8 text-rg-cream2/80">
          <p>
            This Privacy Policy explains how RevisionGrade collects, uses, stores, shares, and protects information when you use our website, manuscript evaluation tools, revision workflows, dashboards, reports, exports, and related services.
          </p>
          <p>
            We treat manuscripts and author materials as confidential creative work. This policy explains what information we collect, why we use it, how long we keep it, and the choices available to you.
          </p>
        </div>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.title} className="border-t border-rg-cream2/10 pt-8">
              <h2 className="font-rg-serif text-3xl leading-tight text-rg-cream">{section.title}</h2>
              <div className="mt-5 space-y-4 text-base leading-7 text-rg-cream2/78">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  );
}
