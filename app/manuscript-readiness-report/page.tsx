import SeoProofPage from "../../components/marketing/SeoProofPage";

export const metadata = {
  title: "Manuscript Readiness Report | RevisionGrade",
  description:
    "Manuscript readiness reports for writers who need evidence-backed diagnosis before revision, querying, or professional submission preparation.",
};

export default function ManuscriptReadinessReportPage() {
  return (
    <SeoProofPage
      eyebrow="Manuscript readiness report"
      title="Manuscript readiness reports before you query."
      subtitle="RevisionGrade readiness reports are designed to show where a manuscript stands, what evidence supports the diagnosis, and what revision priorities should come before submission."
      urlPath="/manuscript-readiness-report"
      primaryCta={{ label: "Begin Evaluation", href: "/evaluate" }}
      secondaryCta={{ label: "AI Manuscript Evaluation", href: "/ai-manuscript-evaluation" }}
      blocks={[
        {
          title: "Readiness is not a promise of publication",
          copy: "A readiness report diagnoses craft, structure, reader trust, and submission preparedness. It cannot guarantee representation, publication, sales, or market timing.",
          bullets: ["no publication guarantee", "craft diagnosis", "confidence-aware findings", "submission preparation"],
        },
        {
          title: "Scores need evidence",
          copy: "A useful report connects each score to supporting evidence and revision implications instead of giving the writer an unexplained number.",
          bullets: ["criteria score", "confidence", "evidence", "revision priority"],
        },
        {
          title: "Report to revision path",
          copy: "The report should help the writer decide what to repair, what to preserve, and what materials to prepare for the next professional gate.",
          bullets: ["Revise Queue", "Agent Readiness", "query letter", "synopsis"],
        },
      ]}
      faqs={[
        {
          q: "What is a manuscript readiness report?",
          a: "It is a structured evaluation that explains whether the manuscript appears ready for serious revision, agent-facing preparation, or further structural repair based on manuscript evidence.",
        },
        {
          q: "Can a readiness report guarantee success?",
          a: "No. It can reduce guesswork and clarify risks, but it cannot guarantee agent interest, publication, reviews, sales, or market timing.",
        },
      ]}
    />
  );
}
