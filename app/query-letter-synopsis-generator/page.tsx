import SeoProofPage from "../../components/marketing/SeoProofPage";

export const metadata = {
  title: "Query Letter and Synopsis Generator | RevisionGrade",
  description:
    "Query letter and synopsis support for agent readiness: manuscript-specific pitch, synopsis, comparables, positioning, and author bio preparation.",
};

export default function QueryLetterSynopsisGeneratorPage() {
  return (
    <SeoProofPage
      eyebrow="Query letter and synopsis generator"
      title="Query letter and synopsis support after manuscript diagnosis."
      subtitle="RevisionGrade helps writers move from manuscript evaluation toward agent-ready materials: query letters, synopses, pitch paragraphs, comparables, positioning, and author bios."
      urlPath="/query-letter-synopsis-generator"
      primaryCta={{ label: "See Agent Readiness", href: "/agent-readiness" }}
      secondaryCta={{ label: "Begin Evaluation", href: "/evaluate" }}
      blocks={[
        {
          title: "Submission materials should follow diagnosis",
          copy: "A query letter and synopsis are stronger when the manuscript has already been evaluated for concept, structure, stakes, pacing, character, and closure.",
          bullets: ["query letter", "synopsis", "pitch paragraph", "author bio"],
        },
        {
          title: "Pitch is part of the query",
          copy: "For manuscript submissions, the pitch belongs inside the query letter as the hook paragraph. It should not become a redundant separate document unless a specific workflow requires it.",
          bullets: ["hook paragraph", "metadata", "market positioning", "professional format"],
        },
        {
          title: "Author approval before export",
          copy: "Agent-facing materials should be reviewed and approved by the author before export so the submission package remains accurate and intentional.",
          bullets: ["approve sections", "controlled export", "author credentials only", "submission package"],
        },
      ]}
      faqs={[
        {
          q: "Does a query letter need a synopsis?",
          a: "A professional submission package often includes both a query letter and a synopsis. The pitch itself belongs inside the query letter, while the synopsis is a separate story-summary document when requested or generated as part of Agent Readiness.",
        },
        {
          q: "Should the query be generated before evaluation?",
          a: "It can be drafted, but the strongest query and synopsis should reflect a diagnosed manuscript. Agent-facing materials should not disguise unresolved story problems.",
        },
      ]}
    />
  );
}
