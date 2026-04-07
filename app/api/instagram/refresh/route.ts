import { NextResponse } from "next/server";
import { refreshToken } from "@/lib/instagram";

export async function POST(_request: Request) {
  try {
    const newToken = await refreshToken();
    return NextResponse.json({ newToken });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
