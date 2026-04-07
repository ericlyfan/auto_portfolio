import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMediaContainer, publishMedia, getMediaList, getMediaInsights, getAccountInfo, refreshToken } from "@/lib/instagram";
// Note: carousel functions are imported via dynamic import in each test to ensure env stubs are applied

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  vi.stubEnv("INSTAGRAM_USER_ID", "123456");
  vi.stubEnv("INSTAGRAM_ACCESS_TOKEN", "test-token");
  mockFetch.mockReset();
});

describe("createMediaContainer", () => {
  it("sends image_url and caption to the Graph API and returns creation_id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "container-789" }),
    });

    const result = await createMediaContainer(
      "https://example.com/photo.jpg",
      "Hello world"
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v18.0/123456/media",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: "https://example.com/photo.jpg",
          caption: "Hello world",
          access_token: "test-token",
        }),
      }
    );
    expect(result).toBe("container-789");
  });

  it("throws on API error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { message: "Invalid token", type: "OAuthException" },
      }),
    });

    await expect(
      createMediaContainer("https://example.com/photo.jpg", "caption")
    ).rejects.toThrow("Instagram API error: Invalid token");
  });
});

describe("publishMedia", () => {
  it("waits for media ready then publishes", async () => {
    // First call: status check returns FINISHED
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status_code: "FINISHED" }),
    });
    // Second call: publish
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "post-999" }),
    });

    const result = await publishMedia("container-789");

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://graph.facebook.com/v18.0/container-789?fields=status_code&access_token=test-token"
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://graph.facebook.com/v18.0/123456/media_publish",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: "container-789",
          access_token: "test-token",
        }),
      }
    );
    expect(result).toEqual({ id: "post-999" });
  });

  it("throws on publish API error", async () => {
    // Status check: FINISHED
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status_code: "FINISHED" }),
    });
    // Publish: error
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { message: "Rate limit reached", type: "OAuthException" },
      }),
    });

    await expect(publishMedia("container-789")).rejects.toThrow(
      "Instagram API error: Rate limit reached"
    );
  });

  it("throws when media processing fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status_code: "ERROR" }),
    });

    await expect(publishMedia("container-789")).rejects.toThrow(
      "Instagram API error: Media processing failed"
    );
  });
});

describe("createCarouselItemContainer", () => {
  it("sends image_url with is_carousel_item flag and returns container id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "item-001" }),
    });

    const { createCarouselItemContainer } = await import("@/lib/instagram");
    const result = await createCarouselItemContainer(
      "https://example.com/photo1.jpg"
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v18.0/123456/media",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: "https://example.com/photo1.jpg",
          is_carousel_item: true,
          access_token: "test-token",
        }),
      }
    );
    expect(result).toBe("item-001");
  });

  it("throws on API error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { message: "Invalid image", type: "OAuthException" },
      }),
    });

    const { createCarouselItemContainer } = await import("@/lib/instagram");
    await expect(
      createCarouselItemContainer("https://example.com/bad.jpg")
    ).rejects.toThrow("Instagram API error: Invalid image");
  });
});

describe("createCarouselContainer", () => {
  it("sends children ids and caption and returns container id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "carousel-001" }),
    });

    const { createCarouselContainer } = await import("@/lib/instagram");
    const result = await createCarouselContainer(
      ["item-001", "item-002", "item-003"],
      "My carousel caption"
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v18.0/123456/media",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          children: ["item-001", "item-002", "item-003"],
          caption: "My carousel caption",
          access_token: "test-token",
        }),
      }
    );
    expect(result).toBe("carousel-001");
  });

  it("throws on API error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { message: "Too many children", type: "OAuthException" },
      }),
    });

    const { createCarouselContainer } = await import("@/lib/instagram");
    await expect(
      createCarouselContainer(["item-001"], "caption")
    ).rejects.toThrow("Instagram API error: Too many children");
  });
});

describe("getMediaList", () => {
  it("fetches media list with correct fields and returns data array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "media-1",
            caption: "Velvia 100\nGreat day",
            media_url: "https://cdn.instagram.com/photo1.jpg",
            thumbnail_url: null,
            timestamp: "2024-01-03T10:00:00+0000",
            media_type: "IMAGE",
            permalink: "https://www.instagram.com/p/abc/",
          },
        ],
      }),
    });

    const result = await getMediaList(25);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v18.0/123456/media?fields=id%2Ccaption%2Cmedia_url%2Cthumbnail_url%2Ctimestamp%2Cmedia_type%2Cpermalink&limit=25&access_token=test-token"
    );
    expect(result).toEqual([
      {
        id: "media-1",
        caption: "Velvia 100\nGreat day",
        media_url: "https://cdn.instagram.com/photo1.jpg",
        thumbnail_url: null,
        timestamp: "2024-01-03T10:00:00+0000",
        media_type: "IMAGE",
        permalink: "https://www.instagram.com/p/abc/",
      },
    ]);
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "Invalid token" } }),
    });

    await expect(getMediaList(25)).rejects.toThrow(
      "Instagram API error: Invalid token"
    );
  });
});

describe("getMediaInsights", () => {
  it("fetches insights and returns mapped metrics object", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { name: "impressions", values: [{ value: 200 }] },
          { name: "reach", values: [{ value: 150 }] },
          { name: "likes", values: [{ value: 12 }] },
          { name: "saved", values: [{ value: 4 }] },
          { name: "comments_count", values: [{ value: 2 }] },
          { name: "shares", values: [{ value: 1 }] },
        ],
      }),
    });

    const result = await getMediaInsights("media-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v18.0/media-1/insights?metric=impressions%2Creach%2Clikes%2Csaved%2Ccomments_count%2Cshares&access_token=test-token"
    );
    expect(result).toEqual({
      impressions: 200,
      reach: 150,
      likes: 12,
      saves: 4,
      comments: 2,
      shares: 1,
    });
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "Media not found" } }),
    });

    await expect(getMediaInsights("media-1")).rejects.toThrow(
      "Instagram API error: Media not found"
    );
  });
});

describe("getAccountInfo", () => {
  it("fetches account fields and 28-day insights and returns merged object", async () => {
    // First call: account fields
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "ericfan",
        followers_count: 4200,
        media_count: 89,
      }),
    });
    // Second call: insights
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { name: "reach", values: [{ value: 18400 }] },
          { name: "profile_views", values: [{ value: 342 }] },
        ],
      }),
    });

    const result = await getAccountInfo();

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://graph.facebook.com/v18.0/123456?fields=username%2Cfollowers_count%2Cmedia_count&access_token=test-token"
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://graph.facebook.com/v18.0/123456/insights?metric=reach%2Cprofile_views&period=days_28&access_token=test-token"
    );
    expect(result).toEqual({
      username: "ericfan",
      followersCount: 4200,
      mediaCount: 89,
      reach28d: 18400,
      profileViews28d: 342,
    });
  });

  it("throws on account fields API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "Invalid token" } }),
    });

    await expect(getAccountInfo()).rejects.toThrow(
      "Instagram API error: Invalid token"
    );
  });

  it("throws on insights API error", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          username: "ericfan",
          followers_count: 4200,
          media_count: 89,
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: "Insights unavailable" } }),
      });

    await expect(getAccountInfo()).rejects.toThrow(
      "Instagram API error: Insights unavailable"
    );
  });
});

describe("refreshToken", () => {
  it("calls refresh endpoint and returns new access token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "new-token-abc",
        token_type: "bearer",
        expires_in: 5183944,
      }),
    });

    const result = await refreshToken();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=test-token"
    );
    expect(result).toBe("new-token-abc");
  });

  it("throws on refresh failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "Token expired" } }),
    });

    await expect(refreshToken()).rejects.toThrow(
      "Instagram API error: Token expired"
    );
  });
});
