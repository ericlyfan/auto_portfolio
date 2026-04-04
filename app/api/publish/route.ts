import { NextResponse } from "next/server";
import { createMediaContainer, publishMedia } from "@/lib/instagram";

export async function POST(request: Request) {
  const body = await request.json();
  const { imagePath, caption } = body;

  if (!imagePath) {
    return NextResponse.json(
      { success: false, error: "imagePath is required" },
      { status: 400 }
    );
  }

  const ngrokUrl = process.env.NGROK_URL;
  const publicImageUrl = `${ngrokUrl}${imagePath}`;

  try {
    const creationId = await createMediaContainer(publicImageUrl, caption ?? "");
    const result = await publishMedia(creationId);

    return NextResponse.json({
      success: true,
      postId: result.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
