import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "revisiongrade",
      route: "/api/health",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
