import SeoProofPage from "../../components/marketing/SeoProofPage";

export const metadata = {
  title: "AI Editor for Novels | RevisionGrade",
  description:
    "AI editor for novels? Start with manuscript diagnosis, evidence-backed critique, voice protection, and author-controlled revision before rewriting.",
};

export default function AiEditorForNovelsPage() {
  return (
    <SeoProofPage
      eyebrow="AI editor for novels"
      title="AI editor for novels? Start with diagnosis, not rewriting."
      subtitle="RevisionGrade is built for novelists who need manuscript evaluation, story diagnosis, revision priorities, and author-controlled repair before any AI-assisted editing changes the text."
      urlPath="/ai-editor-for-novels"
      primaryCta={{ label: "Begin Evaluation", href: "/evaluate" }}
      secondaryCta={{ label: "AI Novel Critique", href: "/ai-novel-critique" }}
      blocks={[
        {
          title: "The risk of rewriting too soon",
          copy: "Many AI editing tools move directly into changing sentences. RevisionGrade starts by asking whether the manuscript problem is structural, narrative, tonal, or submission-related.",
          bullets: ["structure before polish", "diagnosis before rewrite", "voice protection", "evidence-backed findings"],
        },
        {
          title: "Novel-scale questions need novel-scale evidence",
          copy: "A novel is not just a collection of sentences. Evaluation must account for concept, pacing, character, voice, scene function, theme, closure, and marketability.",
          bullets: ["13 story criteria", "long-form evaluation", "confidence-aware reporting", "manuscript-scale diagnosis"],
        },
        {
          title: "Revision remains author-controlled",
          copy: "The right tool should help the writer make better decisions, not surrender creative authority to an automatic rewrite path.",
          bullets: ["accept", "reject", "keep original", "customize"],
        },
      ]}
      faqs={[
        {
          q: "Is RevisionGrade an AI editor for novels?",
          a: "RevisionGrade can support revision, but it is better understood as The Literary AI Partner for manuscript diagnosis, author-controlled revision, and submission preparation. It does not start with blind rewriting.",
        },
        {
          q: "Why not just use an AI editor to rewrite the manuscript?",
          a: "Because rewriting without diagnosis can polish the wrong problem, flatten voice, and hide structural weaknesses. RevisionGrade is designed to diagnose first.",
        },
      ]}
    />
  );
}
