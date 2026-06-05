import SeoProofPage from "../../components/marketing/SeoProofPage";

export const metadata = {
  title: "Novel Revision Tool | RevisionGrade",
  description:
    "A novel revision tool built around diagnosis first, evidence-backed repair, author-controlled decisions, and professional submission preparation.",
};

export default function NovelRevisionToolPage() {
  return (
    <SeoProofPage
      eyebrow="Novel revision tool"
      title="A novel revision tool built around diagnosis first."
      subtitle="RevisionGrade helps writers understand what the manuscript needs before they revise. It is designed for structural clarity, story criteria, revision priorities, and author-controlled repair."
      urlPath="/novel-revision-tool"
      primaryCta={{ label: "See Revise", href: "/revise" }}
      secondaryCta={{ label: "AI Novel Critique", href: "/ai-novel-critique" }}
      blocks={[
        {
          title: "Find the real problem",
          copy: "Novel revision fails when writers polish around structural issues. RevisionGrade separates story diagnosis from surface improvement.",
          bullets: ["scene construction", "pacing", "character arc", "voice and POV"],
        },
        {
          title: "Work one opportunity at a time",
          copy: "A useful revision tool should turn findings into manageable decisions instead of overwhelming the writer with generic feedback.",
          bullets: ["revision cards", "severity", "rationale", "author decision"],
        },
        {
          title: "Prepare for the next gate",
          copy: "After repair, the manuscript can move toward agent-readiness materials such as query letters, synopses, comparables, and author bios.",
          bullets: ["query", "synopsis", "positioning", "submission package"],
        },
      ]}
      faqs={[
        {
          q: "Is this for full novels only?",
          a: "RevisionGrade can support short-form and long-form evaluation modes. Full novel-scale diagnosis requires enough manuscript text to support responsible long-form claims.",
        },
        {
          q: "Does the tool revise automatically?",
          a: "The intended workflow is author-controlled. TrustedPath can offer convenience for eligible repairs, but the system should preserve the original and maintain a change trail.",
        },
      ]}
    />
  );
}
