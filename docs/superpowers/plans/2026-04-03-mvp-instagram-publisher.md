# MVP Instagram Publisher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-dev Next.js app that uploads a photo and publishes it to Instagram via the Graph API using ngrok for public image access.

**Architecture:** Single-page Next.js 14 App Router app. Images are saved to `public/uploads/` and served statically. An ngrok tunnel makes them publicly accessible. Two API routes handle upload and publish. One lib module wraps the two-step Instagram Graph API.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS, Vitest, Instagram Graph API v18.0, ngrok

---

## File Structure

| File | Responsibility |
|------|---------------|
| `lib/instagram.ts` | Two functions: `createMediaContainer(imageUrl, caption)` and `publishMedia(creationId)`. Wraps Instagram Graph API calls. |
| `app/api/upload/route.ts` | Accepts multipart image upload, saves to `public/uploads/`, returns image path. |
| `app/api/publish/route.ts` | Accepts `{ imagePath, caption }`, builds public URL with `NGROK_URL`, calls Instagram lib, returns result. |
| `app/page.tsx` | Single-page UI: file picker, caption input, publish button, status display. |
| `lib/__tests__/instagram.test.ts` | Tests for Instagram Graph API helpers. |
| `app/api/upload/__tests__/route.test.ts` | Tests for upload route. |
| `app/api/publish/__tests__/route.test.ts` | Tests for publish route. |

---

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`, `.env.local`, `.gitignore`
- Create: `public/uploads/.gitkeep`

- [ ] **Step 1: Scaffold the Next.js app**

Run:
```bash
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*" --use-npm
```

Expected: Project scaffolded in current directory with `app/` directory, `tailwind.config.ts`, `package.json`.

- [ ] **Step 2: Create uploads directory**

```bash
mkdir -p public/uploads
touch public/uploads/.gitkeep
```

- [ ] **Step 3: Create `.env.local`**

```
INSTAGRAM_USER_ID=your_ig_user_id_here
INSTAGRAM_ACCESS_TOKEN=your_long_lived_token_here
NGROK_URL=https://your-ngrok-url.ngrok-free.app
```

- [ ] **Step 4: Add `.env.local` to `.gitignore`**

Verify `.env.local` is already in `.gitignore` (create-next-app includes it). Also add uploaded images:

Append to `.gitignore`:
```
public/uploads/*
!public/uploads/.gitkeep
```

- [ ] **Step 5: Install Vitest**

```bash
npm install -D vitest @vitejs/plugin-react
```

Create `vitest.config.ts` at project root:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```

Expected: Server starts on `http://localhost:3000`, default Next.js page loads.

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js 14 project with Tailwind and Vitest"
```

---

### Task 2: Instagram Graph API Helpers

**Files:**
- Create: `lib/instagram.ts`
- Create: `lib/__tests__/instagram.test.ts`

- [ ] **Step 1: Write failing tests for `createMediaContainer`**

Create `lib/__tests__/instagram.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMediaContainer, publishMedia } from "@/lib/instagram";

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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/__tests__/instagram.test.ts
```

Expected: FAIL — `createMediaContainer` is not defined.

- [ ] **Step 3: Implement `createMediaContainer`**

Create `lib/instagram.ts`:

```ts
export async function createMediaContainer(
  imageUrl: string,
  caption: string
): Promise<string> {
  const userId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${userId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        access_token: accessToken,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Instagram API error: ${data.error?.message ?? "Unknown error"}`);
  }

  return data.id;
}
```

- [ ] **Step 4: Run tests to verify `createMediaContainer` passes**

```bash
npx vitest run lib/__tests__/instagram.test.ts
```

Expected: 2 passing tests for `createMediaContainer`.

- [ ] **Step 5: Write failing tests for `publishMedia`**

Append to `lib/__tests__/instagram.test.ts`:

```ts
describe("publishMedia", () => {
  it("sends creation_id to publish endpoint and returns post id and permalink", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "post-999" }),
    });

    const result = await publishMedia("container-789");

    expect(mockFetch).toHaveBeenCalledWith(
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

  it("throws on API error response", async () => {
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
});
```

- [ ] **Step 6: Run tests to verify `publishMedia` tests fail**

```bash
npx vitest run lib/__tests__/instagram.test.ts
```

Expected: 2 new FAILs — `publishMedia` not defined (or not implemented).

- [ ] **Step 7: Implement `publishMedia`**

Append to `lib/instagram.ts`:

```ts
export async function publishMedia(
  creationId: string
): Promise<{ id: string }> {
  const userId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${userId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Instagram API error: ${data.error?.message ?? "Unknown error"}`);
  }

  return { id: data.id };
}
```

- [ ] **Step 8: Run all tests to verify they pass**

```bash
npx vitest run lib/__tests__/instagram.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 9: Commit**

```bash
git add lib/instagram.ts lib/__tests__/instagram.test.ts
git commit -m "feat: add Instagram Graph API helpers with tests"
```

---

### Task 3: Upload API Route

**Files:**
- Create: `app/api/upload/route.ts`
- Create: `app/api/upload/__tests__/route.test.ts`

- [ ] **Step 1: Write failing test for upload route**

Create `app/api/upload/__tests__/route.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run app/api/upload/__tests__/route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the upload route**

Create `app/api/upload/route.ts`:

```ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Only image files are allowed" },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const filename = `${Date.now()}-${file.name}`;
  const uploadPath = path.join(process.cwd(), "public", "uploads", filename);

  await fs.writeFile(uploadPath, buffer);

  return NextResponse.json({ imagePath: `/uploads/${filename}` });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run app/api/upload/__tests__/route.test.ts
```

Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/upload/route.ts app/api/upload/__tests__/route.test.ts
git commit -m "feat: add image upload API route with tests"
```

---

### Task 4: Publish API Route

**Files:**
- Create: `app/api/publish/route.ts`
- Create: `app/api/publish/__tests__/route.test.ts`

- [ ] **Step 1: Write failing tests for publish route**

Create `app/api/publish/__tests__/route.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run app/api/publish/__tests__/route.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the publish route**

Create `app/api/publish/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createMediaContainer, publishMedia } from "@/lib/instagram";

export async function POST(request: Request) {
  const body = await request.json();
  const { imagePath, caption } = body;

  if (!imagePath) {
    return NextResponse.json(
      { success: false, error: "imagePath is required" },
      { status: 400 }
    );
  }

  const ngrokUrl = process.env.NGROK_URL;
  const publicImageUrl = `${ngrokUrl}${imagePath}`;

  try {
    const creationId = await createMediaContainer(publicImageUrl, caption ?? "");
    const result = await publishMedia(creationId);

    return NextResponse.json({
      success: true,
      postId: result.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run app/api/publish/__tests__/route.test.ts
```

Expected: All 3 tests pass.

- [ ] **Step 5: Run all tests to verify nothing is broken**

```bash
npx vitest run
```

Expected: All 10 tests pass (4 instagram + 3 upload + 3 publish).

- [ ] **Step 6: Commit**

```bash
git add app/api/publish/route.ts app/api/publish/__tests__/route.test.ts
git commit -m "feat: add Instagram publish API route with tests"
```

---

### Task 5: Frontend UI Page

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx` (minor — just verify metadata)

- [ ] **Step 1: Replace the default `app/page.tsx` with the upload + publish UI**

Replace the contents of `app/page.tsx`:

```tsx
"use client";

import { useState, FormEvent } from "react";

type Status =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "publishing" }
  | { state: "success"; postId: string }
  | { state: "error"; message: string };

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!file) {
      setStatus({ state: "error", message: "Please select an image." });
      return;
    }

    try {
      // Step 1: Upload
      setStatus({ state: "uploading" });
      const formData = new FormData();
      formData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        setStatus({ state: "error", message: uploadData.error });
        return;
      }

      // Step 2: Publish
      setStatus({ state: "publishing" });
      const publishRes = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagePath: uploadData.imagePath,
          caption,
        }),
      });
      const publishData = await publishRes.json();

      if (!publishRes.ok) {
        setStatus({ state: "error", message: publishData.error });
        return;
      }

      setStatus({ state: "success", postId: publishData.postId });
      setFile(null);
      setCaption("");
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md space-y-6">
        <h1 className="text-2xl font-bold text-white text-center">
          Publish to Instagram
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Image
              <span className="text-xs text-gray-600 ml-2">
                (1:1, 4:5, or 1.91:1)
              </span>
            </label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-white hover:file:bg-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={3}
              className="w-full rounded bg-gray-900 border border-gray-700 p-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Write a caption..."
            />
          </div>

          <button
            type="submit"
            disabled={status.state === "uploading" || status.state === "publishing"}
            className="w-full py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status.state === "uploading"
              ? "Uploading..."
              : status.state === "publishing"
                ? "Publishing..."
                : "Publish"}
          </button>
        </form>

        {status.state === "success" && (
          <div className="rounded bg-green-900/50 border border-green-700 p-3 text-sm text-green-300">
            Published successfully! Post ID: {status.postId}
          </div>
        )}

        {status.state === "error" && (
          <div className="rounded bg-red-900/50 border border-red-700 p-3 text-sm text-red-300">
            {status.message}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify the dev server renders the page**

```bash
npm run dev
```

Open `http://localhost:3000` in a browser. Expected: dark page with "Publish to Instagram" heading, file picker, caption textarea, and publish button.

- [ ] **Step 3: Run all tests to make sure nothing is broken**

```bash
npx vitest run
```

Expected: All 10 tests still pass.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: add upload and publish UI page"
```

---

### Task 6: End-to-End Manual Smoke Test

**Files:** None — this is a verification task.

- [ ] **Step 1: Start ngrok**

```bash
ngrok http 3000
```

Copy the `Forwarding` URL (e.g., `https://abc123.ngrok-free.app`).

- [ ] **Step 2: Update `.env.local`**

Set `NGROK_URL` to the copied ngrok URL. Set `INSTAGRAM_USER_ID` and `INSTAGRAM_ACCESS_TOKEN` to real values.

- [ ] **Step 3: Restart the dev server**

```bash
npm run dev
```

- [ ] **Step 4: Verify image is publicly accessible**

Upload a test image through the UI (just the upload step — you can test this by checking the network tab). Then open `<NGROK_URL>/uploads/<filename>` in a browser. Expected: image loads.

- [ ] **Step 5: Test the full publish flow**

Select an image, write a caption, click Publish. Expected:
- Status shows "Uploading..." then "Publishing..."
- On success: green banner with Instagram post ID
- On error: red banner with descriptive message

- [ ] **Step 6: Run full test suite one final time**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 7: Commit any final adjustments**

```bash
git add -A
git commit -m "chore: finalize MVP setup"
```
