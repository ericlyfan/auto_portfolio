import { NextResponse } from "next/server";
import {
  createMediaContainer,
  createCarouselItemContainer,
  createCarouselContainer,
  publishMedia,
} from "@/lib/instagram";

export async function POST(request: Request) {
  const body = await request.json();
  const { imagePaths, caption } = body as {
    imagePaths?: string[];
    caption?: string;
  };

  if (!imagePaths || imagePaths.length === 0) {
    return NextResponse.json(
      { success: false, error: "imagePaths is required" },
      { status: 400 }
    );
  }

  const ngrokUrl = process.env.NGROK_URL;

  try {
    let creationId: string;

    if (imagePaths.length === 1) {
      // Single image flow
      const publicUrl = `${ngrokUrl}${imagePaths[0]}`;
      creationId = await createMediaContainer(publicUrl, caption ?? "");
    } else {
      // Carousel flow
      const childIds: string[] = [];
      for (const imagePath of imagePaths) {
        const publicUrl = `${ngrokUrl}${imagePath}`;
        const childId = await createCarouselItemContainer(publicUrl);
        childIds.push(childId);
      }
      creationId = await createCarouselContainer(childIds, caption ?? "");
    }

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
