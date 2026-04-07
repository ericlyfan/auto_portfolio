import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { password } = await request.json();

  if (password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("session", process.env.APP_PASSWORD!, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
  });
  return response;
}
