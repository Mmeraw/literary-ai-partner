import Link from "next/link";

type Cta = {
  label: string;
  href: string;
};

type ContentBlock = {
  title: string;
  copy: string;
  bullets?: string[];
};

type ResourceLink = {
  title: string;
  href: string;
  copy: string;
  status?: string;
};

type Faq = {
  q: string;
  a: string;
};

type SeoProofPageProps = {
  eyebrow: string;
  title: string;
  subtitle: string;
  urlPath: string;
  primaryCta?: Cta;
  secondaryCta?: Cta;
  notice?: string;
  blocks: ContentBlock[];
  proofLinks?: ResourceLink[];
  caseStudyLinks?: ResourceLink[];
  pdfFilename?: string;
  pdfStatus?: string;
  faqs?: Faq[];
};

const siteUrl = "https://www.revisiongrade.com";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">{children}</p>;
}

function ActionLink({ cta, variant }: { cta: Cta; variant: "primary" | "secondary" }) {
  const className =
    variant === "primary"
      ? "border border-rg-gold bg-rg-gold px-5 py-3 text-rg-ink transition hover:bg-transparent hover:text-rg-gold"
      : "border border-rg-cream2/30 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold";

  return (
    <Link href={cta.href} className={className}>
      {cta.label}
    </Link>
  );
}

function LinkCard({ item }: { item: ResourceLink }) {
  return (
    <Link href={item.href} className="block border border-rg-cream2/12 bg-rg-ink2/70 p-6 transition hover:border-rg-gold/70">
      {item.status ? <p className="font-rg-mono text-[0.65rem] uppercase tracking-[0.18em] text-rg-gold">{item.status}</p> : null}
      <h3 className="font-rg-serif text-2xl text-rg-cream">{item.title}</h3>
      <p className="mt-4 leading-7 text-rg-cream2/75">{item.copy}</p>
      <p className="mt-5 font-rg-mono text-xs uppercase tracking-[0.18em] text-rg-gold">Open page →</p>
    </Link>
  );
}

export default function SeoProofPage({
  eyebrow,
  title,
  subtitle,
  urlPath,
  primaryCta,
  secondaryCta,
  notice,
  blocks,
  proofLinks = [],
  caseStudyLinks = [],
  pdfFilename,
  pdfStatus = "PDF coming soon. Add the quality-gated report to /public/samples when ready.",
  faqs = [],
}: SeoProofPageProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description: subtitle,
    url: `${siteUrl}${urlPath}`,
    isPartOf: {
      "@type": "WebSite",
      name: "RevisionGrade",
      url: siteUrl,
    },
    about: {
      "@type": "SoftwareApplication",
      name: "RevisionGrade",
      applicationCategory: "WritingApplication",
      description:
        "RevisionGrade is The Literary AI Partner for manuscript diagnosis, author-controlled revision, and professional submission preparation.",
    },
  };

  return (
    <div className="bg-rg-ink text-rg-cream">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <section className="mx-auto max-w-7xl px-6 py-20">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-6 max-w-5xl font-rg-serif text-5xl leading-tight md:text-6xl">{title}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-rg-cream2/80">{subtitle}</p>
        <p className="mt-5 max-w-3xl text-base leading-7 text-rg-cream2/70">
          RevisionGrade<span aria-hidden="true">™</span> is The Literary AI Partner<span aria-hidden="true">™</span>: manuscript diagnosis, author-controlled revision, and professional submission preparation for serious writers.
        </p>

        {(primaryCta || secondaryCta) && (
          <div className="mt-10 flex flex-wrap gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
            {primaryCta ? <ActionLink cta={primaryCta} variant="primary" /> : null}
            {secondaryCta ? <ActionLink cta={secondaryCta} variant="secondary" /> : null}
          </div>
        )}

        {notice ? <div className="mt-10 border border-rg-gold/35 bg-rg-ink2/70 p-5 leading-7 text-rg-cream2/85">{notice}</div> : null}
      </section>

      <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <Eyebrow>What this page covers</Eyebrow>
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {blocks.map((block) => (
              <article key={block.title} className="border border-rg-cream2/12 bg-rg-ink/70 p-6">
                <h2 className="font-rg-serif text-2xl text-rg-cream">{block.title}</h2>
                <p className="mt-4 leading-7 text-rg-cream2/75">{block.copy}</p>
                {block.bullets && block.bullets.length > 0 ? (
                  <ul className="mt-5 space-y-3 text-sm leading-6 text-rg-cream2/80">
                    {block.bullets.map((bullet) => (
                      <li key={bullet} className="border-l border-rg-gold/50 pl-4">{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      {(proofLinks.length > 0 || caseStudyLinks.length > 0) && (
        <section className="mx-auto max-w-7xl px-6 py-20">
          <Eyebrow>Proof assets</Eyebrow>
          <h2 className="mt-4 max-w-4xl font-rg-serif text-4xl leading-tight md:text-5xl">Sample reports and founder evaluation case studies.</h2>
          <p className="mt-5 max-w-3xl leading-8 text-rg-cream2/75">
            These pages are designed to show evaluation outputs without publishing full manuscripts. When PDFs are uploaded, each HTML page should summarize the diagnosis and link to the quality-gated PDF report.
          </p>

          {proofLinks.length > 0 ? (
            <div className="mt-10">
              <h3 className="font-rg-serif text-3xl text-rg-cream">Public-domain sample evaluations</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {proofLinks.map((item) => <LinkCard key={item.href} item={item} />)}
              </div>
            </div>
          ) : null}

          {caseStudyLinks.length > 0 ? (
            <div className="mt-12">
              <h3 className="font-rg-serif text-3xl text-rg-cream">Founder evaluation case studies</h3>
              <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {caseStudyLinks.map((item) => <LinkCard key={item.href} item={item} />)}
              </div>
            </div>
          ) : null}
        </section>
      )}

      {pdfFilename ? (
        <section className="border-y border-rg-cream2/10 bg-rg-ink2/50">
          <div className="mx-auto max-w-5xl px-6 py-16">
            <Eyebrow>Evaluation PDF</Eyebrow>
            <h2 className="mt-4 font-rg-serif text-4xl leading-tight">Report download status</h2>
            <p className="mt-5 leading-8 text-rg-cream2/75">{pdfStatus}</p>
            <div className="mt-6 border border-rg-cream2/12 bg-rg-ink/70 p-5 font-rg-mono text-sm text-rg-cream2/85">
              Expected file: <span className="text-rg-gold">/samples/{pdfFilename}</span>
            </div>
            <p className="mt-5 leading-8 text-rg-cream2/70">
              This page publishes the evaluation report only. It does not publish the manuscript, full chapters, or extended copyrighted text.
            </p>
          </div>
        </section>
      ) : null}

      {faqs.length > 0 ? (
        <section className="mx-auto max-w-7xl px-6 py-20">
          <Eyebrow>FAQ</Eyebrow>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {faqs.map((item) => (
              <article key={item.q} className="border border-rg-cream2/12 bg-rg-ink2/60 p-6">
                <h2 className="font-rg-serif text-2xl text-rg-cream">{item.q}</h2>
                <p className="mt-4 leading-7 text-rg-cream2/75">{item.a}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <Eyebrow>Start with diagnosis</Eyebrow>
        <h2 className="mt-5 font-rg-serif text-4xl leading-tight md:text-5xl">Before you revise or submit, know where the manuscript stands.</h2>
        <p className="mx-auto mt-5 max-w-2xl leading-8 text-rg-cream2/75">
          RevisionGrade turns manuscript evidence into diagnosis, revision priorities, and submission preparation without surrendering author control.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4 font-rg-mono text-xs uppercase tracking-[0.18em]">
          <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Begin Evaluation</Link>
          <Link href="/resources" className="border border-rg-cream2/30 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">Explore Resources</Link>
        </div>
      </section>
    </div>
  );
}
