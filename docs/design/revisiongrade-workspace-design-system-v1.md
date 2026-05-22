# RevisionGrade Workspace Design System v1.0

**Status:** Internal design reference  
**Date:** May 2026  
**Scope:** Authenticated workspace surfaces only: Dashboard, Story Ledger, Evaluate Workbench, Revise Workbench, TrustedPath, Admin/Ops.

> The marketing site sells the doctrine. The workspace is the manuscript table.

## 1. Philosophy

RevisionGrade's public marketing can remain cinematic, dark, literary, and authoritative. The logged-in workspace must do the opposite: it must recede and let the manuscript, evidence, and editorial decisions take center stage.

Authors in the workspace are doing serious editorial work: reading evidence, reviewing characters, approving or rejecting line-level changes, checking governance state, and deciding whether a manuscript is ready for further action. This environment demands calm, readability, trust, and manuscript-first hierarchy.

### Core rule

**Dark shell, light work surface.**

The marketing pages are the velvet curtain. The workspace is the editorial table.

In practice:

- Marketing pages: dark background, serif/display headings, cinematic mood, gold and oxblood accents.
- Logged-in workspace pages: warm parchment background, dark ink text, editorial card treatment.
- Persistent navigation shell: retain dark brand chrome `#1A1410` to preserve continuity.
- Premium feel comes from typography, spacing, and accent discipline, not from dark surfaces everywhere.
- The author should feel they have entered a serious editorial institution, not a generic SaaS dashboard.
- Do **not** use pure white `#FFFFFF`, cold gray, or generic blue CTAs anywhere in the workspace.

## 2. Surface hierarchy

| Surface | Theme | Visual mode | Purpose |
| --- | --- | --- | --- |
| Landing / Public pages | Dark marketing | Cinematic, doctrinal | Sell the instrument |
| Auth / Sign-in gate | Dark marketing | Same as landing | Entry point |
| Dashboard | Light workspace | Calm, operational | Submission readiness, history |
| Story Ledger | Light workspace | Editorial, evidence-first | Character / cast review and approval |
| Evaluate Workbench | Light workspace | Structured, analytical | Scores, criteria, evidence cards |
| Revise Workbench | Light workspace | Manuscript-first | Line-by-line accept/reject |
| TrustedPath | Light workspace | Governance cues strong | Audit trail, automated safety |
| Admin / Ops | Light workspace | Clean neutral | Operational truth, no drama |

## 3. Color system

The palette has three layers:

1. **Marketing Shell** — dark navigation and shell chrome.
2. **Workspace Canvas** — warm editorial work surface.
3. **Semantic States** — approval, caution, failure, and author flags.

### 3.1 Marketing Shell — dark navigation

These colors are used in the top navigation bar, sidebar rails, dropdowns, and persistent shell chrome across authenticated pages.

| Role | CSS variable | Hex | Usage |
| --- | --- | --- | --- |
| Shell BG | `--rg-shell-bg` | `#1A1410` | Top nav, sidebar rail, dark chrome |
| Shell Surface | `--rg-shell-surface` | `#211C16` | Dropdown menus in nav, modal overlays |
| Gold Accent | `--rg-gold` | `#B8922A` | Logo, stage badges, highlight borders, key CTAs |
| Oxblood | `--rg-oxblood` | `#8B2E2E` | Underline accents in nav, destructive indicators |
| Shell Text | `--rg-shell-text` | `#E8DFD0` | Nav text and header typography on dark |
| Shell Muted | `--rg-shell-muted` | `#9A8A78` | Nav secondary labels, breadcrumb, metadata |

### 3.2 Workspace Canvas — light editorial

The workspace base is warm parchment, not sterile white or cold gray. Cards layer on top using slightly lighter values. Text is near-black ink.

| Role | CSS variable | Hex | Usage |
| --- | --- | --- | --- |
| WS Background | `--rg-ws-bg` | `#F5F0E8` | Primary workspace page background |
| WS Surface | `--rg-ws-surface` | `#FAF7F2` | Cards, panels, character cards, criteria blocks |
| WS Surface Alt | `--rg-ws-surface-alt` | `#FFFDF9` | Elevated card on hover, active evidence block |
| WS Border | `--rg-ws-border` | `#D9D0C3` | Card borders, section dividers, input outlines |
| WS Border Lt | `--rg-ws-border-lt` | `#EAE4DA` | Inner dividers, column separators |
| WS Text | `--rg-ws-text` | `#1C1814` | Primary headings, character names, body text |
| WS Text Muted | `--rg-ws-text-muted` | `#5C5549` | Secondary labels, roles, evidence summaries |
| WS Text Faint | `--rg-ws-text-faint` | `#9A9087` | Placeholders, metadata, empty state hints |
| WS Accent | `--rg-ws-accent` | `#8B2E2E` | Primary CTA buttons, active selection borders |
| WS Accent Hover | `--rg-ws-accent-hover` | `#6B2020` | CTA hover state |
| WS Gold | `--rg-ws-gold` | `#B8922A` | Stage badges, highlight borders, score tiers |
| WS Gold Tint | `--rg-ws-gold-tint` | `#F5E9C8` | Gold badge backgrounds, callout box surfaces |

### 3.3 Semantic states

Semantic colors must never be used decoratively. They answer: what is the status of this card, criterion, or revision suggestion?

| Role | CSS variable | Hex | Usage |
| --- | --- | --- | --- |
| Success | `--rg-success` | `#3A6B2A` | Agreed card, gate passed, accepted revision |
| Success BG | `--rg-success-bg` | `#EBF4E6` | Card surface when author clicked Agree |
| Warning | `--rg-warning` | `#8B5E1A` | Soft fail, incomplete section, unresolved warning |
| Warning BG | `--rg-warning-bg` | `#FBF1DC` | Card surface for needs-review state |
| Error | `--rg-error` | `#8B2020` | Hard fail, blocking state, destructive action |
| Error BG | `--rg-error-bg` | `#F9E8E8` | Error card surface |
| Flag | `--rg-flag` | `#4A3A8A` | Author has flagged character/evidence for discussion |
| Flag BG | `--rg-flag-bg` | `#EEEAF9` | Card surface when author clicked Flag |

### 3.4 State-to-color mapping

| Author/system state | Card left border | Card background | Badge label |
| --- | --- | --- | --- |
| Untouched | `#D9D0C3` | `#FAF7F2` | — |
| Agree | `#3A6B2A` | `#EBF4E6` | Agreed |
| Needs Changes | `#8B5E1A` | `#FBF1DC` | Pending Edit |
| Flag | `#4A3A8A` | `#EEEAF9` | Flagged |
| HARD FAIL | `#8B2020` | `#F9E8E8` | Hard Fail |
| Ledger Approved | `#B8922A` | `#F5E9C8` | Approved |

## 4. Typography

RevisionGrade uses a serif/sans pairing:

- **Serif:** editorial authority; reserved for identity-bearing headings and character names.
- **Sans:** clarity; used for all operational UI, labels, body copy, badges, forms, and tables.

### 4.1 Font stack

| Role | Primary | Fallback | Where used |
| --- | --- | --- | --- |
| Module headings | Playfair Display SemiBold | Georgia, serif | Page titles, module names |
| Character names | Playfair Display Regular | Georgia, serif | Character card primary label |
| Section headings | Inter SemiBold 600 | system-ui, sans-serif | Workspace section headers |
| Body / labels | Inter Regular 400 | system-ui, sans-serif | Descriptions, evidence text, metadata |
| Badges / caps | Inter Medium 500 | system-ui, sans-serif | Uppercase tracking labels, stage badges |
| Code / tokens | JetBrains Mono | monospace | Hex values, dev references only |
| Nav / shell | Inter Medium 500 | system-ui, sans-serif | Top nav links, uppercase spaced |

### 4.2 Size scale

| Role | Size | Weight | Color | Example |
| --- | ---: | ---: | --- | --- |
| Module title | 24px | 600 | WS Text | Story Ledger |
| Character name | 16px | 600 serif | WS Text | Michael James Salter |
| Section heading | 13px | 600 | WS Text | POV Structure |
| Role / subtitle | 12px | 400 | WS Text Muted | Primary narrator · First-person POV |
| Evidence body | 13px | 400 | WS Text | Evidence excerpt text |
| Warning text | 12px | 400 | Warning | Warning message copy |
| Badge / label caps | 10px | 500 | Varies | STAGE 1 · ACTIVE |
| Metadata / timestamp | 11px | 400 | WS Text Faint | Last updated 14 min ago |

### 4.3 Typography rules

- Never use the marketing display serif in body text, tables, or operational UI.
- Character card names may use Playfair Display for literary register.
- Badge text, stage labels, and nav items are uppercase with `letter-spacing: 0.08em`.
- Body text measure: 60–70 characters per line.
- Body line height: `1.55`; headings: `1.25`; metadata: `1.4`.
- No decorative italic in workspace. Italics are reserved for manuscript title references and technical identifiers.

## 5. Component rules by surface

### 5.1 Dashboard

Submission readiness, evaluation history, recent jobs. Operational utility — no drama.

| Surface | Background | Text | Border | Accent | Notes |
| --- | --- | --- | --- | --- | --- |
| Page bg | `#F5F0E8` | `#1C1814` | `#D9D0C3` | — | Warm parchment |
| Job card | `#FAF7F2` | `#28251D` | `#D9D0C3` | `#B8922A` | Clickable, shows status badge |
| Status badge | varies | varies | none | none | Semantic colors per state |
| CTA button | `#8B2E2E` | `#E8DFD0` | none | — | New Evaluation, Continue |
| History table | `#FAF7F2` | `#28251D` | `#EAE4DA` | — | Alternating `#F5F0E8` rows |

### 5.2 Story Ledger

Character cast review. Each card is an editorial judgment point. Left border encodes author action state. Approval gate UI lives at bottom.

| Surface | Background | Text | Border | Accent | Notes |
| --- | --- | --- | --- | --- | --- |
| Page bg | `#F5F0E8` | `#1C1814` | `#D9D0C3` | — | Workspace base |
| Character card | `#FAF7F2` | `#28251D` | `#D9D0C3` | 3px left | Left border = state color |
| POV badge | `#F5E9C8` | `#B8922A` | `#D9C89A` | — | Gold narrative importance |
| Agreed card | `#EBF4E6` | `#28251D` | `#3A6B2A` | `#3A6B2A` | Left border green 3px |
| Flagged card | `#EEEAF9` | `#28251D` | `#4A3A8A` | `#4A3A8A` | Left border purple 3px |
| Hard fail card | `#F9E8E8` | `#28251D` | `#8B2020` | `#8B2020` | Left border oxblood 3px |
| Evidence block | `#FFFDF9` | `#5C5549` | `#EAE4DA` | — | Slightly elevated surface |
| Warning group | `#FBF1DC` | `#8B5E1A` | `#D9C89A` | — | Grouped by character |
| Section stub | `#F5F0E8` | `#9A9087` | `#EAE4DA` | — | Dashed border, italic label |
| Approve button | `#3A6B2A` | `#FFFFFF` | none | — | Disabled when HARD_FAIL present |
| Submit Feedback | `#8B2E2E` | `#E8DFD0` | none | — | Always enabled |

### 5.3 Evaluate Workbench

Criteria scoring, evidence cards per criterion, score tier badges. Analytical and structured.

| Surface | Background | Text | Border | Accent | Notes |
| --- | --- | --- | --- | --- | --- |
| Page bg | `#F5F0E8` | `#1C1814` | `#D9D0C3` | — | Parchment base |
| Criterion card | `#FAF7F2` | `#28251D` | `#D9D0C3` | `#B8922A` | Score tier in gold badge |
| Score: Pass | `#EBF4E6` | `#3A6B2A` | `#3A6B2A` | — | Green surface |
| Score: Caution | `#FBF1DC` | `#8B5E1A` | `#8B5E1A` | — | Amber surface |
| Score: Fail | `#F9E8E8` | `#8B2020` | `#8B2020` | — | Error red surface |
| Evidence citation | `#FFFDF9` | `#5C5549` | `#EAE4DA` | — | Chapter ref + excerpt |
| Score tier badge | `#F5E9C8` | `#B8922A` | `#D9C89A` | — | MUST / SHOULD / COULD |
| Global score bar | `#1C1814` | `#E8DFD0` | — | `#B8922A` | Dark surface, gold fill bar |

### 5.4 Revise Workbench

Line-by-line accept/reject/customize revision queue. Manuscript text is the star. Maximum readability, minimum UI distraction.

| Surface | Background | Text | Border | Accent | Notes |
| --- | --- | --- | --- | --- | --- |
| Page bg | `#F5F0E8` | `#1C1814` | `#D9D0C3` | — | Quietest surface in app |
| Queue item | `#FAF7F2` | `#28251D` | `#D9D0C3` | 3px left | State color on left border |
| Original text | `#FFFDF9` | `#28251D` | `#EAE4DA` | — | Serif if possible, 14–16px |
| Suggested text | `#F5F0E8` | `#5C5549` | `#EAE4DA` | — | Slightly muted vs original |
| Accepted item | `#EBF4E6` | `#28251D` | `#3A6B2A` | `#3A6B2A` | Fade to green on accept |
| Rejected item | `#F9E8E8` | `#5C5549` | `#D9D0C3` | — | Soft muted, not alarming |
| Voice gate badge | `#F5E9C8` | `#B8922A` | `#D9C89A` | — | VOICE PROTECTED |
| Danger badge | `#F9E8E8` | `#8B2020` | `#D9A8A8` | — | VOICE RISK — requires review |
| Custom field | `#FFFDF9` | `#1C1814` | `#B8922A` | — | Gold border while author typing |

### 5.5 TrustedPath

Audit trail, governance confirmation, automated path. Stronger governance visual cues than other surfaces. Gold is more prominent because it functions as a trust signal.

| Surface | Background | Text | Border | Accent | Notes |
| --- | --- | --- | --- | --- | --- |
| Page bg | `#F5F0E8` | `#1C1814` | `#D9D0C3` | — | Same parchment base |
| Step card done | `#EBF4E6` | `#3A6B2A` | `#3A6B2A` | `#B8922A` | Gold checkmark icon |
| Step card active | `#FAF7F2` | `#28251D` | `#B8922A` | `#B8922A` | Gold border highlight |
| Step card wait | `#FAF7F2` | `#9A9087` | `#EAE4DA` | — | Muted, not yet active |
| Audit log row | `#FAF7F2` | `#5C5549` | `#EAE4DA` | — | Timestamp + action label |
| Confirm gate | `#F5E9C8` | `#1C1814` | `#B8922A` | `#B8922A` | Gold border callout |
| Finalize button | `#B8922A` | `#1A1410` | none | — | Gold CTA — premium signal |

## 6. Layout and spacing

### 6.1 Shell structure

- Top navigation bar height: `48px`.
- Top navigation background: Shell BG `#1A1410`.
- Logo left, nav center-right, user avatar right.
- No left sidebar in initial build.
- If sidebar is added later: `56px` width, Shell Surface `#211C16`, gold active indicator.
- Breadcrumb below nav: `32px` height, warm border-bottom, workspace background.
- Footer not needed in workspace; approval/progress controls can pin to bottom of content area.

### 6.2 Content grid

- Editorial surfaces max width: `860px` centered.
- Score/evaluation views max width: `1100px`.
- Page horizontal padding: `24px` mobile, `40px` tablet, `64px` desktop.
- Card internal padding: `20px`.
- Card list gap: `12px`.
- Major section gap: `32px`.
- Character card left border: `3px solid`, color = author action state.
- Evidence block: `16px` left indent from card body, dashed left border in WS Border Lt.

### 6.3 Spacing scale

| Token | Value | Usage |
| --- | ---: | --- |
| `space-1` | 4px | Icon padding, badge inner x |
| `space-2` | 8px | Label-to-value gap, tight list items |
| `space-3` | 12px | Card list gap, button icon gap |
| `space-4` | 16px | Inline content margin, evidence indent |
| `space-5` | 20px | Card internal padding |
| `space-6` | 24px | Section header bottom margin |
| `space-8` | 32px | Major section gap, page top padding below breadcrumb |
| `space-10` | 40px | Module-to-module breathing room |
| `space-16` | 64px | Page side padding on desktop |

## 7. CSS implementation

All tokens should be defined as CSS custom properties in `:root`. Tailwind config should reference these variables through `theme.extend.colors`.

```css
:root {
  /* Shell */
  --rg-shell-bg: #1A1410;
  --rg-shell-surface: #211C16;
  --rg-gold: #B8922A;
  --rg-oxblood: #8B2E2E;
  --rg-shell-text: #E8DFD0;
  --rg-shell-muted: #9A8A78;

  /* Workspace canvas */
  --rg-ws-bg: #F5F0E8;
  --rg-ws-surface: #FAF7F2;
  --rg-ws-surface-alt: #FFFDF9;
  --rg-ws-border: #D9D0C3;
  --rg-ws-border-lt: #EAE4DA;
  --rg-ws-text: #1C1814;
  --rg-ws-text-muted: #5C5549;
  --rg-ws-text-faint: #9A9087;
  --rg-ws-accent: #8B2E2E;
  --rg-ws-accent-hover: #6B2020;
  --rg-ws-gold: #B8922A;
  --rg-ws-gold-tint: #F5E9C8;

  /* Semantic states */
  --rg-success: #3A6B2A;
  --rg-success-bg: #EBF4E6;
  --rg-warning: #8B5E1A;
  --rg-warning-bg: #FBF1DC;
  --rg-error: #8B2020;
  --rg-error-bg: #F9E8E8;
  --rg-flag: #4A3A8A;
  --rg-flag-bg: #EEEAF9;
}

.workspace-dark {
  --rg-ws-bg: #1C1814;
  --rg-ws-surface: #231F1A;
  --rg-ws-surface-alt: #2A2520;
  --rg-ws-border: #3D362E;
  --rg-ws-text: #E8DFD0;
  --rg-ws-text-muted: #9A8A78;
  --rg-ws-text-faint: #5C5045;
}
```

Tailwind color extension:

```ts
extend: {
  colors: {
    shell: {
      bg: 'var(--rg-shell-bg)',
      surface: 'var(--rg-shell-surface)',
      text: 'var(--rg-shell-text)',
      muted: 'var(--rg-shell-muted)',
    },
    gold: 'var(--rg-gold)',
    oxblood: 'var(--rg-oxblood)',
    ws: {
      bg: 'var(--rg-ws-bg)',
      surface: 'var(--rg-ws-surface)',
      surfaceAlt: 'var(--rg-ws-surface-alt)',
      border: 'var(--rg-ws-border)',
      borderLt: 'var(--rg-ws-border-lt)',
      text: 'var(--rg-ws-text)',
      textMuted: 'var(--rg-ws-text-muted)',
      textFaint: 'var(--rg-ws-text-faint)',
      accent: 'var(--rg-ws-accent)',
      accentHover: 'var(--rg-ws-accent-hover)',
      gold: 'var(--rg-ws-gold)',
      goldTint: 'var(--rg-ws-gold-tint)',
    },
    state: {
      success: 'var(--rg-success)',
      successBg: 'var(--rg-success-bg)',
      warning: 'var(--rg-warning)',
      warningBg: 'var(--rg-warning-bg)',
      error: 'var(--rg-error)',
      errorBg: 'var(--rg-error-bg)',
      flag: 'var(--rg-flag)',
      flagBg: 'var(--rg-flag-bg)',
    },
  },
}
```

## 8. Do / Don't

| Do | Don't |
| --- | --- |
| Use warm parchment `#F5F0E8` as workspace base. | Use pure white `#FFFFFF` anywhere in workspace. |
| Use oxblood `#8B2E2E` for primary CTAs. | Use generic blue for any button or link in workspace. |
| Retain dark shell nav bar on authenticated pages. | Extend the dark marketing aesthetic into the working canvas. |
| Use 3px left border to encode author action state on cards. | Use background color alone to signal state. |
| Badge gold `#B8922A` for stage identifiers and score tiers. | Use gold as a general highlight or hover color. |
| Disable Approve Ledger button when any HARD_FAIL is present. | Allow approval without resolving hard fails. |
| Use serif for character names only in card headings. | Use serif display fonts in body text, tables, or operational UI. |
| Use semantic error/warning colors with bg + border pair. | Use red for anything other than hard failures and destructive actions. |
| Group duplicate warnings under one character card. | Show the same warning multiple times with different spellings. |
| Show POV Structure at top of Story Ledger — always. | Display ledger without POV identification. |

## 9. Brand Promise Test

Before shipping any workspace UI, apply this test:

> Does this surface feel like sitting at the desk of a serious literary editor — calm, evidence-driven, authoritative without being theatrical?

If the answer is no, the surface is either too clinical/SaaS-bland or too atmospheric/marketing-theater. The workspace should feel like the back room that the marketing page promises.
