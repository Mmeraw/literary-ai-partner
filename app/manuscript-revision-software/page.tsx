import SeoProofPage from "../../components/marketing/SeoProofPage";

export const metadata = {
  title: "Manuscript Revision Software | RevisionGrade",
  description:
    "Manuscript revision software for author-controlled repair: evidence-backed diagnosis, Revise Queue workflow, voice protection, and professional submission preparation.",
};

export default function ManuscriptRevisionSoftwarePage() {
  return (
    <SeoProofPage
      eyebrow="Manuscript revision software"
      title="Manuscript revision software that keeps the author in control."
      subtitle="RevisionGrade turns evaluation findings into governed revision opportunities so writers can repair manuscripts with evidence instead of accepting blind AI rewrites."
      urlPath="/manuscript-revision-software"
      primaryCta={{ label: "See Revise", href: "/revise" }}
      secondaryCta={{ label: "Begin Evaluation", href: "/evaluate" }}
      blocks={[
        {
          title: "Repair starts with diagnosis",
          copy: "The strongest revision workflow begins by identifying the manuscript problem, its evidence, its reader effect, and its priority.",
          bullets: ["problem", "evidence", "reader effect", "revision priority"],
        },
        {
          title: "Author-controlled workflow",
          copy: "The Revise Queue is designed for accept, reject, keep original, customize, or defer decisions rather than automatic uncontrolled rewriting.",
          bullets: ["manual review", "custom revision", "rollback-safe thinking", "author sovereignty"],
        },
        {
          title: "Voice protection",
          copy: "Some text should be repaired. Some text should be preserved. The system should not flatten distinctive authorial signal just to make prose generic.",
          bullets: ["voice-preserving recommendations", "scope discipline", "overcorrection protection", "evidence before change"],
        },
      ]}
      faqs={[
        {
          q: "How is this different from an AI rewriter?",
          a: "An AI rewriter changes text from a prompt. RevisionGrade starts with manuscript diagnosis, then offers governed revision opportunities that the author controls.",
        },
        {
          q: "Can writers still reject suggested revisions?",
          a: "Yes. Author control is central: the writer can accept, reject, keep the original, customize, or defer revision opportunities.",
        },
      ]}
    />
  );
}
