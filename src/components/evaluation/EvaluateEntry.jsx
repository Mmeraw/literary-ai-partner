"use client";

export default function EvaluateEntry() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold">Evaluate</h1>
        <p className="text-gray-600">
          Paste text or upload a file. Choose your tone, mood, and voice settings, then run Evaluate.
        </p>
      </header>

      <section className="space-y-4">
        <label className="block font-medium">Paste text</label>
        <textarea
          className="w-full min-h-[160px] rounded border border-gray-300 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Paste a scene, chapter excerpt, or sample…"
        />
        <p className="text-sm text-gray-500">
          Characters: 0 (min 40, max 12,000)
        </p>
      </section>

      <div className="text-center text-gray-400">OR</div>

      <section className="space-y-2">
        <label className="block font-medium">Upload file</label>
        <input type="file" className="block" />
        <p className="text-sm text-gray-500">
          Accepted: .txt, .doc/.docx, .pdf, .rtf
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block font-medium mb-1">Tone</label>
          <select className="w-full rounded border border-gray-300 p-2">
            <option>Neutral</option>
            <option>Formal</option>
            <option>Critical</option>
          </select>
        </div>

        <div>
          <label className="block font-medium mb-1">Mood</label>
          <select className="w-full rounded border border-gray-300 p-2">
            <option>Calm</option>
            <option>Intense</option>
            <option>Dark</option>
          </select>
        </div>

        <div>
          <label className="block font-medium mb-1">Voice</label>
          <select className="w-full rounded border border-gray-300 p-2">
            <option>Balanced (recommended)</option>
            <option>Preserve Voice (strict)</option>
            <option>Agent</option>
            <option>Line Editor</option>
          </select>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-sm text-gray-600">
          <strong>Voice protection:</strong> “Preserve Voice (strict)” minimizes rewriting.
          “Agent” and “Line Editor” may produce stronger stylistic changes.
        </p>
      </section>

      <button
        disabled
        className="w-full rounded bg-blue-600 py-3 font-semibold text-white opacity-50 cursor-not-allowed"
      >
        Evaluate
      </button>

      <p className="text-xs text-gray-400">
        Current state: UI + payload stub only. Next step: wire extraction + governed <code>/api/evaluate</code>.
      </p>
    </div>
  );
}
