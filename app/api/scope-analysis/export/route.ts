import { NextRequest } from "next/server";

import { fetchWithRetry } from "../../_lib/fetch-with-retry";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const authHeader = req.headers.get("authorization");

    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    if (authHeader) {
      headers.append("Authorization", authHeader);
    }

    const payload = JSON.stringify(body);
    
    const resp = await fetchWithRetry(() =>
      fetch(`${process.env.BACKEND_URL}/scope_analysis/export`, {
        method: "POST",
        headers,
        body: payload,
        cache: "no-store",
      })
    );

    if (!resp.ok) {
        const errorText = await resp.text();
        return new Response(errorText, { status: resp.status, headers: { "Content-Type": "application/json" } });
    }

    const ct = resp.headers.get("content-type") || "application/pdf";
    const cd = resp.headers.get("content-disposition");
    
    const responseHeaders: Record<string, string> = {
        "Content-Type": ct,
    };
    if (cd) {
        responseHeaders["Content-Disposition"] = cd;
    }

    return new Response(resp.body, {
      status: resp.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error("Scope analysis export API proxy error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to reach backend", detail: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
