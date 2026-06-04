export type PricingProductKind = "evaluation" | "revise";

export interface PricingProduct {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  kind: PricingProductKind;
  destination: string;
  stripePriceEnv?: string;
}

export const PRICING_PRODUCTS: Record<string, PricingProduct> = {
  short_form_evaluation: {
    id: "short_form_evaluation",
    name: "Short-Form Story Evaluation",
    description: "Up to 24,999 words. 13 story criteria plus readiness verdict.",
    priceCents: 4900,
    kind: "evaluation",
    destination: "/evaluate",
    stripePriceEnv: "STRIPE_PRICE_SHORT_FORM_EVALUATION",
  },
  full_manuscript_audit: {
    id: "full_manuscript_audit",
    name: "Full Manuscript Readiness Audit",
    description: "25,000-120,000 words. Diagnostic report plus prioritized Revise Queue.",
    priceCents: 24900,
    kind: "evaluation",
    destination: "/evaluate",
    stripePriceEnv: "STRIPE_PRICE_FULL_MANUSCRIPT_AUDIT",
  },
  long_manuscript_audit: {
    id: "long_manuscript_audit",
    name: "Long Manuscript Readiness Audit",
    description: "120,001-180,000 words. Expanded long-form readiness evaluation.",
    priceCents: 39900,
    kind: "evaluation",
    destination: "/evaluate",
    stripePriceEnv: "STRIPE_PRICE_LONG_MANUSCRIPT_AUDIT",
  },
  multilayer_manuscript_audit: {
    id: "multilayer_manuscript_audit",
    name: "Multi-Layer Manuscript Audit",
    description: "Complex long-form projects with layered architecture analysis.",
    priceCents: 49900,
    kind: "evaluation",
    destination: "/evaluate",
    stripePriceEnv: "STRIPE_PRICE_MULTILAYER_MANUSCRIPT_AUDIT",
  },
  regrade_follow_up: {
    id: "regrade_follow_up",
    name: "ReGrade Follow-Up Pass",
    description: "Re-evaluation after revisions with updated scores and next opportunities.",
    priceCents: 14900,
    kind: "evaluation",
    destination: "/evaluate",
    stripePriceEnv: "STRIPE_PRICE_REGRADE_FOLLOW_UP",
  },
  revise_starter_pack: {
    id: "revise_starter_pack",
    name: "Starter Pack",
    description: "Targeted Editorial Actions for the Revise Queue.",
    priceCents: 2900,
    kind: "revise",
    destination: "/workbench-v2",
    stripePriceEnv: "STRIPE_PRICE_REVISE_STARTER_PACK",
  },
  revise_professional_pack: {
    id: "revise_professional_pack",
    name: "Professional Pack",
    description: "Expanded Editorial Actions for the Revise Queue.",
    priceCents: 8900,
    kind: "revise",
    destination: "/workbench-v2",
    stripePriceEnv: "STRIPE_PRICE_REVISE_PROFESSIONAL_PACK",
  },
  revise_studio_pack: {
    id: "revise_studio_pack",
    name: "Studio Pack",
    description: "Studio Editorial Actions for the Revise Queue.",
    priceCents: 19900,
    kind: "revise",
    destination: "/workbench-v2",
    stripePriceEnv: "STRIPE_PRICE_REVISE_STUDIO_PACK",
  },
};

export function getPricingProduct(productId: string): PricingProduct | null {
  return PRICING_PRODUCTS[productId] ?? null;
}

export function getConfiguredStripePriceId(product: PricingProduct): string | null {
  if (!product.stripePriceEnv) return null;
  return process.env[product.stripePriceEnv]?.trim() || null;
}
