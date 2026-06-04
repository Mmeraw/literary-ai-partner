import Link from "next/link";
import PaymentSuccessRedirect from "@/components/payments/PaymentSuccessRedirect";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PaymentSuccessPageProps {
  searchParams: Promise<{ session_id?: string }>;
}

function stripeAuthHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

function safeDestination(value: unknown): string {
  if (value === "/evaluate" || value === "/workbench-v2") return value;
  return "/dashboard";
}

function safeProductName(value: unknown): string {
  return typeof value === "string" && value.trim() ? value : "RevisionGrade";
}

export default async function PaymentSuccessPage({ searchParams }: PaymentSuccessPageProps) {
  const { session_id: sessionId } = await searchParams;
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();

  if (!sessionId || !secretKey) {
    return <PaymentFallback message="We could not verify this payment session yet." />;
  }

  const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: stripeAuthHeader(secretKey) },
    cache: "no-store",
  });

  if (!response.ok) {
    return <PaymentFallback message="Stripe could not verify this payment session yet." />;
  }

  const session = await response.json();
  if (session.payment_status !== "paid") {
    return <PaymentFallback message="This checkout session is not marked paid yet." />;
  }

  return (
    <PaymentSuccessRedirect
      destination={safeDestination(session.metadata?.destination)}
      sessionId={sessionId}
      productName={safeProductName(session.metadata?.product_name)}
    />
  );
}

function PaymentFallback({ message }: { message: string }) {
  return (
    <main className="min-h-screen bg-rg-ink px-6 py-20 text-rg-cream">
      <section className="mx-auto max-w-2xl border border-rg-gold/35 bg-rg-ink2/70 p-8 text-center">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">RevisionGrade Checkout</p>
        <h1 className="mt-5 font-rg-serif text-4xl leading-tight text-rg-cream">Thank you for getting RevisionGraded™.</h1>
        <p className="mt-5 text-base leading-8 text-rg-cream2/80">{message}</p>
        <p className="mt-3 text-base leading-8 text-rg-cream2/80">
          If your card was charged, your Stripe receipt is the source of truth. You can continue into the product from here.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-4 font-rg-mono text-xs uppercase tracking-[0.16em]">
          <Link href="/evaluate" className="border border-rg-gold bg-rg-gold px-5 py-3 text-rg-ink transition hover:bg-transparent hover:text-rg-gold">Open Evaluate</Link>
          <Link href="/workbench-v2" className="border border-rg-cream2/25 px-5 py-3 text-rg-cream transition hover:border-rg-gold hover:text-rg-gold">Open Revise Queue</Link>
        </div>
      </section>
    </main>
  );
}
