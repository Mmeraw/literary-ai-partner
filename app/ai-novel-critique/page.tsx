import SeoProofPage from "../../components/marketing/SeoProofPage";

export const metadata = {
  title: "AI Novel Critique | RevisionGrade - The Literary AI Partner",
  description:
    "AI novel critique with evidence-backed manuscript diagnosis, real evaluation examples, author-controlled revision, and downloadable sample reports.",
};

const publicSamples = [
  {
    title: "Sample AI Novel Critique: The Awakening",
    href: "/sample-ai-novel-critique-the-awakening",
    copy: "A public-domain sample page prepared for a full RevisionGrade evaluation report once the quality gate is ready.",
    status: "Sample report page",
  },
  {
    title: "Sample AI Novel Critique: Dracula",
    href: "/sample-ai-novel-critique-dracula",
    copy: "A public-domain Gothic sample page for showing how RevisionGrade diagnoses concept, atmosphere, pacing, voice, and reader trust.",
    status: "Sample report page",
  },
  {
    title: "Sample AI Novel Critique: The Wonderful Wizard of Oz",
    href: "/sample-ai-novel-critique-wizard-of-oz",
    copy: "A public-domain fantasy sample page for showing how a criteria-based evaluation handles wonder, world logic, stakes, and closure.",
    status: "Sample report page",
  },
];

const founderCases = [
  {
    title: "Founder Evaluation Case Study: Cartel Babies",
    href: "/founder-case-study-cartel-babies",
    copy: "Evaluation-report-only founder case study for an upmarket suspense manuscript. The manuscript itself is not published on the page.",
    status: "Founder case study",
  },
  {
    title: "Founder Evaluation Case Study: Let the River Decide",
    href: "/founder-case-study-let-the-river-decide",
    copy: "Evaluation-report-only founder case study for an upmarket eco-thriller manuscript. No full manuscript text is published.",
    status: "Founder case study",
  },
  {
    title: "Founder Evaluation Case Study: The Lost World of MythOAmphibia",
    href: "/founder-case-study-lost-world-of-mythoamphibia",
    copy: "Evaluation-report-only founder case study for a mythic eco-fantasy manuscript. The page is designed for diagnosis proof, not manuscript disclosure.",
    status: "Founder case study",
  },
];

export default function AiNovelCritiquePage() {
  return (
    <SeoProofPage
      eyebrow="AI novel critique"
      title="AI novel critique with real evaluation examples."
      subtitle="RevisionGrade evaluates novels as manuscripts, not prompts. The critique is designed around evidence-backed diagnosis, story criteria, revision priorities, and author-controlled next steps."
      urlPath="/ai-novel-critique"
      primaryCta={{ label: "Begin Evaluation", href: "/evaluate" }}
      secondaryCta={{ label: "See Methodology", href: "/methodology" }}
      notice="This page is built to host evaluation report examples only. Sample PDFs and founder case-study PDFs should be added after the RevisionGrade evaluation process is quality-gated and ready to represent the public brand."
      blocks={[
        {
          title: "Critique means diagnosis",
          copy: "A useful novel critique should identify what is working, what is not working, what evidence supports the finding, and what revision priority follows from it.",
          bullets: ["13 story criteria", "confidence-aware findings", "evidence-backed diagnosis", "revision priority instead of vague advice"],
        },
        {
          title: "Not blind rewriting",
          copy: "RevisionGrade separates diagnosis from repair so a manuscript is not flattened by premature line editing or generic AI rewriting.",
          bullets: ["author control", "voice protection", "repair options", "keep-original and reject paths"],
        },
        {
          title: "Real reports as proof",
          copy: "The page is prepared for public-domain sample evaluations and founder evaluation case studies. The proof asset is the evaluation report, not the full manuscript.",
          bullets: ["HTML summary pages", "downloadable PDF reports", "no full novel text", "clear report-only notices"],
        },
      ]}
      proofLinks={publicSamples}
      caseStudyLinks={founderCases}
      faqs={[
        {
          q: "Will these pages publish full novels?",
          a: "No. The sample and founder pages are designed to publish evaluation reports only, with score summaries and diagnostic findings. Full manuscripts, full chapters, and extended copyrighted text should not be published on these pages.",
        },
        {
          q: "Why use public-domain novels as samples?",
          a: "Public-domain novels let RevisionGrade show evaluation behavior on recognizable works without exposing private manuscripts or modern copyrighted books.",
        },
        {
          q: "Why include founder case studies?",
          a: "Founder case studies show how the same evaluation framework handles real long-form manuscripts by the founder while keeping the manuscript text private.",
        },
        {
          q: "What should the downloadable PDFs contain?",
          a: "They should contain the evaluation report: mode, score snapshot, confidence, evidence-backed findings, revision priorities, and limitations. They should not contain the full manuscript.",
        },
      ]}
    />
  );
}
