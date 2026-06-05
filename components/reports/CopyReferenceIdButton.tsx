"use client";

import { useState } from "react";

type CopyReferenceIdButtonProps = {
  value: string;
  className?: string;
};

export default function CopyReferenceIdButton({ value, className }: CopyReferenceIdButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className={className}
      aria-label={`Copy reference ID ${value}`}
      title={copied ? "Copied" : "Copy reference ID"}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}