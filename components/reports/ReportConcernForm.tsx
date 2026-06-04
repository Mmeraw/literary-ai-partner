"use client";

import { useState, useRef } from "react";

type ReportConcernFormProps = {
  jobId?: string;
  page?: string;
};

export default function ReportConcernForm({ jobId, page }: ReportConcernFormProps) {
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [screenshotUrls, setScreenshotUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);

    const newUrls: string[] = [];
    for (let i = 0; i < Math.min(files.length, 5 - screenshotUrls.length); i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) {
        setError("Image must be under 10 MB");
        continue;
      }

      // Convert to data URL for inline inclusion (simple approach)
      try {
        const url = URL.createObjectURL(file);
        newUrls.push(url);
      } catch {
        setError("Failed to process image");
      }
    }

    setScreenshotUrls((prev) => [...prev, ...newUrls].slice(0, 5));
    setUploading(false);
  }

  async function handleSubmit() {
    if (message.trim().length < 10) {
      setError("Please describe your concern in at least 10 characters.");
      return;
    }

    setSending(true);
    setError(null);

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          jobId,
          page,
          screenshotUrls,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSent(true);
        setMessage("");
        setScreenshotUrls([]);
      } else {
        setError(data.error ?? "Failed to send");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
        <p className="text-sm font-medium text-emerald-800">Concern sent</p>
        <p className="mt-0.5 text-xs text-emerald-600">
          We&apos;ve received your message and will review it. You can also email us directly at{" "}
          <a href="mailto:support@revisiongrade.com" className="underline">support@revisiongrade.com</a>.
        </p>
        <button
          type="button"
          onClick={() => { setSent(false); setExpanded(false); }}
          className="mt-2 text-xs text-emerald-600 underline hover:text-emerald-800"
        >
          Send another
        </button>
      </div>
    );
  }

  if (!expanded) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Report a Concern</p>
            <p className="mt-0.5 text-xs text-gray-600">
              Something not right? Describe the issue and attach screenshots if helpful.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="shrink-0 rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gray-200 bg-white p-4">
      <p className="text-sm font-medium text-gray-900">Report a Concern</p>
      <p className="mt-0.5 text-xs text-gray-600 leading-relaxed">
        Describe what you&apos;re seeing. We&apos;ll review and respond at{" "}
        <a href="mailto:support@revisiongrade.com" className="underline text-blue-600">support@revisiongrade.com</a>.
      </p>

      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Describe the issue..."
        rows={4}
        maxLength={5000}
        className="mt-3 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />

      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || screenshotUrls.length >= 5}
          className="rounded border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-40"
        >
          {uploading ? "Uploading…" : "Attach Screenshot"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files)}
        />
        {screenshotUrls.length > 0 && (
          <span className="text-xs text-gray-500">{screenshotUrls.length} screenshot{screenshotUrls.length > 1 ? "s" : ""} attached</span>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={sending || message.trim().length < 10}
          className="rounded bg-gray-900 px-4 py-1.5 text-xs font-medium text-white shadow hover:bg-gray-800 disabled:opacity-40"
        >
          {sending ? "Sending…" : "Send Concern"}
        </button>
        <button
          type="button"
          onClick={() => { setExpanded(false); setMessage(""); setScreenshotUrls([]); setError(null); }}
          className="text-xs text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
