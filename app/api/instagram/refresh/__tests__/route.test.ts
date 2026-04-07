import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "@/app/api/instagram/refresh/route";

vi.mock("@/lib/instagram", () => ({
  refreshToken: vi.fn(),
}));

import { refreshToken } from "@/lib/instagram";

const mockRefreshToken = vi.mocked(refreshToken);

beforeEach(() => {
  mockRefreshToken.mockReset();
});

describe("POST /api/instagram/refresh", () => {
  it("returns new token on success", async () => {
    mockRefreshToken.mockResolvedValueOnce("new-token-xyz");

    const request = new Request("http://localhost/api/instagram/refresh", {
      method: "POST",
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ newToken: "new-token-xyz" });
  });

  it("returns 500 on refresh failure", async () => {
    mockRefreshToken.mockRejectedValueOnce(
      new Error("Instagram API error: Token expired")
    );

    const request = new Request("http://localhost/api/instagram/refresh", {
      method: "POST",
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Instagram API error: Token expired" });
  });
});
