import SeoProofPage from "../../components/marketing/SeoProofPage";

export const metadata = {
  title: "Founder Case Study: The Lost World of MythOAmphibia | RevisionGrade",
  description:
    "Evaluation-report-only founder case study for The Lost World of MythOAmphibia, a mythic eco-fantasy manuscript evaluated through RevisionGrade.",
};

export default function LostWorldOfMythoamphibiaCaseStudyPage() {
  return (
    <SeoProofPage
      eyebrow="Founder evaluation case study"
      title="Founder Evaluation Case Study: The Lost World of MythOAmphibia."
      subtitle="A report-only case-study page for showing how RevisionGrade diagnoses a real long-form mythic eco-fantasy manuscript without publishing the manuscript itself."
      urlPath="/founder-case-study-lost-world-of-mythoamphibia"
      primaryCta={{ label: "Back to AI Novel Critique", href: "/ai-novel-critique" }}
      secondaryCta={{ label: "Begin Evaluation", href: "/evaluate" }}
      notice="This case study is for the RevisionGrade evaluation report only. The Lost World of MythOAmphibia manuscript, full chapters, ending spoilers, and extended copyrighted text are not published on this page."
      pdfFilename="revisiongrade-founder-case-study-lost-world-of-mythoamphibia.pdf"
      blocks={[
        {
          title: "Manuscript context",
          copy: "The Lost World of MythOAmphibia is treated as a founder manuscript case study, not as a public manuscript upload. The page exists to show evaluation behavior after the report quality is ready.",
          bullets: ["mythic eco-fantasy", "long-form manuscript", "founder case study", "evaluation report only"],
        },
        {
          title: "What the public page should show",
          copy: "The final page should summarize evaluation mode, score snapshot, confidence, diagnosis, and revision priorities while withholding the manuscript itself.",
          bullets: ["13 criteria score snapshot", "executive diagnosis", "highest-priority revision risks", "downloadable PDF report"],
        },
        {
          title: "What remains private",
          copy: "The case study should not disclose the full manuscript, full chapters, rights strategy, private query strategy, or detailed ending spoilers.",
          bullets: ["no full novel", "no full chapters", "no extended excerpts", "no private submission strategy"],
        },
      ]}
      faqs={[
        {
          q: "Is The Lost World of MythOAmphibia manuscript published here?",
          a: "No. This page is designed to publish only the RevisionGrade evaluation report and a controlled summary. The manuscript itself is not publicly available on this page.",
        },
        {
          q: "Why include a founder manuscript?",
          a: "Founder case studies show the same evaluation framework being applied to real long-form manuscripts while keeping the creative work protected.",
        },
      ]}
    />
  );
}
