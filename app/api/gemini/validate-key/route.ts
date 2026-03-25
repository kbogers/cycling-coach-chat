import { NextResponse } from "next/server";

const MODELS_URL =
  "https://generativelanguage.googleapis.com/v1beta/models?key=";

/** Lightweight check: list models with the key (no token usage for generation). */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { apiKey?: string };
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required." },
        { status: 400 }
      );
    }

    const res = await fetch(`${MODELS_URL}${encodeURIComponent(apiKey)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      if (res.status === 400 || res.status === 403 || res.status === 401) {
        return NextResponse.json(
          {
            error:
              "This key was rejected by Google. Check it in Google AI Studio and try again.",
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        {
          error: `Could not verify key (HTTP ${res.status}). ${detail.slice(0, 200)}`,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
