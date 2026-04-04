import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/upload/route";
import fs from "fs/promises";
import path from "path";

const uploadsDir = path.join(process.cwd(), "public", "uploads");

describe("POST /api/upload", () => {
  afterEach(async () => {
    // Clean up test files
    const files = await fs.readdir(uploadsDir);
    for (const file of files) {
      if (file !== ".gitkeep") {
        await fs.unlink(path.join(uploadsDir, file));
      }
    }
  });

  it("saves uploaded image and returns the path", async () => {
    const imageContent = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic bytes
    const file = new File([imageContent], "test-photo.png", {
      type: "image/png",
    });

    const formData = new FormData();
    formData.append("file", file);

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imagePath).toMatch(/^\/uploads\/\d+-test-photo\.png$/);

    // Verify file exists on disk
    const filePath = path.join(process.cwd(), "public", data.imagePath);
    const exists = await fs
      .access(filePath)
      .then(() => true)
      .catch(() => false);
    expect(exists).toBe(true);
  });

  it("rejects non-image files", async () => {
    const file = new File(["hello"], "doc.txt", { type: "text/plain" });
    const formData = new FormData();
    formData.append("file", file);

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("Only image files are allowed");
  });

  it("rejects requests with no file", async () => {
    const formData = new FormData();

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe("No file provided");
  });
});
