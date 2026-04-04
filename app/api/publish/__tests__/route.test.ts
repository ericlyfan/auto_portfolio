import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/publish/route";

vi.mock("@/lib/instagram", () => ({
  createMediaContainer: vi.fn(),
  publishMedia: vi.fn(),
}));

import {
  createMediaContainer,
  publishMedia,
} from "@/lib/instagram";

const mockCreate = vi.mocked(createMediaContainer);
const mockPublish = vi.mocked(publishMedia);

beforeEach(() => {
  vi.stubEnv("NGROK_URL", "https://abc123.ngrok-free.app");
  mockCreate.mockReset();
  mockPublish.mockReset();
});

describe("POST /api/publish", () => {
  it("calls Instagram API with correct public URL and returns success", async () => {
    mockCreate.mockResolvedValueOnce("container-123");
    mockPublish.mockResolvedValueOnce({ id: "post-456" });

    const request = new Request("http://localhost:3000/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imagePath: "/uploads/1234-photo.jpg",
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
    expect(data).toEqual({
      success: true,
      postId: "post-456",
    });
  });

  it("returns error when createMediaContainer fails", async () => {
    mockCreate.mockRejectedValueOnce(
      new Error("Instagram API error: Invalid token")
    );

    const request = new Request("http://localhost:3000/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imagePath: "/uploads/1234-photo.jpg",
        caption: "My caption",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({
      success: false,
      error: "Instagram API error: Invalid token",
    });
  });

  it("returns error when imagePath is missing", async () => {
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
      error: "imagePath is required",
    });
  });
});
