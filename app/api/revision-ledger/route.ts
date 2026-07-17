import { NextResponse } from "next/server";
import {
  listRevisionLedgerDecisions,
  syncRevisionLedgerDecisions,
  type SyncRevisionLedgerEntryInput,
} from "@/lib/revision/ledger";

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

function statusFromMessage(message: string): number {
  if (message === "Not authenticated") return 401;
  const normalized = message.toLowerCase();
  if (normalized.includes("not found")) return 404;
  if (normalized.includes("stale write blocked")) return 409;
  if (normalized.includes("sync blocked")) return 409;
  if (normalized.includes("missing")) return 400;
  if (normalized.includes("invalid")) return 400;
  if (normalized.includes("acceptance blocked")) return 400;
  if (normalized.includes("decision blocked")) return 400;
  return 500;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const manuscriptId = url.searchParams.get("manuscriptId");
    const evaluationJobId = url.searchParams.get("evaluationJobId");

    if (!manuscriptId) return badRequest("Missing manuscriptId");
    if (!evaluationJobId) return badRequest("Missing evaluationJobId");

    const entries = await listRevisionLedgerDecisions({ manuscriptId, evaluationJobId });
    return NextResponse.json({ ok: true, entries });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = statusFromMessage(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const manuscriptId = body?.manuscriptId;
    const evaluationJobId = body?.evaluationJobId;
    const entries = body?.entries as SyncRevisionLedgerEntryInput[] | undefined;

    if (!manuscriptId) return badRequest("Missing manuscriptId");
    if (!evaluationJobId) return badRequest("Missing evaluationJobId");
    if (!Array.isArray(entries)) return badRequest("Missing entries array");

    const synced = await syncRevisionLedgerDecisions({ manuscriptId, evaluationJobId, entries });
    return NextResponse.json({ ok: true, entries: synced });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = statusFromMessage(message);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
