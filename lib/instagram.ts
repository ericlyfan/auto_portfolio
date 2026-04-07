export async function createMediaContainer(
  imageUrl: string,
  caption: string
): Promise<string> {
  const userId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${userId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Instagram API error: ${data.error?.message ?? "Unknown error"}`);
  }

  return data.id;
}

export async function createCarouselItemContainer(
  imageUrl: string
): Promise<string> {
  const userId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${userId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        is_carousel_item: true,
        access_token: accessToken,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Instagram API error: ${data.error?.message ?? "Unknown error"}`
    );
  }

  return data.id;
}

export async function createCarouselContainer(
  childIds: string[],
  caption: string
): Promise<string> {
  const userId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${userId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media_type: "CAROUSEL",
        children: childIds,
        caption,
        access_token: accessToken,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Instagram API error: ${data.error?.message ?? "Unknown error"}`
    );
  }

  return data.id;
}

async function waitForMediaReady(
  containerId: string,
  maxAttempts = 10
): Promise<void> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${containerId}?fields=status_code&access_token=${accessToken}`
    );
    const data = await response.json();

    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") {
      throw new Error(`Instagram API error: Media processing failed`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  throw new Error("Instagram API error: Media processing timed out");
}

export async function publishMedia(
  creationId: string
): Promise<{ id: string }> {
  const userId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  await waitForMediaReady(creationId);

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${userId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Instagram API error: ${data.error?.message ?? "Unknown error"}`);
  }

  return { id: data.id };
}

export type IGMedia = {
  id: string;
  caption: string | null;
  media_url: string;
  thumbnail_url: string | null;
  timestamp: string;
  media_type: string;
  permalink: string;
};

export type IGMediaInsights = {
  impressions: number;
  reach: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
};

export async function getMediaList(limit: number): Promise<IGMedia[]> {
  const userId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  const params = new URLSearchParams({
    fields: "id,caption,media_url,thumbnail_url,timestamp,media_type,permalink",
    limit: String(limit),
    access_token: accessToken!,
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${userId}/media?${params}`
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Instagram API error: ${data.error?.message ?? "Unknown error"}`
    );
  }

  return data.data;
}

export async function getMediaInsights(
  mediaId: string
): Promise<IGMediaInsights> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  const params = new URLSearchParams({
    metric: "impressions,reach,likes,saved,comments_count,shares",
    access_token: accessToken!,
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${mediaId}/insights?${params}`
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Instagram API error: ${data.error?.message ?? "Unknown error"}`
    );
  }

  const map: Record<string, number> = {};
  for (const item of data.data as Array<{
    name: string;
    values: Array<{ value: number }>;
  }>) {
    map[item.name] = item.values[item.values.length - 1]?.value ?? 0;
  }

  return {
    impressions: map.impressions ?? 0,
    reach: map.reach ?? 0,
    likes: map.likes ?? 0,
    saves: map.saved ?? 0,
    comments: map.comments_count ?? 0,
    shares: map.shares ?? 0,
  };
}
