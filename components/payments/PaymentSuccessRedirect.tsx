"use client";

import { useEffect } from "react";
import Link from "next/link";

interface PaymentSuccessRedirectProps {
  destination: string;
  sessionId: string;
  productName: string;
}

export default function PaymentSuccessRedirect({ destination, sessionId, productName }: PaymentSuccessRedirectProps) {
  const target = `${destination}?payment=success&session_id=${encodeURIComponent(sessionId)}`;

  useEffect(() => {
    const id = window.setTimeout(() => {
      window.location.href = target;
    }, 2400);

    return () => window.clearTimeout(id);
  }, [target]);

  return (
    <main className="min-h-screen bg-rg-ink px-6 py-20 text-rg-cream">
      <section className="mx-auto max-w-2xl border border-rg-gold/35 bg-rg-ink2/70 p-8 text-center shadow-2xl shadow-black/30">
        <p className="font-rg-mono text-xs uppercase tracking-[0.24em] text-rg-gold">RevisionGrade Checkout</p>
        <h1 className="mt-5 font-rg-serif text-4xl leading-tight text-rg-cream sm:text-5xl">Thank you for getting RevisionGraded™.</h1>
        <p className="mt-5 text-base leading-8 text-rg-cream2/85">
          Your payment for {productName} was successful. We are opening your RevisionGrade product now.
        </p>
        <div className="mt-8">
          <Link href={target} className="inline-block border border-rg-gold bg-rg-gold px-6 py-3 font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-ink transition hover:bg-transparent hover:text-rg-gold">
            Continue Now
          </Link>
        </div>
      </section>
    </main>
  );
}
