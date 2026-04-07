import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/account/route";

vi.mock("@/lib/instagram", () => ({
  getAccountInfo: vi.fn(),
}));

import { getAccountInfo } from "@/lib/instagram";

const mockGetAccountInfo = vi.mocked(getAccountInfo);

beforeEach(() => {
  vi.stubEnv("INSTAGRAM_TOKEN_ISSUED_AT", "1740000000");
  mockGetAccountInfo.mockReset();
});

describe("GET /api/account", () => {
  it("returns account info with token days left", async () => {
    mockGetAccountInfo.mockResolvedValueOnce({
      username: "ericfan",
      followersCount: 4200,
      mediaCount: 89,
      reach28d: 18400,
      profileViews28d: 342,
    });

    const request = new Request("http://localhost/api/account");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.username).toBe("ericfan");
    expect(data.followersCount).toBe(4200);
    expect(data.mediaCount).toBe(89);
    expect(data.reach28d).toBe(18400);
    expect(data.profileViews28d).toBe(342);
    expect(typeof data.tokenDaysLeft).toBe("number");
  });

  it("returns tokenDaysLeft as null when INSTAGRAM_TOKEN_ISSUED_AT is not set", async () => {
    vi.stubEnv("INSTAGRAM_TOKEN_ISSUED_AT", "");
    mockGetAccountInfo.mockResolvedValueOnce({
      username: "ericfan",
      followersCount: 4200,
      mediaCount: 89,
      reach28d: 18400,
      profileViews28d: 342,
    });

    const request = new Request("http://localhost/api/account");
    const response = await GET(request);
    const data = await response.json();

    expect(data.tokenDaysLeft).toBeNull();
  });

  it("returns 500 on Instagram API error", async () => {
    mockGetAccountInfo.mockRejectedValueOnce(
      new Error("Instagram API error: Invalid token")
    );

    const request = new Request("http://localhost/api/account");
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: "Instagram API error: Invalid token" });
  });
});
