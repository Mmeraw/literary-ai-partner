"use client";

export default function PrintSavePdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded border border-[#8B5E1A] bg-[#FBF1DC] px-4 py-2 text-sm font-semibold text-[#7A5B12]"
    >
      Print / Save as PDF
    </button>
  );
}
