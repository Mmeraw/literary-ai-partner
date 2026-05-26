"use client";

/**
 * Pitch Builder
 * - Elevator Pitch: one sentence
 * - Paragraph Pitch: one compact paragraph
 */

import Link from "next/link";
import React, { useState } from "react";
import PackageSectionsSidebar from "../PackageSectionsSidebar";

// ─── Web Speech API mic input ───────────────────────────────────────────────

type SpeechState = "idle" | "listening" | "error";

function useSpeechInput(setValue: React.Dispatch<React.SetStateAction<string>>) {
  const [state, setState] = React.useState<SpeechState>("idle");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = React.useRef<any>(null);
  const supported = typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const toggle = React.useCallback(() => {
    if (state === "listening") {
      recRef.current?.stop();
      setState("idle");
      return;
    }
    if (!supported) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = Array.from(e.results as ArrayLike<any>).map((r: any) => r[0].transcript).join(" ").trim();
      if (t) setValue(prev => prev ? prev + " " + t : t);
    };
    rec.onerror = () => setState("error");
    rec.onend = () => setState("idle");
    recRef.current = rec;
    rec.start();
    setState("listening");
  }, [state, supported, setValue]);

  return { state, toggle, supported };
}

function MicButton({ setValue }: { setValue: React.Dispatch<React.SetStateAction<string>> }) {
  const { state, toggle, supported } = useSpeechInput(setValue);
  if (!supported) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      title={state === "listening" ? "Stop recording" : "Speak to fill this field"}
      style={{
        padding: "4px 10px",
        borderRadius: 6,
        border: `1px solid ${state === "listening" ? "rgba(122,30,30,0.6)" : "rgba(242,239,234,0.15)"}`,
        background: state === "listening" ? "rgba(122,30,30,0.22)" : "transparent",
        color: state === "listening" ? "#D07070" : state === "error" ? "#E6A23C" : "rgba(242,239,234,0.45)",
        fontSize: 12,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
      }}
    >
      {state === "listening" ? "⏹ Stop" : state === "error" ? "⚠ Retry" : "🎙 Speak"}
    </button>
  );
}

const T = {
  bg: "#0F0D0A", panel: "#1A1612", border: "#2A2420",
  gold: "#A98E4A", cream: "#F2EFEA", cream2: "#C8BFB0",
  dim: "#7B7060", ink: "#0E0E0E",
  serif: "'Playfair Display', 'Georgia', serif",
  mono: "'Inter', 'Courier New', monospace",
};

function downloadTxt(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const SAVE_BTN: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: "0.6875rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#7B7B7B",
  background: "transparent",
  border: "1px solid #7B7B7B",
  padding: "0.375rem 0.875rem",
  cursor: "pointer",
};

export default function PitchPage() {
  const [elevator,         setElevator]        = useState("");
  const [paragraph,        setParagraph]        = useState("");
  const [elevatorApproved, setElevatorApproved] = useState(false);
  const generatedPitch = [elevator, paragraph].filter(s => s.trim().length > 0).join("\n\n");

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.cream, fontFamily: T.mono }}>
      <div className="mx-auto grid max-w-[1220px] gap-8 px-6 py-12 lg:grid-cols-[260px_minmax(0,1fr)]">
        <PackageSectionsSidebar />
        <div style={{ maxWidth: "860px" }}>

        <p style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", marginBottom: "1.5rem" }}>
          <Link href="/agent-readiness" style={{ color: T.gold, textDecoration: "none" }}>Agent Readiness Package™</Link>
          {" "}/{" "}Pitch Builder
        </p>

        <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          04 — Elevator Pitch
        </p>
        <h1 style={{ fontFamily: T.serif, fontSize: "1.75rem", color: T.cream, marginBottom: "2rem" }}>
          Pitch Builder
        </h1>

        {/* Elevator Pitch */}
        <div style={{ marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <label style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Elevator Pitch — one sentence
            </label>
            <MicButton setValue={setElevator} />
          </div>
          <p style={{ fontSize: "0.75rem", color: T.cream2, lineHeight: 1.6, marginBottom: "0.875rem" }}>
            A compact, high-impact sentence suitable for query forms, verbal pitching, and manuscript metadata.
          </p>
          <textarea
            value={elevator}
            onChange={(e) => { setElevator(e.target.value); setElevatorApproved(false); }}
            rows={3}
            placeholder="[TITLE] is a [genre] novel in which [protagonist] must [central conflict] or [stakes]."
            style={{
              width: "100%", fontFamily: T.mono, fontSize: "0.8125rem", color: T.cream,
              backgroundColor: T.panel, border: `1px solid ${T.border}`,
              padding: "0.875rem", resize: "none", outline: "none", lineHeight: 1.65,
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            {["Generate", "Regenerate", "Improve", "Copy"].map(label => (
              <button key={label} style={{
                fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                backgroundColor: label === "Generate" ? T.gold : "transparent",
                color: label === "Generate" ? T.ink : T.cream2,
                border: label === "Generate" ? "none" : `1px solid ${T.border}`,
                padding: "0.5rem 1rem", cursor: "pointer",
              }}>{label}</button>
            ))}
            <button
              onClick={() => elevator.trim().length > 10 && setElevatorApproved(true)}
              disabled={elevator.trim().length < 10}
              style={{
                fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                backgroundColor: elevatorApproved ? "#5A8A5A" : "transparent",
                color: elevatorApproved ? "#F2EFEA" : "#5A8A5A",
                border: `1px solid ${elevator.trim().length < 10 ? T.border : "#5A8A5A"}`,
                padding: "0.5rem 1rem",
                cursor: elevator.trim().length < 10 ? "not-allowed" : "pointer",
                opacity: elevator.trim().length < 10 ? 0.4 : 1,
              }}
            >
              {elevatorApproved ? "✓ Approved" : "Lock / Approve"}
            </button>
          </div>
        </div>

        {/* Paragraph Pitch */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <label style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Paragraph Pitch <span style={{ color: "#7B7060", fontWeight: 400 }}>(optional — for email, networking, query forms)</span>
            </label>
            <MicButton setValue={setParagraph} />
          </div>
          <p style={{ fontSize: "0.75rem", color: T.cream2, lineHeight: 1.6, marginBottom: "0.875rem" }}>
            One compact paragraph suitable for email queries, agent networking, and package summaries.
          </p>
          <textarea
            value={paragraph}
            onChange={(e) => setParagraph(e.target.value)}
            rows={6}
            placeholder="Expand the elevator pitch into a short paragraph with the hook, the core conflict, the stakes, and the market positioning."
            style={{
              width: "100%", fontFamily: T.mono, fontSize: "0.8125rem", color: T.cream,
              backgroundColor: T.panel, border: `1px solid ${T.border}`,
              padding: "0.875rem", resize: "vertical", outline: "none", lineHeight: 1.65,
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            {["Generate", "Regenerate", "Improve", "Copy"].map(label => (
              <button key={label} style={{
                fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                backgroundColor: label === "Generate" ? T.gold : "transparent",
                color: label === "Generate" ? T.ink : T.cream2,
                border: label === "Generate" ? "none" : `1px solid ${T.border}`,
                padding: "0.5rem 1rem", cursor: "pointer",
              }}>{label}</button>
            ))}
          </div>
        </div>

        {generatedPitch && (
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.5rem", marginBottom: "1rem" }}>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(generatedPitch)}
              style={SAVE_BTN}
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => downloadTxt("author-pitch.txt", generatedPitch)}
              style={SAVE_BTN}
            >
              Save .txt
            </button>
          </div>
        )}

        <div style={{ marginTop: "2rem" }}>
          <Link href="/agent-readiness" style={{ fontFamily: T.mono, fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textDecoration: "none" }}>
            ← Back to Package Overview
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
