import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

type StripeEvent = {
  id: string;
  type: string;
  created?: number;
  data?: {
    object?: Record<string, unknown>;
  };
};

function parseStripeSignature(header: string | null): { t: string; v1: string[] } | null {
  if (!header) return null;
  const pairs = header.split(',').map((part) => part.trim());
  const t = pairs.find((p) => p.startsWith('t='))?.slice(2) ?? '';
  const v1 = pairs.filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!t || v1.length === 0) return null;
  return { t, v1 };
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verifyStripeSignature(rawBody: string, signatureHeader: string | null, secret: string): boolean {
  const parsed = parseStripeSignature(signatureHeader);
  if (!parsed) return false;

  const timestamp = Number(parsed.t);
  if (!Number.isFinite(timestamp)) return false;

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) return false;

  const signedPayload = `${parsed.t}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');

  return parsed.v1.some((candidate) => timingSafeEqualHex(expected, candidate));
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null;
}

function asNumber(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function metadata(obj: Record<string, unknown>): Record<string, unknown> {
  const raw = obj.metadata;
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function toRevenueInsert(event: StripeEvent): Record<string, unknown> | null {
  const obj = (event.data?.object ?? {}) as Record<string, unknown>;
  const md = metadata(obj);

  const base = {
    stripe_event_id: event.id,
    source: 'stripe',
    currency: (asString(obj.currency) ?? 'usd').toLowerCase(),
    stripe_payment_intent_id: asString(obj.payment_intent),
    stripe_checkout_session_id: asString(obj.id),
    stripe_customer_id: asString(obj.customer),
    user_id: asString(md.user_id),
    job_id: asString(md.job_id),
    manuscript_id: asString(md.manuscript_id),
    product_code: asString(md.product_code) ?? asString(md.product_id),
    tier: asString(md.tier) ?? asString(md.product_kind),
    metadata: {
      stripe_type: event.type,
      stripe_created_unix: event.created ?? null,
      ...md,
    },
  };

  if (event.type === 'checkout.session.completed') {
    const gross = asNumber(obj.amount_total);
    return {
      ...base,
      event_type: 'checkout_completed',
      gross_revenue_cents: gross,
      stripe_fee_cents: 0,
      refund_cents: 0,
    };
  }

  if (event.type === 'payment_intent.succeeded') {
    const gross = asNumber(obj.amount_received || obj.amount);
    return {
      ...base,
      event_type: 'payment_succeeded',
      gross_revenue_cents: gross,
      stripe_fee_cents: 0,
      refund_cents: 0,
      stripe_checkout_session_id: asString(md.stripe_checkout_session_id),
    };
  }

  if (event.type === 'charge.refunded') {
    const refund = asNumber(obj.amount_refunded || obj.amount);
    return {
      ...base,
      event_type: 'refund',
      gross_revenue_cents: 0,
      stripe_fee_cents: 0,
      refund_cents: refund,
      stripe_payment_intent_id: asString(obj.payment_intent),
      stripe_checkout_session_id: asString(md.stripe_checkout_session_id),
    };
  }

  if (event.type === 'charge.dispute.created') {
    const chargeback = asNumber(obj.amount);
    return {
      ...base,
      event_type: 'chargeback',
      gross_revenue_cents: 0,
      stripe_fee_cents: 0,
      refund_cents: chargeback,
      stripe_payment_intent_id: asString(obj.payment_intent),
      stripe_checkout_session_id: asString(md.stripe_checkout_session_id),
    };
  }

  return null;
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    return NextResponse.json({ success: false, error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 });
  }

  const rawBody = await req.text();
  const signatureHeader = req.headers.get('stripe-signature');

  if (!verifyStripeSignature(rawBody, signatureHeader, webhookSecret)) {
    return NextResponse.json({ success: false, error: 'Invalid Stripe signature' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON payload' }, { status: 400 });
  }

  const row = toRevenueInsert(event);
  if (!row) {
    return NextResponse.json({ success: true, ignored: true });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('revenue_events')
    .upsert(row, { onConflict: 'stripe_event_id', ignoreDuplicates: true });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
