import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { getConfiguredStripePriceId, getPricingProduct } from "@/lib/payments/pricing-products";
import { enforceApiRateLimit } from "@/lib/security/apiRateLimit";

export const runtime = "nodejs";

function resolveOrigin(req: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (configured) {
    const withProtocol = configured.startsWith("http") ? configured : `https://${configured}`;
    return withProtocol.replace(/\/$/, "");
  }

  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost || req.headers.get("host") || "revisiongrade.com";
  const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
  return `${forwardedProto}://${host}`;
}

function stripeAuthHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

export async function POST(req: NextRequest) {
  const rateLimitDenied = enforceApiRateLimit(req, {
    bucket: "payments_checkout",
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (rateLimitDenied) return rateLimitDenied;

  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    return NextResponse.json({ error: "Checkout is temporarily unavailable." }, { status: 500 });
  }

  let productId: string | null = null;
  let jobId: string | null = null;
  let manuscriptId: string | null = null;
  let tier: string | null = null;
  try {
    const body = await req.json();
    productId = typeof body.productId === "string" ? body.productId : null;
    jobId = typeof body.jobId === "string" ? body.jobId : null;
    manuscriptId = typeof body.manuscriptId === "string" ? body.manuscriptId : null;
    tier = typeof body.tier === "string" ? body.tier : null;
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }

  if (!productId) {
    return NextResponse.json({ error: "Missing productId." }, { status: 400 });
  }

  const product = getPricingProduct(productId);
  if (!product) {
    return NextResponse.json({ error: "Unknown pricing product." }, { status: 400 });
  }

  try {
    const user = await getAuthenticatedUser();
    const origin = resolveOrigin(req);
    const params = new URLSearchParams();
    const configuredPriceId = getConfiguredStripePriceId(product);

    params.set("mode", "payment");
    params.set("success_url", `${origin}/payments/success?session_id={CHECKOUT_SESSION_ID}`);
    params.set("cancel_url", `${origin}/pricing?checkout=cancelled&product=${encodeURIComponent(product.id)}`);
    params.set("allow_promotion_codes", "true");
    params.set("billing_address_collection", "auto");
    params.set("line_items[0][quantity]", "1");
    params.set("client_reference_id", user?.id ?? product.id);
    params.set("metadata[product_id]", product.id);
    params.set("metadata[product_code]", product.id);
    params.set("metadata[product_name]", product.name);
    params.set("metadata[product_kind]", product.kind);
    params.set("metadata[destination]", product.destination);
    params.set("metadata[tier]", tier ?? product.id);
    params.set("metadata[user_id]", user?.id ?? "anonymous");
    if (jobId) params.set("metadata[job_id]", jobId);
    if (manuscriptId) params.set("metadata[manuscript_id]", manuscriptId);

    if (user?.email) {
      params.set("customer_email", user.email);
    }

    if (configuredPriceId) {
      params.set("line_items[0][price]", configuredPriceId);
    } else {
      params.set("line_items[0][price_data][currency]", "usd");
      params.set("line_items[0][price_data][unit_amount]", String(product.priceCents));
      params.set("line_items[0][price_data][product_data][name]", product.name);
      params.set("line_items[0][price_data][product_data][description]", product.description);
      params.set("line_items[0][price_data][product_data][metadata][product_id]", product.id);
    }

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: stripeAuthHeader(secretKey),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    const session = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: "Unable to start checkout session." }, { status: response.status });
    }

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL." }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({ error: "Unable to start checkout." }, { status: 500 });
  }
}
