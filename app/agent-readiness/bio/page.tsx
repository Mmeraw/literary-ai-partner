"use client";

/**
 * Author Bio
 *
 * RULE: The system must not invent author credentials.
 * The author bio may only use facts supplied by the author.
 * Author must check the accuracy confirmation checkbox before approving.
 */

import Link from "next/link";
import React, { useRef, useState } from "react";
import PackageSectionsSidebar from "../PackageSectionsSidebar";

// ─── Web Speech API mic input ───────────────────────────────────────────────

type SpeechState = "idle" | "listening" | "error";
type AuthorProfileSourceUploadStatus = "idle" | "reading" | "success" | "error";
type AuthorProfileSourceType =
  | "author_bio"
  | "resume_cv"
  | "linkedin_profile"
  | "author_website"
  | "publication_credits"
  | "awards_recognition"
  | "education"
  | "professional_background"
  | "subject_matter_expertise"
  | "infer"
  | "other";

const AUTHOR_PROFILE_SOURCE_MAX_BYTES = 5 * 1024 * 1024;
const AUTHOR_PROFILE_SOURCE_UPLOAD_FORMATS = "DOCX, TXT, MD, and CSV";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const TEXT_SOURCE_MIME_TYPES = new Set([
  "",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/csv",
  "application/vnd.ms-excel",
]);
const TEXT_SOURCE_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".csv"]);
const AUTHOR_PROFILE_SOURCE_TYPE_OPTIONS: { value: AuthorProfileSourceType; label: string }[] = [
  { value: "infer", label: "Let RevisionGrade infer source type" },
  { value: "author_bio", label: "Author Bio" },
  { value: "resume_cv", label: "Résumé / CV" },
  { value: "linkedin_profile", label: "LinkedIn Profile" },
  { value: "author_website", label: "Author Website" },
  { value: "publication_credits", label: "Publication Credits" },
  { value: "awards_recognition", label: "Awards / Recognition" },
  { value: "education", label: "Education" },
  { value: "professional_background", label: "Professional Background" },
  { value: "subject_matter_expertise", label: "Subject-Matter Expertise" },
  { value: "other", label: "Other" },
];

function authorProfileSourceTypeLabel(value: AuthorProfileSourceType): string {
  return AUTHOR_PROFILE_SOURCE_TYPE_OPTIONS.find(option => option.value === value)?.label ?? "Author Profile Source";
}

function uploadedSourceHeadingLabel(value: AuthorProfileSourceType): string {
  return value === "infer" ? "Author Profile Source" : authorProfileSourceTypeLabel(value);
}

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
  dim: "#7B7060", ink: "#0E0E0E", oxblood: "#7A1E1E",
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

function getFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

function isDocxAuthorProfileSource(file: File): boolean {
  return file.type === DOCX_MIME || getFileExtension(file.name) === ".docx";
}

function isTextAuthorProfileSource(file: File): boolean {
  const extension = getFileExtension(file.name);
  return TEXT_SOURCE_EXTENSIONS.has(extension) && TEXT_SOURCE_MIME_TYPES.has(file.type);
}

function assertAuthorProfileSourceUploadSupported(file: File): void {
  if (file.size > AUTHOR_PROFILE_SOURCE_MAX_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }
  if (!isDocxAuthorProfileSource(file) && !isTextAuthorProfileSource(file)) {
    throw new Error("UNSUPPORTED_FILE_TYPE");
  }
}

async function extractAuthorProfileSourceUploadText(file: File): Promise<string> {
  assertAuthorProfileSourceUploadSupported(file);

  if (isDocxAuthorProfileSource(file)) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value ?? "";
  }

  return await file.text();
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

const INPUT_FIELDS: { id: string; label: string; placeholder: string; required: boolean; rows?: number }[] = [
  { id: "credits",      label: "Writing Credits",            placeholder: "Published works, titles, publishers, years...",                            required: false },
  { id: "education",    label: "Education",                  placeholder: "Degrees, institutions, fields of study...",                               required: false },
  { id: "professional", label: "Professional Background",    placeholder: "Career history, roles, industries...",                                    required: false },
  { id: "expertise",    label: "Subject-Matter Expertise",   placeholder: "Specific knowledge relevant to this manuscript...",                       required: false },
  { id: "awards",       label: "Awards / Recognition",       placeholder: "Literary prizes, competitions, fellowships...",                           required: false },
  { id: "publications", label: "Prior Publications",         placeholder: "Magazine, anthology, journal credits...",                                 required: false },
];

export default function AuthorBioPage() {
  const [bioText,      setBioText]      = useState("");
  const [resumeText,   setResumeText]   = useState("");
  const [penName,      setPenName]      = useState("");
  const [isDebut,      setIsDebut]      = useState(false);
  const [fields,       setFields]       = useState<Record<string, string>>({});
  const [confirmed,    setConfirmed]    = useState(false);
  const [approved,     setApproved]     = useState(false);
  const [generatedBio, setGeneratedBio] = useState("");
  const [authorProfileSourceType, setAuthorProfileSourceType] = useState<AuthorProfileSourceType>("infer");
  const [authorProfileSourceUploadName, setAuthorProfileSourceUploadName] = useState("");
  const [authorProfileSourceUploadStatus, setAuthorProfileSourceUploadStatus] = useState<AuthorProfileSourceUploadStatus>("idle");
  const [authorProfileSourceUploadMessage, setAuthorProfileSourceUploadMessage] = useState("");
  const authorProfileSourceUploadRef = useRef<HTMLInputElement | null>(null);
  const previousResumeTextRef = useRef(resumeText);
  const previousAuthorProfileSourceTypeRef = useRef(authorProfileSourceType);

  const canApprove = generatedBio.trim().length > 0 && confirmed;

  React.useEffect(() => {
    const sourceTextChanged = previousResumeTextRef.current !== resumeText;
    const sourceTypeChanged = previousAuthorProfileSourceTypeRef.current !== authorProfileSourceType;
    if (!sourceTextChanged && !sourceTypeChanged) return;

    previousResumeTextRef.current = resumeText;
    previousAuthorProfileSourceTypeRef.current = authorProfileSourceType;
    setGeneratedBio("");
    setApproved(false);
    setConfirmed(false);
  }, [resumeText, authorProfileSourceType]);

  async function handleAuthorProfileSourceUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setAuthorProfileSourceUploadName(file.name);
    setAuthorProfileSourceUploadStatus("reading");
    setAuthorProfileSourceUploadMessage("Reading uploaded author profile source...");

    try {
      const extracted = (await extractAuthorProfileSourceUploadText(file)).trim();
      if (!extracted) {
        setAuthorProfileSourceUploadStatus("error");
        setAuthorProfileSourceUploadMessage("No readable text was found. Please paste the source text manually.");
        return;
      }

      setResumeText(prev => {
        const heading = `--- Uploaded ${uploadedSourceHeadingLabel(authorProfileSourceType)}: ${file.name} ---`;
        return prev.trim() ? `${prev.trim()}\n\n${heading}\n${extracted}` : `${heading}\n${extracted}`;
      });
      setAuthorProfileSourceUploadStatus("success");
      setAuthorProfileSourceUploadMessage(`Imported ${file.name} as ${uploadedSourceHeadingLabel(authorProfileSourceType)}.`);
    } catch (err) {
      setAuthorProfileSourceUploadStatus("error");
      if (err instanceof Error && err.message === "FILE_TOO_LARGE") {
        setAuthorProfileSourceUploadMessage("This file is too large. Please upload a file under 5 MB or paste the relevant source text manually.");
      } else if (err instanceof Error && err.message === "UNSUPPORTED_FILE_TYPE") {
        setAuthorProfileSourceUploadMessage(`Unsupported file type. Please upload ${AUTHOR_PROFILE_SOURCE_UPLOAD_FORMATS}, or paste the source text manually.`);
      } else {
        setAuthorProfileSourceUploadMessage(`This file could not be imported. Please upload ${AUTHOR_PROFILE_SOURCE_UPLOAD_FORMATS}, or paste the source text manually.`);
      }
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.cream, fontFamily: T.mono }}>
      <div className="mx-auto grid max-w-[1220px] gap-8 px-6 py-12 lg:grid-cols-[260px_minmax(0,1fr)]">
        <PackageSectionsSidebar />
        <div style={{ maxWidth: "860px" }}>

        <p style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", marginBottom: "1.5rem" }}>
          <Link href="/agent-readiness" style={{ color: T.gold, textDecoration: "none" }}>Agent Readiness Package™</Link>
          {" "}/{" "}Author Bio
        </p>

        <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          06 — Author Bio
        </p>
        <h1 style={{ fontFamily: T.serif, fontSize: "1.75rem", color: T.cream, marginBottom: "0.5rem" }}>
          Author Bio
        </h1>
        <div style={{ border: `1px solid ${T.oxblood}40`, padding: "0.75rem 1rem", marginBottom: "2rem", backgroundColor: "rgba(122,30,30,0.06)" }}>
          <p style={{ fontSize: "0.75rem", color: T.cream2, lineHeight: 1.6 }}>
            <strong style={{ color: T.cream }}>Governance:</strong> RevisionGrade does not invent author credentials.
            The bio generated here uses only the facts you supply below. You assume responsibility for accuracy.
          </p>
        </div>

        {/* Debut option */}
        <label style={{ display: "flex", gap: "0.625rem", alignItems: "center", marginBottom: "1.5rem", cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={isDebut}
            onChange={(e) => setIsDebut(e.target.checked)}
            style={{ accentColor: T.gold }}
          />
          <span style={{ fontSize: "0.75rem", color: T.cream2 }}>Debut author — no prior publishing credits</span>
        </label>

        {/* Pen name */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <label style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Pen Name <span style={{ color: T.dim, fontWeight: 400 }}>(optional)</span>
            </label>
            <MicButton setValue={setPenName} />
          </div>
          <input
            type="text"
            value={penName}
            onChange={(e) => setPenName(e.target.value)}
            placeholder="Leave blank if publishing under your legal name"
            style={{
              width: "100%", fontFamily: T.mono, fontSize: "0.8125rem", color: T.cream,
              backgroundColor: T.panel, border: `1px solid ${T.border}`,
              padding: "0.75rem", outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* Author profile sources */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.5rem" }}>
            <label style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Author Profile Sources <span style={{ color: "#7A1E1E" }}>*</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => authorProfileSourceUploadRef.current?.click()}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: `1px solid ${T.gold}80`,
                  background: "transparent",
                  color: T.gold,
                  fontSize: 12,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                ⬆ Upload Source
              </button>
              <MicButton setValue={setResumeText} />
            </div>
          </div>
          <p style={{ fontSize: "0.6875rem", color: T.dim, lineHeight: 1.5, marginBottom: "0.5rem" }}>
            Upload or paste any material RevisionGrade may use to help build your author bio and writing credentials.
          </p>
          <p style={{ fontSize: "0.6875rem", color: T.dim, lineHeight: 1.5, marginBottom: "0.5rem" }}>
            Examples: author bio, résumé/CV, LinkedIn profile text, author website copy, publication credits, awards, education, professional background, and subject-matter expertise.
          </p>
          <p style={{ fontSize: "0.6875rem", color: T.dim, lineHeight: 1.5, marginBottom: "0.625rem" }}>
            Supported uploads: {AUTHOR_PROFILE_SOURCE_UPLOAD_FORMATS}. You may also paste a LinkedIn or author-website URL as a reference. RevisionGrade will not add facts not present in these sources.
          </p>

          <div style={{ marginBottom: "0.875rem" }}>
            <label style={{ display: "block", fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.375rem" }}>
              Source Type
            </label>
            <p style={{ fontSize: "0.6875rem", color: T.dim, lineHeight: 1.5, marginBottom: "0.5rem" }}>
              Optional. Labeling the source helps RevisionGrade preserve credential accuracy, but you may leave this to the system.
            </p>
            <select
              value={authorProfileSourceType}
              onChange={(e) => setAuthorProfileSourceType(e.target.value as AuthorProfileSourceType)}
              style={{
                width: "100%",
                fontFamily: T.mono,
                fontSize: "0.8125rem",
                color: T.cream,
                backgroundColor: T.panel,
                border: `1px solid ${T.border}`,
                padding: "0.75rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            >
              {AUTHOR_PROFILE_SOURCE_TYPE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <input
            ref={authorProfileSourceUploadRef}
            type="file"
            accept=".docx,.txt,.md,.markdown,.csv,text/plain,text/markdown,text/csv,application/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={handleAuthorProfileSourceUpload}
            style={{ display: "none" }}
          />
          {(authorProfileSourceUploadName || authorProfileSourceUploadStatus !== "idle") && (
            <div style={{
              border: `1px solid ${authorProfileSourceUploadStatus === "error" ? T.oxblood : T.border}`,
              backgroundColor: authorProfileSourceUploadStatus === "error" ? "rgba(122,30,30,0.08)" : "rgba(169,142,74,0.06)",
              color: authorProfileSourceUploadStatus === "error" ? "#D07070" : T.cream2,
              padding: "0.5rem 0.625rem",
              marginBottom: "0.75rem",
              fontSize: "0.6875rem",
              lineHeight: 1.5,
            }}>
              <strong style={{ color: authorProfileSourceUploadStatus === "success" ? T.gold : "inherit" }}>
                {authorProfileSourceUploadStatus === "reading" ? "Reading" : authorProfileSourceUploadStatus === "success" ? "Uploaded" : authorProfileSourceUploadStatus === "error" ? "Upload issue" : "Selected"}
              </strong>
              {authorProfileSourceUploadName ? ` — ${authorProfileSourceUploadName}` : ""}
              {authorProfileSourceUploadMessage ? `: ${authorProfileSourceUploadMessage}` : ""}
            </div>
          )}
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            rows={8}
            placeholder="Paste author profile sources here: existing author bio, résumé/CV, LinkedIn profile text, author website copy, publication credits, awards, education, professional background, or subject-matter expertise..."
            style={{
              width: "100%", fontFamily: T.mono, fontSize: "0.8125rem", color: T.cream,
              backgroundColor: T.panel, border: `1px solid ${T.border}`,
              padding: "0.875rem", resize: "vertical", outline: "none", lineHeight: 1.65,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Structured fields */}
        {!isDebut && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            {INPUT_FIELDS.map(field => {
              const setFieldValue: React.Dispatch<React.SetStateAction<string>> = (v) =>
                setFields(prev => ({ ...prev, [field.id]: typeof v === "function" ? (v as (p: string) => string)(prev[field.id] ?? "") : v }));
              return (
              <div key={field.id}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.375rem" }}>
                  <label style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    {field.label}
                  </label>
                  <MicButton setValue={setFieldValue} />
                </div>
                <textarea
                  value={fields[field.id] ?? ""}
                  onChange={(e) => setFields(prev => ({ ...prev, [field.id]: e.target.value }))}
                  rows={field.rows ?? 3}
                  placeholder={field.placeholder}
                  style={{
                    width: "100%", fontFamily: T.mono, fontSize: "0.75rem", color: T.cream,
                    backgroundColor: T.panel, border: `1px solid ${T.border}`,
                    padding: "0.625rem", resize: "vertical", outline: "none", lineHeight: 1.55,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              );
            })}
          </div>
        )}

        {/* Generate */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <button
            onClick={() => setGeneratedBio("Michael J. Meraw is a former Canadian Armed Forces pilot and aerospace executive turned novelist. He writes literary suspense, eco-horror, and speculative fiction about survival, moral consequence, and the systems — natural and human — that trap people inside them. Splitting his time between Canada and Sinaloa, Mexico, he draws on lived regional experience for his work. Meraw previously founded a startup and pitched on CBC's Dragons' Den.")}
            style={{
              fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              backgroundColor: T.gold, color: T.ink, border: "none",
              padding: "0.625rem 1.25rem", cursor: "pointer",
            }}>
            Generate Bio
          </button>
          {["Regenerate", "Improve", "Copy"].map(label => (
            <button key={label} style={{
              fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              backgroundColor: "transparent", color: T.cream2,
              border: `1px solid ${T.border}`, padding: "0.625rem 1.25rem", cursor: "pointer",
            }}>{label}</button>
          ))}
        </div>

        {/* Generated bio */}
        {generatedBio && (
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <label style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Generated Author Bio
              </label>
              <MicButton setValue={setGeneratedBio} />
            </div>
            <textarea
              value={generatedBio}
              onChange={(e) => { setGeneratedBio(e.target.value); setApproved(false); setConfirmed(false); }}
              rows={6}
              style={{
                width: "100%", fontFamily: T.mono, fontSize: "0.8125rem", color: T.cream,
                backgroundColor: T.panel, border: `1px solid ${T.border}`,
                padding: "0.875rem", resize: "vertical", outline: "none", lineHeight: 1.65,
                boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {/* Copy + Save .txt */}
        {generatedBio && (
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(generatedBio)}
              style={SAVE_BTN}
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => downloadTxt("author-bio.txt", generatedBio)}
              style={SAVE_BTN}
            >
              Save .txt
            </button>
          </div>
        )}

        {/* Accuracy confirmation checkbox */}
        {generatedBio && (
          <label style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start", marginBottom: "1.25rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => { setConfirmed(e.target.checked); setApproved(false); }}
              style={{ marginTop: "2px", accentColor: T.gold, flexShrink: 0 }}
            />
            <p style={{ fontSize: "0.75rem", color: T.cream2, lineHeight: 1.6 }}>
              I confirm these credentials are accurate and supported by my uploaded or pasted Author Profile Sources.
              RevisionGrade does not verify author credentials; the author assumes full responsibility for accuracy.
            </p>
          </label>
        )}

        {/* Approve */}
        {generatedBio && (
          <button
            onClick={() => canApprove && setApproved(true)}
            disabled={!canApprove}
            style={{
              fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              backgroundColor: approved ? "#5A8A5A" : canApprove ? "transparent" : "transparent",
              color: approved ? "#F2EFEA" : "#5A8A5A",
              border: `1px solid ${!canApprove ? T.border : "#5A8A5A"}`,
              padding: "0.625rem 1.25rem",
              cursor: canApprove ? "pointer" : "not-allowed",
              opacity: canApprove ? 1 : 0.4,
            }}
          >
            {approved ? "✓ Approved" : "Lock / Approve"}
          </button>
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
