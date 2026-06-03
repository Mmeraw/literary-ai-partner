import SeoProofPage from "../../components/marketing/SeoProofPage";

export const metadata = {
  title: "The Literary AI Partner | RevisionGrade",
  description:
    "RevisionGrade is The Literary AI Partner for manuscript diagnosis, author-controlled revision, and professional submission preparation.",
};

export default function LiteraryAiPartnerPage() {
  return (
    <SeoProofPage
      eyebrow="The Literary AI Partner"
      title="The Literary AI Partner™ for serious writers."
      subtitle="RevisionGrade is built for writers who need more than grammar correction or generic AI feedback. It diagnoses manuscript readiness, protects author voice, supports author-controlled revision, and prepares professional submission materials."
      urlPath="/literary-ai-partner"
      primaryCta={{ label: "Begin Evaluation", href: "/evaluate" }}
      secondaryCta={{ label: "Explore Resources", href: "/resources" }}
      blocks={[
        {
          title: "A partner, not a replacement",
          copy: "RevisionGrade uses AI as an instrument for manuscript diagnosis and revision support. The author remains the creative authority and final decision-maker.",
          bullets: ["human authorship", "author approval", "voice protection", "evidence-backed findings"],
        },
        {
          title: "Diagnosis before repair",
          copy: "The platform separates evaluation from revision so the wrong intervention does not flatten voice or polish around deeper structural problems.",
          bullets: ["story criteria", "evaluation modes", "readiness diagnosis", "revision priority"],
        },
        {
          title: "Submission preparation",
          copy: "After diagnosis and revision, RevisionGrade can support agent-facing materials such as query letters, synopses, comparables, positioning, and author bios.",
          bullets: ["query letter", "synopsis", "comparables", "author bio"],
        },
      ]}
      faqs={[
        {
          q: "Why call RevisionGrade The Literary AI Partner?",
          a: "Because RevisionGrade is not merely an AI editor. It supports manuscript evaluation, diagnosis, revision governance, voice protection, and professional submission preparation.",
        },
        {
          q: "Does The Literary AI Partner replace the writer?",
          a: "No. RevisionGrade is designed around author control. It surfaces evidence and options; the author decides what to accept, reject, revise, or preserve.",
        },
      ]}
    />
  );
}
