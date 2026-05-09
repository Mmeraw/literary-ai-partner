# RevisionGrade — Landing

Static landing page for revisiongrade.com. Canon-grade rebuild in archival-prestige register.

## Live preview

Private preview is deployed at the Perplexity Computer asset URL (auth-scoped to the owner). Re-deploy through the agent to update.

## Run locally

```bash
cd marketing/landing
python3 -m http.server 3001
# open http://localhost:3001
```

No build step. Plain HTML/CSS/JS. Fonts loaded from Google Fonts (Instrument Serif, Switzer, JetBrains Mono).

## Files

- `index.html` — page structure (10 sections: hero, standard, registers, protect, workflow, reality, blueprint, doctrine, output, cta + footer)
- `style.css` — design tokens (obsidian, bone, oxblood, gold), base reset, type scale, nav, hero, footer
- `landing.css` — section-specific styles (registers, protect band, blueprint letter, doctrine lines, output band)
- `landing.js` — mobile nav toggle, scroll-aware header

## Architectural intent

A governed revision operating system, surfaced as elite editorial intelligence. Governance machinery is the substrate; what shows is editorial judgment.

**Surface vocabulary on landing:**
- 13 Story Evaluation Criteria + WAVE Revision System
- Two registers: invisible rigor (underneath) / visible humanity (on top)
- Two PROTECT examples (without naming the FORCE/BEHAVIOR/INVENTORY taxonomy)
- Editorial verbs: Read · Diagnose · Translate · Revise · Render
- Doctrine: hard governance / voice protected / **zero compression is a valid outcome**

**Held back to /methodology (not on landing):**
- Functional classification taxonomy (FORCE / BEHAVIOR / INVENTORY / NOISE / MIXED)
- "RevisionOpportunity" as a public-facing term
- 25k threshold / Pass 3 surface style contract
- Paired-gate architecture, Layer-Zero canon nomenclature

## Design tokens

| Token | Value | Use |
| --- | --- | --- |
| `--obsidian` | `#0b0a08` | Page background |
| `--bone` | `#ece5d6` | Body text, primary surface |
| `--oxblood` | `#6e1f2a` | Accent — ritual gravity (doctrine closer, hero underline) |
| `--gold` | `#c9a861` | Accent — instrument warmth (kickers, ornaments, italic emphasis) |

Type: Instrument Serif (display), Switzer (body), JetBrains Mono (technical labels).

## Anti-patterns the page deliberately avoids

- No Jira-card stack of features — replaced with editorial paragraphs and pull-quotes
- No SaaS gradient hero — flat obsidian, oxblood underline behind italic display type
- No "AI assistant" / "rewriter" framing — the page leads with what the engine refuses to do
- No four-card layer diagram — collapsed to "two registers"
