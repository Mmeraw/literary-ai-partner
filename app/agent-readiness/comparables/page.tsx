"use client";

/**
 * Comparables & Positioning
 *
 * Generates:
 * - 2–4 primary comparable titles
 * - Why each comp fits (tone, genre, structure, premise, audience)
 * - How the manuscript differentiates
 * - Query-letter comp sentence (auto-inserted into Query Letter)
 * - Genre Lane
 * - Reader Audience
 * - Market Positioning Statement
 * - Agent Appeal Brief (Distinctive Hook · Agent Appeal · Reader Appetite · Comparable Shelf · Why Now · Positioning Statement)
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

type Comp = { title: string; author: string; why: string; differentiator: string };

const EMPTY_COMP: Comp = { title: "", author: "", why: "", differentiator: "" };

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

export default function ComparablesPage() {
  const [comps,       setComps]       = useState<Comp[]>([{ ...EMPTY_COMP }, { ...EMPTY_COMP }]);
  const [genreLane,   setGenreLane]   = useState("");
  const [audience,    setAudience]    = useState("");
  const [positioning, setPositioning] = useState("");
  const [compSentence, setCompSentence] = useState("");
  const [appealBrief,  setAppealBrief]  = useState({
    hook:        "",
    agentAppeal: "",
    readerAppetite: "",
    compShelf:   "",
    whyNow:      "",
    positioning: "",
  });
  const [approved, setApproved] = useState(false);

  const generatedComps = (() => {
    const lines: string[] = [];
    comps.forEach((c, i) => {
      const filled = c.title || c.author || c.why || c.differentiator;
      if (!filled) return;
      lines.push(`Comp ${i + 1}`);
      if (c.title) lines.push(`Title: ${c.title}`);
      if (c.author) lines.push(`Author: ${c.author}`);
      if (c.why) lines.push(`Why this comp fits: ${c.why}`);
      if (c.differentiator) lines.push(`Differentiator: ${c.differentiator}`);
      lines.push("");
    });
    if (compSentence) lines.push(`Query Letter Comp Sentence:\n${compSentence}`, "");
    if (genreLane) lines.push(`Genre Lane: ${genreLane}`);
    if (audience) lines.push(`Reader Audience: ${audience}`);
    if (positioning) lines.push("", `Market Positioning Statement:\n${positioning}`);
    const briefEntries = Object.entries(appealBrief).filter(([, v]) => v && v.trim());
    if (briefEntries.length > 0) {
      lines.push("", "Agent Appeal Brief:");
      for (const [k, v] of briefEntries) lines.push(`  ${k}: ${v}`);
    }
    return lines.join("\n").trim();
  })();

  function updateComp(i: number, field: keyof Comp, value: string) {
    setComps(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: value }; return n; });
    setApproved(false);
  }

  const hasContent = comps.some(c => c.title.trim().length > 0);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.cream, fontFamily: T.mono }}>
      <div className="mx-auto grid max-w-[1240px] gap-8 px-6 py-12 lg:grid-cols-[260px_minmax(0,1fr)]">
        <PackageSectionsSidebar />
        <div style={{ maxWidth: "900px" }}>

        <p style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", marginBottom: "1.5rem" }}>
          <Link href="/agent-readiness" style={{ color: T.gold, textDecoration: "none" }}>Agent Readiness Package™</Link>
          {" "}/{" "}Comparables & Positioning
        </p>

        <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          05 — Comparables
        </p>
        <h1 style={{ fontFamily: T.serif, fontSize: "1.75rem", color: T.cream, marginBottom: "0.75rem" }}>
          Comparables & Positioning
        </h1>
        <p style={{ fontSize: "0.8125rem", color: T.cream2, lineHeight: 1.65, marginBottom: "2rem", maxWidth: "580px" }}>
          Comparables are market-positioning ammunition, not score comparison. They must feed the query letter, agent targeting rationale, and the "What Makes This Novel Unique" section.
        </p>

        {/* Generate CTA */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "2rem", flexWrap: "wrap" }}>
          <button style={{
            fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: T.gold, color: T.ink, border: "none",
            padding: "0.625rem 1.5rem", cursor: "pointer",
          }}>
            Build Comps for Query Package
          </button>
          <button style={{
            fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: "transparent", color: T.cream2,
            border: `1px solid ${T.border}`, padding: "0.625rem 1.25rem", cursor: "pointer",
          }}>
            Regenerate
          </button>
        </div>

        {/* Comp cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", marginBottom: "2rem" }}>
          {comps.map((comp, i) => {
            const setWhy: React.Dispatch<React.SetStateAction<string>> = (v) =>
              updateComp(i, "why", typeof v === "function" ? (v as (p: string) => string)(comp.why) : v);
            const setDiff: React.Dispatch<React.SetStateAction<string>> = (v) =>
              updateComp(i, "differentiator", typeof v === "function" ? (v as (p: string) => string)(comp.differentiator) : v);
            return (
            <div key={i} style={{ border: `1px solid ${T.border}`, padding: "1.25rem 1.5rem", backgroundColor: T.panel }}>
              <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.875rem" }}>
                Comp {i + 1} {i < 2 ? "(Primary)" : "(Optional Alternate)"}
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.5rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.375rem" }}>Title</label>
                  <input type="text" value={comp.title} onChange={(e) => updateComp(i, "title", e.target.value)}
                    placeholder="Book title" style={{ width: "100%", fontFamily: T.mono, fontSize: "0.75rem", color: T.cream, backgroundColor: T.bg, border: `1px solid ${T.border}`, padding: "0.5rem 0.625rem", outline: "none", boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.5rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.375rem" }}>Author</label>
                  <input type="text" value={comp.author} onChange={(e) => updateComp(i, "author", e.target.value)}
                    placeholder="Author name" style={{ width: "100%", fontFamily: T.mono, fontSize: "0.75rem", color: T.cream, backgroundColor: T.bg, border: `1px solid ${T.border}`, padding: "0.5rem 0.625rem", outline: "none", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ marginBottom: "0.625rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                  <label style={{ fontSize: "0.5rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>Why This Comp Fits</label>
                  <MicButton setValue={setWhy} />
                </div>
                <textarea value={comp.why} onChange={(e) => updateComp(i, "why", e.target.value)} rows={3}
                  placeholder="Tone, genre, structure, premise, audience, market lane..."
                  style={{ width: "100%", fontFamily: T.mono, fontSize: "0.75rem", color: T.cream, backgroundColor: T.bg, border: `1px solid ${T.border}`, padding: "0.5rem 0.625rem", resize: "none", outline: "none", lineHeight: 1.55, boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                  <label style={{ fontSize: "0.5rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>How This Manuscript Differentiates</label>
                  <MicButton setValue={setDiff} />
                </div>
                <textarea value={comp.differentiator} onChange={(e) => updateComp(i, "differentiator", e.target.value)} rows={2}
                  placeholder="Same shelf, fresh reason to care..."
                  style={{ width: "100%", fontFamily: T.mono, fontSize: "0.75rem", color: T.cream, backgroundColor: T.bg, border: `1px solid ${T.border}`, padding: "0.5rem 0.625rem", resize: "none", outline: "none", lineHeight: 1.55, boxSizing: "border-box" }} />
              </div>
            </div>
            );
          })}
          {comps.length < 4 && (
            <button onClick={() => setComps(prev => [...prev, { ...EMPTY_COMP }])} style={{
              fontFamily: T.mono, fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em",
              textTransform: "uppercase", background: "none", border: `1px dashed ${T.border}`,
              padding: "0.625rem", cursor: "pointer", textAlign: "center",
            }}>
              + Add Alternate Comp
            </button>
          )}
        </div>

        {/* Query letter comp sentence */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <label style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Query Letter Comp Sentence <span style={{ color: T.cream2, fontWeight: 400 }}>(auto-inserted into Query Letter)</span>
            </label>
            <MicButton setValue={setCompSentence} />
          </div>
          <textarea value={compSentence} onChange={(e) => { setCompSentence(e.target.value); setApproved(false); }} rows={3}
            placeholder="[TITLE] will appeal to readers of [Comp 1] and [Comp 2], combining [shared market signal] with [unique differentiator]."
            style={{ width: "100%", fontFamily: T.mono, fontSize: "0.8125rem", color: T.cream, backgroundColor: T.panel, border: `1px solid ${T.border}`, padding: "0.875rem", resize: "none", outline: "none", lineHeight: 1.65, boxSizing: "border-box" }} />
        </div>

        {/* Genre lane + audience */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
              <label style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>Genre Lane</label>
              <MicButton setValue={setGenreLane} />
            </div>
            <input type="text" value={genreLane} onChange={(e) => setGenreLane(e.target.value)}
              placeholder="e.g. Upmarket literary suspense"
              style={{ width: "100%", fontFamily: T.mono, fontSize: "0.8125rem", color: T.cream, backgroundColor: T.panel, border: `1px solid ${T.border}`, padding: "0.625rem 0.75rem", outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
              <label style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>Reader Audience</label>
              <MicButton setValue={setAudience} />
            </div>
            <input type="text" value={audience} onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. Adult literary fiction readers, crime/thriller crossover"
              style={{ width: "100%", fontFamily: T.mono, fontSize: "0.8125rem", color: T.cream, backgroundColor: T.panel, border: `1px solid ${T.border}`, padding: "0.625rem 0.75rem", outline: "none", boxSizing: "border-box" }} />
          </div>
        </div>

        {/* Market Positioning Statement */}
        <div style={{ marginBottom: "2rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <label style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>Market Positioning Statement</label>
            <MicButton setValue={setPositioning} />
          </div>
          <textarea value={positioning} onChange={(e) => setPositioning(e.target.value)} rows={4}
            placeholder="This manuscript combines [genre lane] with [distinctive hook], offering agents a commercially legible project with a clear audience, strong emotional engine, and marketable point of difference."
            style={{ width: "100%", fontFamily: T.mono, fontSize: "0.8125rem", color: T.cream, backgroundColor: T.panel, border: `1px solid ${T.border}`, padding: "0.875rem", resize: "vertical", outline: "none", lineHeight: 1.65, boxSizing: "border-box" }} />
        </div>

        {/* Agent Appeal Brief */}
        <div style={{ border: `1px solid ${T.gold}30`, padding: "1.5rem", marginBottom: "2rem", backgroundColor: "rgba(169,142,74,0.03)" }}>
          <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "1rem" }}>
            Agent Appeal Brief
          </p>
          {[
            { key: "hook",           label: "Distinctive Hook",   placeholder: "What makes this manuscript different from other books in the genre?" },
            { key: "agentAppeal",    label: "Agent Appeal",       placeholder: "The professional acquisition argument: voice, concept, market fit, execution, urgency." },
            { key: "readerAppetite", label: "Reader Appetite",    placeholder: "Why the public would want this story now." },
            { key: "compShelf",      label: "Comparable Shelf",   placeholder: "The market shelf and comparable titles signal." },
            { key: "whyNow",         label: "Why Now",            placeholder: "Cultural relevance, timeliness, or emotional urgency." },
            { key: "positioning",    label: "Positioning Statement", placeholder: "Concise market-facing summary connecting genre, audience, comps, and emotional promise." },
          ].map(({ key, label, placeholder }) => {
            const setBriefField: React.Dispatch<React.SetStateAction<string>> = (v) =>
              setAppealBrief(prev => ({ ...prev, [key]: typeof v === "function" ? (v as (p: string) => string)((prev as Record<string, string>)[key] ?? "") : v }));
            return (
            <div key={key} style={{ marginBottom: "0.875rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                <label style={{ fontSize: "0.5rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</label>
                <MicButton setValue={setBriefField} />
              </div>
              <textarea
                value={(appealBrief as any)[key]}
                onChange={(e) => setAppealBrief(prev => ({ ...prev, [key]: e.target.value }))}
                rows={2}
                placeholder={placeholder}
                style={{ width: "100%", fontFamily: T.mono, fontSize: "0.75rem", color: T.cream, backgroundColor: T.bg, border: `1px solid ${T.border}`, padding: "0.5rem 0.625rem", resize: "vertical", outline: "none", lineHeight: 1.55, boxSizing: "border-box" }}
              />
            </div>
            );
          })}
        </div>

        {generatedComps && (
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(generatedComps)}
              style={SAVE_BTN}
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => downloadTxt("author-comparables.txt", generatedComps)}
              style={SAVE_BTN}
            >
              Save .txt
            </button>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {["Copy", "Restore Version"].map(label => (
            <button key={label} style={{
              fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              backgroundColor: "transparent", color: T.cream2,
              border: `1px solid ${T.border}`, padding: "0.625rem 1.25rem", cursor: "pointer",
            }}>{label}</button>
          ))}
          <button
            onClick={() => hasContent && setApproved(true)}
            disabled={!hasContent}
            style={{
              fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              backgroundColor: approved ? "#5A8A5A" : "transparent",
              color: approved ? "#F2EFEA" : "#5A8A5A",
              border: `1px solid ${!hasContent ? T.border : "#5A8A5A"}`,
              padding: "0.625rem 1.25rem",
              cursor: hasContent ? "pointer" : "not-allowed",
              opacity: hasContent ? 1 : 0.4,
            }}
          >
            {approved ? "✓ Approved" : "Lock / Approve"}
          </button>
        </div>

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
