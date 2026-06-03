import SeoProofPage from "../../components/marketing/SeoProofPage";

export const metadata = {
  title: "Developmental Editing AI | RevisionGrade",
  description:
    "Developmental editing AI for manuscript diagnosis, story structure, revision priorities, and author-controlled repair without blind rewriting.",
};

export default function DevelopmentalEditingAiPage() {
  return (
    <SeoProofPage
      eyebrow="Developmental editing AI"
      title="Developmental editing AI without blind rewriting."
      subtitle="RevisionGrade supports developmental-level manuscript diagnosis by identifying structural, narrative, and reader-trust issues before the author decides what to revise."
      urlPath="/developmental-editing-ai"
      primaryCta={{ label: "See Methodology", href: "/methodology" }}
      secondaryCta={{ label: "Begin Evaluation", href: "/evaluate" }}
      blocks={[
        {
          title: "Developmental, not cosmetic",
          copy: "Developmental editing concerns story architecture, stakes, pacing, scene function, character movement, and reader experience. RevisionGrade starts there before line polish.",
          bullets: ["story architecture", "scene function", "reader fatigue risk", "execution versus ambition"],
        },
        {
          title: "Evidence-backed findings",
          copy: "A useful developmental diagnosis needs manuscript evidence, not taste alone. RevisionGrade is designed to make the reasoning visible and actionable.",
          bullets: ["criteria", "evidence", "confidence", "priority"],
        },
        {
          title: "Author decision remains final",
          copy: "Developmental guidance should not erase artistic intent. The system surfaces risks and options while keeping the author responsible for final creative decisions.",
          bullets: ["author sovereignty", "voice protection", "custom revision", "keep-original path"],
        },
      ]}
      faqs={[
        {
          q: "Does RevisionGrade replace a developmental editor?",
          a: "No. It helps diagnose manuscript readiness and revision priorities. Human editors can still be valuable, but RevisionGrade helps writers avoid paying for the wrong kind of editorial intervention first.",
        },
        {
          q: "Why not just ask a chatbot for feedback?",
          a: "RevisionGrade is designed around a governed manuscript framework, evidence, criteria, and author-controlled revision rather than one-off prompt feedback.",
        },
      ]}
    />
  );
}
