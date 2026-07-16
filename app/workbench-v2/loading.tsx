export default function WorkbenchV2Loading() {
  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#0D0A05] px-4 py-16 text-[#F5EFE4] md:px-6 md:py-24">
      <section
        role="status"
        aria-live="polite"
        className="mx-auto max-w-3xl rounded-xl border border-[#3A3022] bg-[#1C160E]/90 px-6 py-10 text-center shadow-2xl md:px-10 md:py-14"
      >
        <div
          aria-hidden="true"
          className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#6D5A3B] border-t-[#C8A96E]"
        />
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#C8A96E]">
          Revise Workbench
        </p>
        <h1
          className="mt-3 text-3xl text-[#F8F1E6] md:text-4xl"
          style={{ fontFamily: "Instrument Serif, Georgia, serif" }}
        >
          Building and rendering your Revise Workbench…
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-[#CBBDA4]">
          RevisionGrade is assembling the revision queue, manuscript evidence, recommendations,
          and rewrite choices created from your evaluation.
        </p>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[#A9987D]">
          This can take 1–2 minutes. Keep this page open; the completed workbench will replace this
          message automatically.
        </p>
      </section>
    </main>
  );
}
