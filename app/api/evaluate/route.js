// app/api/evaluate/route.js
export async function POST(request) {
  const body = await request.json();

  return new Response(
    JSON.stringify({
      status: "ok",
      echo: body,
      message: "Evaluate minimal pipeline stub",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
