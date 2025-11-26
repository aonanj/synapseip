import { NextRequest, NextResponse } from "next/server";

import { fetchWithRetry } from "../../../_lib/fetch-with-retry";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const authHeader = req.headers.get("authorization");
    const headers = new Headers();
    headers.append("Content-Type", "application/json");
    if (authHeader) headers.append("Authorization", authHeader);

    const payload = JSON.stringify(body);
    const resp = await fetchWithRetry(() =>
      fetch(`${process.env.BACKEND_URL}/citation/risk-radar/export`, {
        method: "POST",
        headers,
        body: payload,
        cache: "no-store",
      })
    );

    const contentType = resp.headers.get("content-type") || "application/pdf";
    const contentDisposition = resp.headers.get("content-disposition") || undefined;
    const respHeaders: Record<string, string> = { "Content-Type": contentType };
    if (contentDisposition) respHeaders["Content-Disposition"] = contentDisposition;

    return new NextResponse(resp.body, { status: resp.status, headers: respHeaders });
  } catch (err: any) {
    console.error("API proxy error for /citation/risk-radar/export:", err);
    return new NextResponse(
      JSON.stringify({ error: "Failed to reach backend", detail: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
