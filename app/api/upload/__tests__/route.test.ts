import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "@/app/api/upload/route";
import fs from "fs/promises";
import path from "path";

vi.mock("@/lib/exif", () => ({
  extractFujiRecipe: vi.fn(),
}));

import { extractFujiRecipe } from "@/lib/exif";

const mockExtract = vi.mocked(extractFujiRecipe);
const uploadsDir = path.join(process.cwd(), "public", "uploads");

beforeEach(() => {
  mockExtract.mockReset();
});

afterEach(async () => {
  const files = await fs.readdir(uploadsDir);
  for (const file of files) {
    if (file !== ".gitkeep") {
      await fs.unlink(path.join(uploadsDir, file));
    }
  }
});

describe("POST /api/upload", () => {
  it("saves multiple uploaded images and returns paths with recipes", async () => {
    mockExtract
      .mockResolvedValueOnce("Classic Chrome\nGrain Effect: Off")
      .mockResolvedValueOnce("Classic Chrome\nGrain Effect: Off");

    const file1 = new File(
      [new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
      "photo1.png",
      { type: "image/png" }
    );
    const file2 = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0])],
      "photo2.jpg",
      { type: "image/jpeg" }
    );

    const formData = new FormData();
    formData.append("files", file1);
    formData.append("files", file2);

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.imagePaths).toHaveLength(2);
    expect(data.imagePaths[0]).toMatch(/^\/uploads\/\d+-photo1\.png$/);
    expect(data.imagePaths[1]).toMatch(/^\/uploads\/\d+-photo2\.jpg$/);
    expect(data.primaryRecipe).toBe("Classic Chrome\nGrain Effect: Off");
    expect(data.mismatchedImages).toEqual([]);
  });

  it("detects mismatched recipes across images", async () => {
    mockExtract
      .mockResolvedValueOnce("Classic Chrome\nGrain Effect: Off")
      .mockResolvedValueOnce("Nostalgic Neg\nGrain Effect: Weak, Small")
      .mockResolvedValueOnce("Classic Chrome\nGrain Effect: Off");

    const formData = new FormData();
    for (let i = 0; i < 3; i++) {
      formData.append(
        "files",
        new File([new Uint8Array([0x89, 0x50])], `photo${i}.png`, {
          type: "image/png",
        })
      );
    }

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.primaryRecipe).toBe("Classic Chrome\nGrain Effect: Off");
    expect(data.mismatchedImages).toEqual([
      { index: 1, recipe: "Nostalgic Neg\nGrain Effect: Weak, Small" },
    ]);
  });

  it("returns null primaryRecipe for non-Fujifilm images", async () => {
    mockExtract.mockResolvedValueOnce(null);

    const formData = new FormData();
    formData.append(
      "files",
      new File([new Uint8Array([0x89, 0x50])], "canon.png", {
        type: "image/png",
      })
    );

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.primaryRecipe).toBeNull();
    expect(data.mismatchedImages).toEqual([]);
  });

  it("rejects when no files provided", async () => {
    const formData = new FormData();

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("No files provided");
  });

  it("rejects when more than 10 files provided", async () => {
    const formData = new FormData();
    for (let i = 0; i < 11; i++) {
      formData.append(
        "files",
        new File([new Uint8Array([0x89])], `photo${i}.png`, {
          type: "image/png",
        })
      );
    }

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Maximum 10 images allowed");
  });

  it("rejects non-image files", async () => {
    const formData = new FormData();
    formData.append(
      "files",
      new File(["hello"], "doc.txt", { type: "text/plain" })
    );

    const request = new Request("http://localhost:3000/api/upload", {
      method: "POST",
      body: formData,
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Only image files are allowed");
  });
});
