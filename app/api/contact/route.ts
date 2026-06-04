import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase/server";

/**
 * POST /api/contact
 *
 * Sends a support concern email to support@revisiongrade.com.
 * Requires authenticated user. Accepts a message and optional
 * screenshot URLs (pre-uploaded to Supabase storage).
 */
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: { message: string; jobId?: string; page?: string; screenshotUrls?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length < 10) {
    return NextResponse.json({ ok: false, error: "Message must be at least 10 characters" }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ ok: false, error: "Message too long (max 5000 characters)" }, { status: 400 });
  }

  const jobId = typeof body.jobId === "string" ? body.jobId : null;
  const page = typeof body.page === "string" ? body.page : null;
  const screenshotUrls = Array.isArray(body.screenshotUrls)
    ? body.screenshotUrls.filter((u): u is string => typeof u === "string" && u.startsWith("http")).slice(0, 5)
    : [];

  const screenshotHtml = screenshotUrls.length > 0
    ? `<h3>Screenshots</h3>${screenshotUrls.map((url, i) => `<p><a href="${url}">Screenshot ${i + 1}</a></p>`).join("")}`
    : "";

  const htmlBody = `
<h2>Support Concern</h2>
<p><strong>From:</strong> ${user.email ?? user.id}</p>
${jobId ? `<p><strong>Evaluation Job:</strong> ${jobId}</p>` : ""}
${page ? `<p><strong>Page:</strong> ${page}</p>` : ""}
<hr>
<p>${message.replace(/\n/g, "<br>")}</p>
${screenshotHtml}
<hr>
<p style="font-size: 12px; color: #888;">User ID: ${user.id}</p>
  `.trim();

  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.warn("[contact] RESEND_API_KEY not set — email suppressed");
    console.warn("[contact] Would have sent:", { from: user.email, message, jobId, page });
    // In dev/staging, still return success so the UX works
    return NextResponse.json({ ok: true, delivered: false });
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RevisionGrade Support <noreply@revisiongrade.com>",
        to: ["support@revisiongrade.com"],
        reply_to: user.email ?? undefined,
        subject: `[Support Concern] ${jobId ? `Job ${jobId.slice(0, 8)}… — ` : ""}${message.slice(0, 60)}`,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("[contact] Resend error:", errBody);
      return NextResponse.json({ ok: false, error: "Failed to send email" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, delivered: true });
  } catch (err) {
    console.error("[contact] Send failed:", err);
    return NextResponse.json({ ok: false, error: "Email delivery failed" }, { status: 500 });
  }
}
