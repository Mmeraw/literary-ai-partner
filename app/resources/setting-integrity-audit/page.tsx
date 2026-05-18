export default function SettingIntegrityAuditPage() {
  const claimCategories = [
    'Birds and regional ecology',
    'Plants and habitat plausibility',
    'Mammals, fish, and insects',
    'Places and route continuity',
    'Technology and vehicles',
    'Historical facts and archaeology',
    'Anatomy and profession-specific detail',
    'Custom domain claims',
  ]

  const dominantusClaims = [
    'Archaeological artifacts — Mousterian tools, fire control',
    'Homo sapiens vs. Neanderthal capabilities, 44,000 BP',
    'Diet plausibility — dried fish, spices, storage',
    'Inter-species communication and knowledge transfer',
    'Timeline of last Neanderthals (~40,000–44,000 BP)',
  ]

  const mythoamphibiaClaims = [
    'Frog anatomy — neck, head rotation, digit counts',
    'Species-specific locomotion and sensory biology',
    'Ecological range of specific frog species',
    'Amphibian behaviour — breeding, habitat, diet',
    'Chemistry details where relevant to plot',
  ]

  const bcNovelClaims = [
    'Driving distances and travel times between BC villages',
    'Mt. Meager eruption history and dates',
    'Bralorne / Gold Bridge gold rush history',
    'Tłekeh Dene cultural practices and terminology',
    'Liard River hydrology, fish runs, and seasonal behaviour',
  ]

  const governanceRules = [
    'Factual alerts never modify a literary score.',
    'Every alert carries a verification status and confidence value.',
    'The module is opt-in per manuscript and never runs silently.',
    'External API calls are cached per manuscript version.',
    'The interface must clearly label all alerts as advisory only.',
  ]

  return (
    <section
      style={{
        minHeight: 'calc(100vh - 72px)',
        padding: '48px 24px 80px',
        background: '#0f0f10',
        color: '#f5f1e8',
      }}
    >
      <div style={{ maxWidth: 1120, margin: '0 auto' }}>
        <p
          style={{
            margin: '0 0 12px',
            color: 'rgba(245, 241, 232, 0.64)',
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            fontSize: '0.82rem',
          }}
        >
          RevisionGrade · New Optional Module
        </p>

        <h1
          style={{
            margin: '0 0 18px',
            fontSize: 'clamp(2.4rem, 6vw, 5.2rem)',
            lineHeight: 0.98,
            maxWidth: 900,
          }}
        >
          Setting Integrity Audit
        </h1>

        <p
          style={{
            margin: '0 0 28px',
            maxWidth: 760,
            fontSize: '1.08rem',
            lineHeight: 1.75,
            color: 'rgba(245, 241, 232, 0.84)',
          }}
        >
          A post-evaluation sidecar that extracts verifiable world-detail claims from
          manuscripts and returns confidence-banded plausibility alerts — without altering
          literary scores or poisoning craft evaluation.
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            marginBottom: 40,
          }}
        >
          {[
            'Factual Plausibility',
            'Ecology & Species',
            'Historical Accuracy',
            'Geographic Continuity',
            'Biology & Anatomy',
            'Advisory Only',
          ].map((item) => (
            <span
              key={item}
              style={{
                padding: '10px 14px',
                borderRadius: 999,
                border: '1px solid rgba(245, 241, 232, 0.12)',
                background: 'rgba(255, 255, 255, 0.03)',
                color: 'rgba(245, 241, 232, 0.88)',
                fontSize: '0.92rem',
              }}
            >
              {item}
            </span>
          ))}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
            marginBottom: 48,
          }}
        >
          <div
            style={{
              padding: 24,
              borderRadius: 20,
              background: 'rgba(255, 255, 255, 0.035)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <p style={{ margin: '0 0 12px', color: '#d2b48c', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Design Principle
            </p>
            <p style={{ margin: 0, lineHeight: 1.75, color: 'rgba(245, 241, 232, 0.86)' }}>
              The literary evaluator should never become a brittle fact-checker. This module
              exists to isolate verifiable world-detail scrutiny from craft judgment.
            </p>
          </div>

          <div
            style={{
              padding: 24,
              borderRadius: 20,
              background: 'rgba(255, 255, 255, 0.035)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <p style={{ margin: '0 0 12px', color: '#d2b48c', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Cardinal Rule
            </p>
            <p style={{ margin: 0, lineHeight: 1.75, color: 'rgba(245, 241, 232, 0.86)' }}>
              Do not say “this is wrong.” Say “this may require verification.” Authors should
              receive advisory signals, never surprise verdicts.
            </p>
          </div>

          <div
            style={{
              padding: 24,
              borderRadius: 20,
              background: 'rgba(255, 255, 255, 0.035)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <p style={{ margin: '0 0 12px', color: '#d2b48c', fontSize: '0.88rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Score Protection
            </p>
            <p style={{ margin: 0, lineHeight: 1.75, color: 'rgba(245, 241, 232, 0.86)' }}>
              Factual alerts remain separate from literary scoring by default, preserving
              RevisionGrade’s authority in craft evaluation.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)',
            gap: 24,
            marginBottom: 48,
          }}
        >
          <div
            style={{
              padding: 28,
              borderRadius: 24,
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: '1.5rem' }}>
              Why a separate layer
            </h2>
            <p style={{ margin: '0 0 16px', lineHeight: 1.8, color: 'rgba(245, 241, 232, 0.84)' }}>
              The 13 literary criteria evaluate story craft, voice, and structure. Asking
              that same evaluation layer to verify regional bird species, Paleolithic tool
              terminology, or geographically precise travel claims invites hallucinated
              fact-checking and weakens trust in both outputs.
            </p>
            <p style={{ margin: 0, lineHeight: 1.8, color: 'rgba(245, 241, 232, 0.84)' }}>
              The better architecture is a governed sidecar: separate extraction, separate
              verification logic, separate alert presentation, and no silent contamination of
              literary scores. [file:10]
            </p>
          </div>

          <div
            style={{
              padding: 28,
              borderRadius: 24,
              background: 'rgba(210, 180, 140, 0.09)',
              border: '1px solid rgba(210, 180, 140, 0.18)',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 16, fontSize: '1.35rem' }}>
              Pipeline position
            </h2>
            <p style={{ margin: '0 0 16px', lineHeight: 1.8, color: 'rgba(245, 241, 232, 0.84)' }}>
              The audit sits after ingestion and chunking, but before final synthesis. It
              never blocks the literary evaluation passes.
            </p>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '0.92rem',
                lineHeight: 1.8,
                padding: 16,
                borderRadius: 16,
                background: 'rgba(0, 0, 0, 0.22)',
                color: '#f6e7d2',
              }}
            >
              Manuscript → Chunking → Literary Passes → Claim Extraction → Verification →
              Advisory Alerts → Final Synthesis
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 28,
            borderRadius: 24,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: 48,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: '1.5rem' }}>
            Claim categories
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 14,
            }}
          >
            {claimCategories.map((item) => (
              <div
                key={item}
                style={{
                  padding: '14px 16px',
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  color: 'rgba(245, 241, 232, 0.88)',
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            padding: 28,
            borderRadius: 24,
            background: '#111214',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: 48,
            overflowX: 'auto',
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: '1.5rem' }}>
            WorldDetailClaim type
          </h2>
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              fontSize: '0.9rem',
              lineHeight: 1.7,
              color: '#f2e7d8',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace',
            }}
          >{`type WorldDetailClaim = {
  claim_id: string;
  manuscript_id: string;
  chapter: string;
  text_span: string;
  entity: string;
  entity_type:
    | "bird"
    | "plant"
    | "mammal"
    | "fish"
    | "insect"
    | "place"
    | "technology"
    | "vehicle"
    | "historical_fact"
    | "archaeological_artifact"
    | "anatomy"
    | "profession"
    | "custom";
  location?: string;
  time_period?: string;
  season?: string;
  confidence: number;
  verification_status:
    | "supported"
    | "unsupported"
    | "ambiguous"
    | "needs_human_review";
  sources_checked: string[];
  report_message: string;
  recommended_action?: string;
};`}</pre>
        </div>

        <div style={{ marginBottom: 48 }}>
          <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: '1.5rem' }}>
            Alert output examples
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 18,
            }}
          >
            {[
              {
                title: 'Coastal BC species plausibility',
                body: 'A named species may not be typical to coastal British Columbia in the stated location or season.',
                action: 'Verify against eBird BC occurrence data and consider regionally common replacements.',
              },
              {
                title: '44,000 BP tool realism',
                body: 'Metal knives did not exist in the period; Mousterian-culture stone tools are more plausible.',
                action: 'Replace with flint blade, sharpened stone, or Levallois point if historical plausibility matters.',
              },
              {
                title: '1973 Datsun specificity',
                body: 'A vague Datsun reference may break trust with historically literate readers if the model is not specified.',
                action: 'Name the model and verify market-era trim details if authenticity is important.',
              },
              {
                title: 'Amphibian anatomy check',
                body: 'Frog head and digit details may be accurate in general, but species-level verification can still matter.',
                action: 'Confirm against species-specific anatomical references when a species is named.',
              },
            ].map((card) => (
              <div
                key={card.title}
                style={{
                  padding: 22,
                  borderRadius: 20,
                  background: 'rgba(255, 255, 255, 0.035)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: '1.08rem' }}>{card.title}</h3>
                <p style={{ margin: '0 0 12px', lineHeight: 1.75, color: 'rgba(245, 241, 232, 0.84)' }}>
                  {card.body}
                </p>
                <p style={{ margin: 0, lineHeight: 1.7, color: '#d7b890' }}>
                  Recommended action: {card.action}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            padding: 28,
            borderRadius: 24,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            marginBottom: 48,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 20, fontSize: '1.5rem' }}>
            Your three novels
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 18,
            }}
          >
            {[
              { title: 'Book of Dominatus I', items: dominantusClaims },
              { title: 'Mythoamphibia', items: mythoamphibiaClaims },
              { title: 'BC corridor novel', items: bcNovelClaims },
            ].map((novel) => (
              <div
                key={novel.title}
                style={{
                  padding: 22,
                  borderRadius: 20,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>{novel.title}</h3>
                <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8, color: 'rgba(245, 241, 232, 0.84)' }}>
                  {novel.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 20,
            marginBottom: 48,
          }}
        >
          <div
            style={{
              padding: 24,
              borderRadius: 20,
              background: 'rgba(255, 255, 255, 0.035)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: '1.35rem' }}>MVP scope</h2>
            <p style={{ margin: 0, lineHeight: 1.8, color: 'rgba(245, 241, 232, 0.84)' }}>
              Start narrow. The first version should flag categories where false positives are
              lowest and public reference support is strongest, then expand from a stable core.
            </p>
          </div>

          <div
            style={{
              padding: 24,
              borderRadius: 20,
              background: 'rgba(255, 255, 255, 0.035)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: '1.35rem' }}>Pull requests A–D</h2>
            <p style={{ margin: 0, lineHeight: 1.8, color: 'rgba(245, 241, 232, 0.84)' }}>
              Four reviewable PRs can ship independently: claim extraction, verification logic,
              API/rate-limit handling, and governance-safe UI integration.
            </p>
          </div>

          <div
            style={{
              padding: 24,
              borderRadius: 20,
              background: 'rgba(255, 255, 255, 0.035)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: '1.35rem' }}>External APIs</h2>
            <p style={{ margin: '0 0 12px', lineHeight: 1.8, color: 'rgba(245, 241, 232, 0.84)' }}>
              Curated public APIs should map to specific claim categories instead of acting as a
              generic factual oracle.
            </p>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '0.9rem',
                padding: 12,
                borderRadius: 14,
                background: 'rgba(0, 0, 0, 0.22)',
                color: '#f6e7d2',
              }}
            >
              GET /v2/data/obs/{'{regionCode}'}/recent
            </div>
          </div>
        </div>

        <div
          style={{
            padding: 28,
            borderRadius: 24,
            background: 'rgba(210, 180, 140, 0.08)',
            border: '1px solid rgba(210, 180, 140, 0.2)',
            marginBottom: 24,
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 18, fontSize: '1.5rem' }}>
            Governance rules
          </h2>
          <ol style={{ margin: 0, paddingLeft: 22, lineHeight: 1.9, color: 'rgba(245, 241, 232, 0.88)' }}>
            {governanceRules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ol>
        </div>

        <div
          style={{
            padding: 22,
            borderRadius: 20,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            color: '#f1dcc0',
          }}
        >
          These alerts do not affect your manuscript&apos;s literary evaluation score.
        </div>
      </div>
    </section>
  )
}