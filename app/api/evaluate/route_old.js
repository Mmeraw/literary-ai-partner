// app/api/evaluate/submit/route.ts

export async function POST(req: Request) {
  try {
    await req.json().catch(() => null);

    return Response.json(
      {
        ok: true,
        message: "evaluate/submit baseline OK",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Hard fail in evaluate/submit:", err);
    return Response.json(
      {
        ok: false,
        error: "evaluate/submit hard fail",
      },
      { status: 500 }
    );
  }
}
