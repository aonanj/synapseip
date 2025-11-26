import { NextRequest } from "next/server";

import { fetchWithRetry } from "../../_lib/fetch-with-retry";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const authHeader = req.headers.get("authorization");
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    if (authHeader) headers.append("Authorization", authHeader);

    const payload = JSON.stringify(body);
    const resp = await fetchWithRetry(() =>
      fetch(`${process.env.BACKEND_URL}/citation/dependency-matrix`, {
        method: "POST",
        headers,
        body: payload,
        cache: "no-store",
      })
    );

    const text = await resp.text();
    return new Response(text, {
      status: resp.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("API proxy error for /citation/dependency-matrix:", err);
    return new Response(
      JSON.stringify({ error: "Failed to reach backend", detail: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
