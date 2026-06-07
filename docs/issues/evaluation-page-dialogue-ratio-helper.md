# Evaluation page: explain Dialogue/Narrative Ratio

## Problem

On the running evaluation page, the metadata block displays:

> Dialogue/Narrative Ratio  
> 5% dialogue / 94% narrative

This is useful, but currently unexplained. Users may not understand why RevisionGrade measures it or how to interpret it.

Marlowe-style reports explain why metrics matter. RevisionGrade should do the same.

## Target file

`app/evaluate/[jobId]/page.tsx`

The relevant render block is the `<dl>` metadata grid. Current line resembles:

```tsx
<div><dt className="font-semibold text-stone-950">Dialogue/Narrative Ratio</dt><dd className="text-stone-700">{canonicalDoc?.titleBlock.dialogueNarrativeRatio ?? ((artifact?.enrichment?.dialogue_percentage ?? instantDialoguePercentage) != null ? `${Math.floor(Number(artifact?.enrichment?.dialogue_percentage ?? instantDialoguePercentage))}% dialogue / ${Math.floor(Number(artifact?.enrichment?.narrative_percentage ?? instantNarrativePercentage ?? 100 - (artifact?.enrichment?.dialogue_percentage ?? instantDialoguePercentage ?? 0)))}% narrative` : 'Not available')}</dd></div>
```

## Required change

Convert that one-line `<div>` into a multi-line block with a short explanatory helper paragraph under the ratio.

Recommended copy:

> This helps estimate the manuscript’s reading texture: how much is carried by spoken exchange versus narration, interiority, summary, description, and action. It is not a score by itself; it is a pacing and style signal.

## Suggested JSX

```tsx
<div>
  <dt className="font-semibold text-stone-950">Dialogue/Narrative Ratio</dt>
  <dd className="text-stone-700">
    {canonicalDoc?.titleBlock.dialogueNarrativeRatio ?? ((artifact?.enrichment?.dialogue_percentage ?? instantDialoguePercentage) != null ? `${Math.floor(Number(artifact?.enrichment?.dialogue_percentage ?? instantDialoguePercentage))}% dialogue / ${Math.floor(Number(artifact?.enrichment?.narrative_percentage ?? instantNarrativePercentage ?? 100 - (artifact?.enrichment?.dialogue_percentage ?? instantDialoguePercentage ?? 0)))}% narrative` : 'Not available')}
  </dd>
  <dd className="mt-1 text-xs leading-5 text-stone-500">
    This helps estimate the manuscript’s reading texture: how much is carried by spoken exchange versus narration, interiority, summary, description, and action. It is not a score by itself; it is a pacing and style signal.
  </dd>
</div>
```

## Acceptance criteria

- The helper text appears directly under Dialogue/Narrative Ratio on `/evaluate/[jobId]` while an evaluation is running and after completion.
- It does not expose internal phases, passes, prompts, or pipeline mechanics.
- It is visible on mobile and laptop layouts.
- It does not make the ratio sound like a pass/fail judgment.

## Related FAQ update

A public FAQ entry was added in `app/faq/page.tsx` explaining why RevisionGrade shows the dialogue/narrative ratio.
