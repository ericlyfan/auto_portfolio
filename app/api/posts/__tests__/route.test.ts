import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/posts/route";

vi.mock("@/lib/instagram", () => ({
  getMediaList: vi.fn(),
  getMediaInsights: vi.fn(),
}));

import { getMediaList, getMediaInsights } from "@/lib/instagram";

const mockGetMediaList = vi.mocked(getMediaList);
const mockGetMediaInsights = vi.mocked(getMediaInsights);

beforeEach(() => {
  mockGetMediaList.mockReset();
  mockGetMediaInsights.mockReset();
});

describe("GET /api/posts", () => {
  it("returns posts with merged insights", async () => {
    mockGetMediaList.mockResolvedValueOnce([
      {
        id: "media-1",
        caption: "Velvia 100\nGreat shot",
        media_url: "https://cdn.instagram.com/photo1.jpg",
        thumbnail_url: null,
        timestamp: "2024-01-03T10:00:00+0000",
        media_type: "IMAGE",
        permalink: "https://www.instagram.com/p/abc/",
      },
    ]);
    mockGetMediaInsights.mockResolvedValueOnce({
      impressions: 200,
      reach: 150,
      likes: 12,
      saves: 4,
      comments: 2,
      shares: 1,
    });

    const request = new Request("http://localhost/api/posts");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetMediaList).toHaveBeenCalledWith(25);
    expect(mockGetMediaInsights).toHaveBeenCalledWith("media-1");
    expect(data.posts).toEqual([
      {
        id: "media-1",
        caption: "Velvia 100\nGreat shot",
        mediaUrl: "https://cdn.instagram.com/photo1.jpg",
        timestamp: "2024-01-03T10:00:00+0000",
        mediaType: "IMAGE",
        permalink: "https://www.instagram.com/p/abc/",
        impressions: 200,
        reach: 150,
        likes: 12,
        saves: 4,
        comments: 2,
        shares: 1,
      },
    ]);
  });

  it("returns 500 on Instagram API error", async () => {
    mockGetMediaList.mockRejectedValueOnce(
      new Error("Instagram API error: Invalid token")
    );

    const request = new Request("http://localhost/api/posts");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Instagram API error: Invalid token" });
  });
});
