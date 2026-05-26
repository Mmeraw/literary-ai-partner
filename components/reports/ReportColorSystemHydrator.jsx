"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TONES = {
  high: {
    background: "#ecfdf5",
    color: "#14532d",
    border: "#86efac",
  },
  moderate: {
    background: "#fffbeb",
    color: "#78350f",
    border: "#f59e0b",
  },
  low: {
    background: "#fef2f2",
    color: "#991b1b",
    border: "#fca5a5",
  },
};

function scoreTone(score, denominator = 10) {
  if (!Number.isFinite(score)) return null;
  const pct = denominator > 0 ? (score / denominator) * 100 : score;
  if (pct >= 80) return TONES.high;
  if (pct >= 60) return TONES.moderate;
  return TONES.low;
}

function confidenceTone(text) {
  const normalized = String(text || "").toLowerCase();
  if (normalized.includes("high")) return TONES.high;
  if (normalized.includes("moderate") || normalized.includes("medium")) return TONES.moderate;
  if (normalized.includes("low")) return TONES.low;
  return null;
}

function applyPillStyle(el, tone) {
  if (!el || !tone || el.dataset.rgToneApplied === "true") return;
  el.dataset.rgToneApplied = "true";
  el.style.display = "inline-flex";
  el.style.alignItems = "center";
  el.style.width = "fit-content";
  el.style.maxWidth = "100%";
  el.style.border = `1px solid ${tone.border}`;
  el.style.backgroundColor = tone.background;
  el.style.color = tone.color;
  el.style.borderRadius = "999px";
  el.style.padding = "0.22rem 0.62rem";
  el.style.fontWeight = "700";
  el.style.lineHeight = "1.35";
}

function applyCardTone(el, tone) {
  const card = el?.closest?.(".rounded.border");
  if (!card || !tone || card.dataset.rgCardToneApplied === "true") return;
  card.dataset.rgCardToneApplied = "true";
  card.style.borderColor = tone.border;
  card.style.background = `linear-gradient(180deg, ${tone.background} 0%, #ffffff 34%)`;
}

function applyReportColorSystem() {
  const reportRoot = document.querySelector(".min-h-screen.bg-gray-50");
  if (!reportRoot) return;

  const textNodes = reportRoot.querySelectorAll("p, span, li");
  textNodes.forEach((el) => {
    const text = el.textContent?.trim() || "";

    const confidenceMatch = text.match(/^Confidence:\s*(High|Moderate|Medium|Low)\b/i);
    if (confidenceMatch) {
      const tone = confidenceTone(confidenceMatch[1]);
      applyPillStyle(el, tone);
      applyCardTone(el, tone);
      return;
    }

    const scoreMatch = text.match(/^Score:\s*(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+))?/i);
    if (scoreMatch) {
      const score = Number(scoreMatch[1]);
      const denominator = scoreMatch[2] ? Number(scoreMatch[2]) : 10;
      const tone = scoreTone(score, denominator);
      applyPillStyle(el, tone);
      applyCardTone(el, tone);
    }
  });
}

export default function ReportColorSystemHydrator() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname?.startsWith("/reports/")) return;
    applyReportColorSystem();

    const observer = new MutationObserver(() => applyReportColorSystem());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return null;
}
