"use client";

import { useState } from "react";
import Link from "next/link";

interface PricingCheckoutButtonProps {
  productId?: string;
  href?: string;
  children: React.ReactNode;
  className: string;
}

export default function PricingCheckoutButton({ productId, href, children, className }: PricingCheckoutButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mt-7">
      {productId ? (
        <button type="button" onClick={startCheckout} disabled={loading} className={`${className} w-full disabled:cursor-wait disabled:opacity-70`}>
          {loading ? "Opening Secure Checkout..." : children}
        </button>
      ) : href ? (
        <Link href={href} className={className}>{children}</Link>
      ) : null}
      {error && <p className="mt-3 text-center text-sm leading-6 text-red-300">{error}</p>}
    </div>
  );
}
