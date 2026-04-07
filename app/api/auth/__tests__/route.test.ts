import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/auth/route";

beforeEach(() => {
  vi.stubEnv("APP_PASSWORD", "secret123");
});

describe("POST /api/auth", () => {
  it("sets session cookie and returns 200 on correct password", async () => {
    const request = new Request("http://localhost/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "secret123" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ success: true });
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("session=secret123");
    expect(cookie).toContain("HttpOnly");
  });

  it("returns 401 on wrong password", async () => {
    const request = new Request("http://localhost/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrongpassword" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data).toEqual({ error: "Unauthorized" });
  });
});
