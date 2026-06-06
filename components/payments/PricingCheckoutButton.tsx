"use client";

import { useState } from "react";
import Link from "next/link";

interface PricingCheckoutButtonProps {
  productId?: string;
  href?: string;
  children: React.ReactNode;
  className: string;
}

const acknowledgmentItems = [
  "I understand that RevisionGrade evaluates full manuscripts, partial manuscripts, individual chapters, and serious narrative excerpts.",
  "I understand that RevisionGrade does not evaluate letters, resumes, academic papers, contracts, marketing copy, synopses, query letters, or author biographies.",
  "I understand that unsupported document types may be rejected before evaluation begins.",
];

export default function PricingCheckoutButton({ productId, href, children, className }: PricingCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAcknowledgment, setShowAcknowledgment] = useState(false);
  const [acceptedItems, setAcceptedItems] = useState<boolean[]>(acknowledgmentItems.map(() => false));

  const allAccepted = acceptedItems.every(Boolean);

  function toggleAccepted(index: number) {
    setAcceptedItems((current) => current.map((value, itemIndex) => (itemIndex === index ? !value : value)));
    setError(null);
  }

  async function startCheckout() {
    if (!productId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/payments/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Checkout is unavailable right now.");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout is unavailable right now.");
      setLoading(false);
    }
  }

  function handlePurchaseClick() {
    if (!productId) return;
    setError(null);
    setShowAcknowledgment(true);
  }

  function closeAcknowledgment() {
    if (loading) return;
    setShowAcknowledgment(false);
  }

  return (
    <div className="mt-7">
      {productId ? (
        <button type="button" onClick={handlePurchaseClick} disabled={loading} className={`${className} w-full disabled:cursor-wait disabled:opacity-70`}>
          {loading ? "Opening Secure Checkout..." : children}
        </button>
      ) : href ? (
        <Link href={href} className={className}>{children}</Link>
      ) : null}

      {showAcknowledgment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="purchase-acknowledgment-title">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-rg-gold/40 bg-rg-cream p-6 text-rg-ink shadow-2xl md:p-8">
            <p className="font-rg-mono text-xs uppercase tracking-[0.22em] text-rg-gold">Before you purchase</p>
            <h2 id="purchase-acknowledgment-title" className="mt-3 font-rg-serif text-3xl leading-tight md:text-4xl">
              Confirm RevisionGrade is the right evaluation product.
            </h2>
            <p className="mt-4 text-sm leading-7 text-rg-ink/75 md:text-base">
              RevisionGrade evaluates full manuscripts, partial manuscripts, individual chapters, and serious narrative excerpts. It does not evaluate general documents, correspondence, resumes, academic papers, contracts, marketing copy, query letters, synopses, or author biographies.
            </p>
            <p className="mt-3 text-sm leading-7 text-rg-ink/75 md:text-base">
              Agent Readiness™ may help create or prepare query letters, synopses, author biographies, and submission materials, but those materials are not evaluated through the manuscript-evaluation engine.
            </p>

            <div className="mt-6 space-y-3">
              {acknowledgmentItems.map((item, index) => (
                <label key={item} className="flex gap-3 rounded-xl border border-rg-ink/15 bg-white/70 p-4 text-left text-sm leading-6 text-rg-ink/85">
                  <input
                    type="checkbox"
                    checked={acceptedItems[index]}
                    onChange={() => toggleAccepted(index)}
                    disabled={loading}
                    className="mt-1 h-5 w-5 shrink-0 accent-rg-gold"
                  />
                  <span>{item}</span>
                </label>
              ))}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeAcknowledgment}
                disabled={loading}
                className="border border-rg-ink/25 px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-ink transition hover:border-rg-gold hover:text-rg-gold disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={startCheckout}
                disabled={loading || !allAccepted}
                className="border border-rg-ink bg-rg-ink px-5 py-3 font-rg-mono text-xs uppercase tracking-[0.16em] text-rg-cream transition hover:bg-transparent hover:text-rg-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Opening Secure Checkout..." : "Accept and Continue Purchase"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-center text-sm leading-6 text-red-300">{error}</p>}
    </div>
  );
}
