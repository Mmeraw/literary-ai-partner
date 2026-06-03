import SeoProofPage from "../../components/marketing/SeoProofPage";

export const metadata = {
  title: "Sample AI Novel Critique: The Awakening | RevisionGrade",
  description:
    "Public-domain sample AI novel critique page for The Awakening, prepared for a RevisionGrade evaluation PDF.",
};

export default function AwakeningSamplePage() {
  return (
    <SeoProofPage
      eyebrow="Sample AI novel critique"
      title="Sample AI Novel Critique: The Awakening."
      subtitle="A public-domain sample page prepared to host a full RevisionGrade evaluation report for Kate Chopin's The Awakening once the quality-gated PDF is ready."
      urlPath="/sample-ai-novel-critique-the-awakening"
      primaryCta={{ label: "Back to AI Novel Critique", href: "/ai-novel-critique" }}
      secondaryCta={{ label: "See Methodology", href: "/methodology" }}
      notice="This sample page is designed for evaluation-report proof. It should summarize the report and link to the PDF, not reproduce the entire novel."
      pdfFilename="revisiongrade-sample-ai-novel-critique-the-awakening.pdf"
      blocks={[
        {
          title: "Why this sample matters",
          copy: "The Awakening is a useful public-domain test case for interiority, psychological progression, social pressure, voice, theme, pacing, and narrative closure.",
          bullets: ["public-domain novel", "literary fiction signal", "interiority and theme", "closure and reader trust"],
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
          q: "Why use The Awakening as a sample?",
          a: "It gives RevisionGrade a public-domain literary manuscript to evaluate for psychological clarity, thematic pressure, pacing, prose control, and closure.",
        },
        {
          q: "Will the PDF include the full novel?",
          a: "No. The PDF should be the RevisionGrade evaluation report, not a reproduction of the novel text.",
        },
      ]}
    />
  );
}
