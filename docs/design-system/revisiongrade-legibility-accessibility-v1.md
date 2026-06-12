# RevisionGrade™ Legibility & Accessibility Standard V1

Status: Proposed standard  
Scope: Public pages, author-facing workspaces, reports, downloads UI, dashboards, and CTA surfaces.

## Purpose

RevisionGrade must remain visually premium while becoming easier to read for middle-aged authors and mobile users. The goal is not to replace the color palette. The goal is to preserve the ink / cream / gold / burgundy identity while improving contrast, weight, font size, spacing, and tap targets.

## Non-Negotiables

- Preserve the gorgeous RevisionGrade palette.
- Do not flatten the brand into generic black/white accessibility styling.
- Increase contrast through text color, font weight, opacity, and spacing.
- Author-facing reading surfaces should feel calm, spacious, and editorial.
- Mobile users must not need to pinch-zoom to read or tap.

## Typography Targets

### Desktop / Laptop

- Long-form reading/report body: 18px preferred.
- Marketing body copy: 17–18px.
- Cards and summary copy: 16–17px.
- Metadata labels: 13–14px minimum, high contrast.
- Buttons: 15–16px minimum, bold or semibold.

### Mobile

- Body copy: 17px minimum.
- Metadata labels: 13px minimum.
- Buttons/tap targets: 44px minimum height.
- Cards should stack cleanly.

## Gold Button Rule

Gold/orange CTAs are part of the brand and should stay.

However, gold is a mid-value background. Faint or lightweight lettering can become hard to see.

Required:

- Keep gold background.
- Use dark ink text.
- Use bold or extra-bold weight.
- Use full opacity.
- Avoid text-shadow.
- Minimum 44px height.

Canonical treatment:

```css
color: #1c1814;
font-weight: 800;
opacity: 1;
min-height: 44px;
```

## Dark Background Rule

Dark premium sections may remain dark.

Required:

- Main text: near-cream at 95–100% opacity.
- Secondary text: cream/stone at 88–95% opacity.
- Avoid tiny low-opacity labels.
- Avoid `text-white/60`, `text-rg-cream2/60`, and similar faint treatments for meaningful copy.

## Layout Rule

Use available desktop width where it improves readability.

- Reports and dashboards may use 1200–1500px desktop width.
- Do not force long editorial reports into narrow blog columns.
- Increase font size first, then widen layout where useful.

## PR Acceptance Criteria

Reject if:

- Gold buttons have light/faint text.
- Meaningful copy is below 16px on desktop.
- Meaningful copy is below 17px on mobile.
- Dark panels use low-opacity text for important information.
- Buttons are below 44px tap height.
- Cards remain cramped on mobile.

Accept if:

- The RevisionGrade palette remains intact.
- Gold buttons pop through dark bold text.
- Long reports are easier to read.
- Mobile users can read and tap without zooming.
- The site still feels premium, literary, and editorial.
