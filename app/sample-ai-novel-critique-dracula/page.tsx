import SeoProofPage from "../../components/marketing/SeoProofPage";

export const metadata = {
  title: "Sample AI Novel Critique: Dracula | RevisionGrade",
  description:
    "Public-domain sample AI novel critique page for Dracula, prepared for a RevisionGrade evaluation PDF.",
};

export default function DraculaSamplePage() {
  return (
    <SeoProofPage
      eyebrow="Sample AI novel critique"
      title="Sample AI Novel Critique: Dracula."
      subtitle="A public-domain sample page prepared to host a full RevisionGrade evaluation report for Bram Stoker's Dracula once the quality-gated PDF is ready."
      urlPath="/sample-ai-novel-critique-dracula"
      primaryCta={{ label: "Back to AI Novel Critique", href: "/ai-novel-critique" }}
      secondaryCta={{ label: "See Methodology", href: "/methodology" }}
      notice="This sample page is designed for evaluation-report proof. It should summarize the report and link to the PDF, not reproduce the entire novel."
      pdfFilename="revisiongrade-sample-ai-novel-critique-dracula.pdf"
      blocks={[
        {
          title: "Why this sample matters",
          copy: "Dracula is a useful public-domain test case for atmosphere, epistolary structure, threat escalation, ensemble control, pacing, and Gothic promise-keeping.",
          bullets: ["public-domain novel", "Gothic horror signal", "multi-document structure", "threat escalation and closure"],
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
          q: "Why use Dracula as a sample?",
          a: "It lets RevisionGrade show how the framework handles atmosphere, structure, pacing, villain pressure, reader trust, and narrative closure in a recognizable public-domain novel.",
        },
        {
          q: "Will the PDF include the full novel?",
          a: "No. The PDF should be the RevisionGrade evaluation report, not a reproduction of the novel text.",
        },
      ]}
    />
  );
}
