const sections = [
  {
    title: "1. Our privacy promise",
    body: [
      "RevisionGrade is built for writers. Manuscripts, notes, evaluation reports, revision decisions, readiness materials, and exports are treated as confidential creative work.",
      "We do not sell manuscript content, account data, evaluation outputs, or revision materials. We use information to operate the service, protect the platform, process payments, provide support, improve reliability, and comply with legal obligations.",
      "You keep ownership of your manuscript. RevisionGrade does not claim copyright ownership in uploaded manuscripts or author-supplied materials.",
    ],
  },
  {
    title: "2. Information we collect",
    body: [
      "Account information such as name, email address, login identifiers, authentication metadata, account settings, and communications with us.",
      "Project information such as uploaded manuscripts, excerpts, titles, notes, evaluation artifacts, reports, revision opportunities, Revise Queue decisions, TrustedPath selections, exports, version history, and author-approved submission materials.",
      "Usage, device, and security information such as pages viewed, workflow events, timestamps, browser or device information, IP address, diagnostic logs, error reports, and abuse-prevention signals.",
      "Payment-related information such as payment status, plan, credits, transaction identifiers, billing metadata, and limited payment details supplied by our payment processor. We do not intentionally store full card numbers.",
      "Support information such as messages, screenshots, files, and other information you choose to send when asking for help.",
    ],
  },
  {
    title: "3. How we use information",
    body: [
      "To provide manuscript evaluation, readiness analysis, revision planning, Revise Queue workflows, TrustedPath workflows, exports, dashboards, account access, and customer support.",
      "To generate and store evaluation reports, revision opportunities, decision ledgers, progress analytics, manuscript version history, and author-approved submission materials for your account.",
      "To maintain security, prevent abuse, debug failures, monitor system health, preserve audit logs, enforce terms, process transactions, and comply with legal, tax, accounting, fraud-prevention, and dispute-resolution obligations.",
      "To improve product quality, reliability, user experience, and evaluation consistency using safeguards designed to protect manuscript confidentiality.",
    ],
  },
  {
    title: "4. AI processing and manuscript confidentiality",
    body: [
      "RevisionGrade uses AI and deterministic software systems to read, evaluate, summarize, and generate revision-related outputs from manuscripts and author-supplied materials.",
      "Manuscript content may be processed by service providers that help us operate evaluation, hosting, storage, analytics, security, logging, payment, email, and support systems. They are authorized to process information only for service-related purposes.",
      "RevisionGrade does not intentionally use customer manuscripts to train public, general-purpose AI models. We also do not use manuscript content for public marketing examples unless you separately approve that use.",
      "Evaluation outputs are diagnostic and editorial-assistance materials. They are not legal, financial, publishing, agency, or guaranteed commercial advice, and the author remains responsible for creative and submission decisions.",
    ],
  },
  {
    title: "5. Sharing and creator-controlled access",
    body: [
      "We may share information with vendors that provide infrastructure, hosting, database, analytics, authentication, payment, email, security, logging, customer-support, and AI-processing services.",
      "We may disclose information when required by law, subpoena, court order, lawful government request, safety need, fraud investigation, rights enforcement, or a business transfer such as a merger, acquisition, financing, or sale of assets.",
      "We do not share manuscript content with agents, publishers, producers, or other industry users unless you choose a creator-controlled workflow that permits that sharing, such as Storygate Studio or another author-approved access path.",
    ],
  },
  {
    title: "6. Retention and deletion",
    body: [
      "We keep account data, manuscripts, reports, ledgers, exports, logs, and related records for as long as needed to provide the service, maintain version history, resolve disputes, preserve security, and satisfy legal obligations.",
      "You may request deletion of account data or manuscript materials. Some records may be retained when necessary for security, fraud prevention, legal compliance, tax or accounting obligations, backups, audit integrity, or dispute resolution.",
      "Backup copies and logs may take additional time to expire from routine systems, but they are not used for ordinary product access after deletion is completed.",
    ],
  },
  {
    title: "7. Security",
    body: [
      "We use administrative, technical, and organizational safeguards designed to protect personal information and manuscript materials against unauthorized access, loss, misuse, alteration, or disclosure.",
      "No online service can guarantee absolute security. You are responsible for maintaining strong account credentials, protecting your devices, and limiting access to your account.",
      "If we learn of a security incident affecting your information, we will evaluate it and provide notice when required by applicable law.",
    ],
  },
  {
    title: "8. Your choices and privacy rights",
    body: [
      "Depending on where you live, you may have rights to request access, correction, deletion, portability, restriction, objection, withdrawal of consent, or information about how your data is used and disclosed.",
      "You may also have the right to opt out of certain sales, sharing, targeted advertising, or profiling. RevisionGrade does not sell manuscript content or personal information, but we will honor applicable opt-out rights where required.",
      "We will not discriminate against you for exercising privacy rights. We may need to verify your identity before fulfilling a request.",
    ],
  },
  {
    title: "9. Cookies, analytics, and communications",
    body: [
      "RevisionGrade may use cookies, local storage, analytics tools, and similar technologies to keep you signed in, remember preferences, measure traffic, debug errors, improve performance, and protect the service.",
      "Your browser may offer controls to limit cookies or tracking. Blocking some technologies may affect product functionality.",
      "We may send transactional messages about your account, evaluations, purchases, security, policy changes, or support requests. Marketing messages, if offered, may include an unsubscribe option where required.",
    ],
  },
  {
    title: "10. Children, international users, and updates",
    body: [
      "RevisionGrade is intended for adults and is not directed to children under 13. If you believe a child provided information to us, contact us so we can review and delete it where appropriate.",
      "RevisionGrade may process and store information in Canada, the United States, Mexico, and other countries where we or our service providers operate. Those locations may have data-protection laws different from those in your jurisdiction.",
      "We may update this Privacy Policy as RevisionGrade evolves. The updated version will be posted on this page with a new effective date. Material changes may be communicated through the service or by other reasonable means.",
    ],
  },
  {
    title: "11. Contact",
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
