/**
 * Shared editorial recommendation marker contract.
 *
 * Canonical source for regex markers consumed by both:
 * - Pass 3 recommendation normalization/repair
 * - Pass 4 deterministic editorial quality gate
 */

export const EDITORIAL_SYMPTOM_MARKERS =
  /\b(lacks?|missing|unclear|confus(?:ed|ing)?|flat|generic|drag(?:s|ging)?|repetit(?:ion|ive)|abrupt|weak|underdeveloped|overwritten|diffuse|stalled|not\s+yet|fails?|without|problem|issue|stakes?|tension|motivation|cause|effect|consequence)\b/i;

export const EDITORIAL_FIX_MARKERS =
  /\b(rewrite|replace|cut|trim|split|merge|move|reorder|expand|compress|clarify|specify|anchor|insert|delete|foreshadow|escalate|tighten|seed|stage|show|name|shift|ground(?:ing)?|contextualize|reframe|focus|connect|link|develop|resolve|surface|thread|motivate|concretize|externalize|recast|frontload|backload|echo|contrast)\b/i;

export const EDITORIAL_CONTEXT_MARKERS =
  /\b(scene|line|sentence|paragraph|chapter|beat|moment|exchange|opening|ending|turn|pivot|section|passage|hook|callback|setup|payoff|clause|image|gesture|motif)\b/i;

export const EDITORIAL_ANCHOR_HINT_MARKERS =
  /\b(opening|midpoint|climax|first|last|second|third|next|previous|following)\s+(scene|paragraph|line|beat|chapter|section|sentence)\b|\b(paragraph|line|scene|chapter|section|sentence)\s+\d+\b/i;

export const EDITORIAL_MECHANISM_MARKERS =
  /\b(because|since|so\s+that|thereby|to\s+avoid|prevent(?:s|ing)?|caus(?:e|es|ing)|effect|by\s+\w+ing|which\s+(?:helps|lets|allows)|to\s+(prime|clarify|signal|restore|heighten|increase|reduce|anchor|focus|separate|differentiate|escalate|tighten))\b/i;

export const EDITORIAL_READER_EFFECT_MARKERS =
  /\b(reader|readers|clarity|comprehension|urgency|momentum|immersion|engagement|stakes|tension|payoff|coherence|trust)\b/i;
