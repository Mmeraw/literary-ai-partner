import SeoProofPage from "../../components/marketing/SeoProofPage";

export const metadata = {
  title: "Sample AI Novel Critique: The Wonderful Wizard of Oz | RevisionGrade",
  description:
    "Public-domain sample AI novel critique page for The Wonderful Wizard of Oz, prepared for a RevisionGrade evaluation PDF.",
};

export default function WizardOfOzSamplePage() {
  return (
    <SeoProofPage
      eyebrow="Sample AI novel critique"
      title="Sample AI Novel Critique: The Wonderful Wizard of Oz."
      subtitle="A public-domain sample page prepared to host a full RevisionGrade evaluation report for L. Frank Baum's The Wonderful Wizard of Oz once the quality-gated PDF is ready."
      urlPath="/sample-ai-novel-critique-wizard-of-oz"
      primaryCta={{ label: "Back to AI Novel Critique", href: "/ai-novel-critique" }}
      secondaryCta={{ label: "See Methodology", href: "/methodology" }}
      notice="This sample page is designed for evaluation-report proof. It should summarize the report and link to the PDF, not reproduce the entire novel."
      pdfFilename="revisiongrade-sample-ai-novel-critique-wizard-of-oz.pdf"
      blocks={[
        {
          title: "Why this sample matters",
          copy: "The Wonderful Wizard of Oz is a useful public-domain test case for quest structure, wonder, episodic pacing, character function, world logic, and narrative closure.",
          bullets: ["public-domain novel", "fantasy and quest signal", "episodic structure", "world logic and payoff"],
        },
        {
          title: "What the final page should show",
          copy: "Once the PDF exists, this page should show the evaluation mode, criteria snapshot, executive diagnosis, and a few controlled report excerpts.",
          bullets: ["score snapshot", "confidence language", "evidence-backed findings", "revision priorities"],
        },
        {
          title: "What not to publish",
          copy: "Do not republish the entire novel here. The page is an evaluation proof asset, not a public text archive.",
          bullets: ["no full text", "no unnecessary chapter reproduction", "HTML summary plus PDF", "CTA back to Evaluate"],
        },
      ]}
      faqs={[
        {
          q: "Why use The Wonderful Wizard of Oz as a sample?",
          a: "It lets RevisionGrade show how the framework handles quest structure, fantasy promise, character function, episodic movement, and closure in a recognizable public-domain novel.",
        },
        {
          q: "Will the PDF include the full novel?",
          a: "No. The PDF should be the RevisionGrade evaluation report, not a reproduction of the novel text.",
        },
      ]}
    />
  );
}
