import { NextResponse } from "next/server";
import { getMediaList, getMediaInsights } from "@/lib/instagram";

export async function GET(_request: Request) {
  try {
    const media = await getMediaList(25);

    const posts = await Promise.all(
      media.map(async (item) => {
        const insights = await getMediaInsights(item.id);
        return {
          id: item.id,
          caption: item.caption,
          mediaUrl: item.media_url,
          timestamp: item.timestamp,
          mediaType: item.media_type,
          permalink: item.permalink,
          ...insights,
        };
      })
    );

    return NextResponse.json({ posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
