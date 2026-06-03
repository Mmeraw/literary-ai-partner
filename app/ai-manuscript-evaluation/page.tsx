import SeoProofPage from "../../components/marketing/SeoProofPage";

export const metadata = {
  title: "AI Manuscript Evaluation | RevisionGrade",
  description:
    "AI manuscript evaluation for serious writers: evidence-backed diagnosis, 13 story criteria, author-controlled revision, and submission preparation.",
};

export default function AiManuscriptEvaluationPage() {
  return (
    <SeoProofPage
      eyebrow="AI manuscript evaluation"
      title="AI manuscript evaluation for serious writers."
      subtitle="RevisionGrade evaluates manuscripts through story criteria, evidence-backed diagnosis, confidence-aware findings, and revision priorities before repair or submission preparation begins."
      urlPath="/ai-manuscript-evaluation"
      primaryCta={{ label: "Begin Evaluation", href: "/evaluate" }}
      secondaryCta={{ label: "See Methodology", href: "/methodology" }}
      blocks={[
        {
          title: "Evaluation is not editing",
          copy: "A manuscript evaluation should tell the writer where the story stands before anyone begins polishing sentences or rewriting scenes.",
          bullets: ["readiness first", "diagnosis before repair", "criteria-based analysis", "confidence and evidence"],
        },
        {
          title: "Short-form and long-form modes",
          copy: "Different manuscript lengths support different responsible claims. Short-form work is not treated as if it proves full-manuscript continuity.",
          bullets: ["under 25,000 words", "25,000+ words", "long-form multi-layer evaluation", "scope discipline"],
        },
        {
          title: "From evaluation to Revise",
          copy: "Evaluation should create repair direction without forcing blind rewriting. RevisionGrade is designed to turn findings into author-controlled revision opportunities.",
          bullets: ["Revise Queue", "TrustedPath", "keep original", "reject or customize"],
        },
      ]}
      faqs={[
        {
          q: "What does AI manuscript evaluation mean?",
          a: "It means using an AI-assisted, criteria-based framework to analyze manuscript readiness, identify risks, and explain findings with evidence. In RevisionGrade, evaluation is separated from revision so the author remains in control.",
        },
        {
          q: "Is this just a manuscript score?",
          a: "No. A score without evidence is not useful. RevisionGrade is designed to connect score, confidence, diagnosis, evidence, and revision priority.",
        },
      ]}
    />
  );
}
