import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/publish/route";

vi.mock("@/lib/instagram", () => ({
  createMediaContainer: vi.fn(),
  createCarouselItemContainer: vi.fn(),
  createCarouselContainer: vi.fn(),
  publishMedia: vi.fn(),
}));

import {
  createMediaContainer,
  createCarouselItemContainer,
  createCarouselContainer,
  publishMedia,
} from "@/lib/instagram";

const mockCreate = vi.mocked(createMediaContainer);
const mockCarouselItem = vi.mocked(createCarouselItemContainer);
const mockCarousel = vi.mocked(createCarouselContainer);
const mockPublish = vi.mocked(publishMedia);

beforeEach(() => {
  vi.stubEnv("NGROK_URL", "https://abc123.ngrok-free.app");
  mockCreate.mockReset();
  mockCarouselItem.mockReset();
  mockCarousel.mockReset();
  mockPublish.mockReset();
});

describe("POST /api/publish", () => {
  it("publishes a single image using existing flow", async () => {
    mockCreate.mockResolvedValueOnce("container-123");
    mockPublish.mockResolvedValueOnce({ id: "post-456" });

    const request = new Request("http://localhost:3000/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imagePaths: ["/uploads/1234-photo.jpg"],
        caption: "My caption",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(mockCreate).toHaveBeenCalledWith(
      "https://abc123.ngrok-free.app/uploads/1234-photo.jpg",
      "My caption"
    );
    expect(mockPublish).toHaveBeenCalledWith("container-123");
    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, postId: "post-456" });
  });

  it("publishes multiple images as a carousel", async () => {
    mockCarouselItem
      .mockResolvedValueOnce("item-001")
      .mockResolvedValueOnce("item-002")
      .mockResolvedValueOnce("item-003");
    mockCarousel.mockResolvedValueOnce("carousel-001");
    mockPublish.mockResolvedValueOnce({ id: "post-789" });

    const request = new Request("http://localhost:3000/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imagePaths: [
          "/uploads/1-a.jpg",
          "/uploads/2-b.jpg",
          "/uploads/3-c.jpg",
        ],
        caption: "Carousel caption",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(mockCarouselItem).toHaveBeenCalledTimes(3);
    expect(mockCarouselItem).toHaveBeenNthCalledWith(
      1,
      "https://abc123.ngrok-free.app/uploads/1-a.jpg"
    );
    expect(mockCarouselItem).toHaveBeenNthCalledWith(
      2,
      "https://abc123.ngrok-free.app/uploads/2-b.jpg"
    );
    expect(mockCarouselItem).toHaveBeenNthCalledWith(
      3,
      "https://abc123.ngrok-free.app/uploads/3-c.jpg"
    );
    expect(mockCarousel).toHaveBeenCalledWith(
      ["item-001", "item-002", "item-003"],
      "Carousel caption"
    );
    expect(mockPublish).toHaveBeenCalledWith("carousel-001");
    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true, postId: "post-789" });
  });

  it("returns error when carousel item creation fails", async () => {
    mockCarouselItem
      .mockResolvedValueOnce("item-001")
      .mockRejectedValueOnce(new Error("Instagram API error: Invalid image"));

    const request = new Request("http://localhost:3000/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imagePaths: ["/uploads/1-a.jpg", "/uploads/2-bad.jpg"],
        caption: "caption",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      error: "Instagram API error: Invalid image",
    });
  });

  it("returns error when imagePaths is missing or empty", async () => {
    const request = new Request("http://localhost:3000/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: "My caption" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({
      success: false,
      error: "imagePaths is required",
    });
  });
});
