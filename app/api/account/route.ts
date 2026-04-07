import { NextResponse } from "next/server";
import { getAccountInfo } from "@/lib/instagram";

export async function GET(_request: Request) {
  try {
    const account = await getAccountInfo();

    const issuedAt = Number(process.env.INSTAGRAM_TOKEN_ISSUED_AT);
    const tokenDaysLeft = issuedAt
      ? Math.max(
          0,
          Math.ceil(
            (issuedAt * 1000 + 60 * 24 * 60 * 60 * 1000 - Date.now()) /
              (24 * 60 * 60 * 1000)
          )
        )
      : null;

    return NextResponse.json({ ...account, tokenDaysLeft });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
