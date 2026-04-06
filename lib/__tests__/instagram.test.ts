import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMediaContainer, publishMedia } from "@/lib/instagram";
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
