# Tabs, History, Stats & Password Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add password protection, tab navigation (Publish | History | Stats), post history fetched from Instagram, and account/post stats to auto_portfolio.

**Architecture:** Single `app/page.tsx` becomes a tab container with client-side tab state. A `/login` page and `middleware.ts` cookie check protect all routes. History and Stats fetch directly from the Instagram Graph API via new helpers added to `lib/instagram.ts`. No database reads needed.

**Tech Stack:** Next.js 14 App Router, Tailwind CSS, Vitest, Instagram Graph API v18.0

---

## File Map

**Create:**
- `app/login/page.tsx` — password form, POSTs to `/api/auth`, redirects to `/` on success
- `app/api/auth/route.ts` — validates `APP_PASSWORD`, sets `httpOnly` cookie
- `app/api/auth/__tests__/route.test.ts` — tests for auth route
- `middleware.ts` — cookie check on all routes except `/login` and `/api/auth`
- `app/components/PublishTab.tsx` — existing publish form extracted from `page.tsx`
- `app/components/HistoryTab.tsx` — list of past posts with inline metrics
- `app/components/StatsTab.tsx` — account overview card + token expiry/refresh
- `app/api/posts/route.ts` — fetches IG media list + per-post insights in parallel
- `app/api/posts/__tests__/route.test.ts` — tests for posts route
- `app/api/account/route.ts` — fetches account info + 28-day insights + token days left
- `app/api/account/__tests__/route.test.ts` — tests for account route
- `app/api/instagram/refresh/route.ts` — refreshes long-lived token, returns new token string
- `app/api/instagram/refresh/__tests__/route.test.ts` — tests for token refresh route

**Modify:**
- `app/page.tsx` — becomes tab container, renders `PublishTab`, `HistoryTab`, `StatsTab`
- `lib/instagram.ts` — add `getMediaList`, `getMediaInsights`, `getAccountInfo`, `refreshToken`
- `lib/__tests__/instagram.test.ts` — add tests for the four new helpers
- `.env.local` — add `APP_PASSWORD` and `INSTAGRAM_TOKEN_ISSUED_AT`
- `.gitignore` — add `.superpowers/`

---

## Task 1: Environment variables + .gitignore

**Files:**
- Modify: `.env.local`
- Modify: `.gitignore`

- [ ] **Step 1: Add new env vars to `.env.local`**

Append to `.env.local` (keep existing values):
```
APP_PASSWORD=choose-a-strong-password-here
INSTAGRAM_TOKEN_ISSUED_AT=1743984000
```

`INSTAGRAM_TOKEN_ISSUED_AT` is a Unix timestamp (seconds) for when your current token was issued. Set it to `Math.floor(Date.now() / 1000)` right now. Update it each time you refresh.

- [ ] **Step 2: Add `.superpowers/` to `.gitignore`**

Append to `.gitignore`:
```
# brainstorm mockups
.superpowers/
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore .superpowers brainstorm directory"
```

(Do not commit `.env.local` — it is already gitignored.)

---

## Task 2: Auth API route + login page + middleware

**Files:**
- Create: `app/api/auth/route.ts`
- Create: `app/api/auth/__tests__/route.test.ts`
- Create: `app/login/page.tsx`
- Create: `middleware.ts`

- [ ] **Step 1: Write the failing tests for `/api/auth`**

Create `app/api/auth/__tests__/route.test.ts`:
```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run app/api/auth/__tests__/route.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/auth/route'`

- [ ] **Step 3: Create `app/api/auth/route.ts`**

```ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { password } = await request.json();

  if (password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set("session", process.env.APP_PASSWORD!, {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
  });
  return response;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run app/api/auth/__tests__/route.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Create `app/login/page.tsx`**

```tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push("/");
    } else {
      setError("Wrong password");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-xs space-y-4">
        <h1 className="text-lg font-semibold text-white text-center">auto_portfolio</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded bg-gray-900 border border-gray-700 p-2 text-white text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Entering..." : "Enter"}
          </button>
        </form>
        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Create `middleware.ts` at the project root**

```ts
import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  if (session !== process.env.APP_PASSWORD) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 7: Verify manually**

Start dev server: `npm run dev`

1. Open `http://localhost:3000` — should redirect to `/login`
2. Enter wrong password — should show "Wrong password"
3. Enter correct password (`APP_PASSWORD` from `.env.local`) — should redirect to `/`
4. Reload `/` — should stay on home page (cookie persists)
5. Try `http://localhost:3000/api/publish` directly with no cookie — should redirect to `/login`

- [ ] **Step 8: Commit**

```bash
git add app/api/auth/route.ts app/api/auth/__tests__/route.test.ts app/login/page.tsx middleware.ts
git commit -m "feat: add password protection with login page and middleware"
```

---

## Task 3: Refactor page.tsx into tab container + PublishTab

**Files:**
- Create: `app/components/PublishTab.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `app/components/PublishTab.tsx`**

Move all content from the current `app/page.tsx` into this file, changing only the function name and removing the outer `<main>` wrapper:

```tsx
"use client";

import Image from "next/image";
import { useState, FormEvent } from "react";

const MAX_IMAGES = 10;

type Status =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "publishing" }
  | { state: "success"; postId: string }
  | { state: "error"; message: string };

function buildCaptionFromRecipes(recipes: (string | null)[]): string {
  const uniqueRecipes = new Map<string, number[]>();

  recipes.forEach((recipe, i) => {
    if (!recipe) return;
    const existing = uniqueRecipes.get(recipe);
    if (existing) {
      existing.push(i + 1);
    } else {
      uniqueRecipes.set(recipe, [i + 1]);
    }
  });

  if (uniqueRecipes.size === 1) {
    return [...uniqueRecipes.keys()][0];
  } else if (uniqueRecipes.size > 1) {
    const parts: string[] = [];
    for (const [recipe, imageNums] of uniqueRecipes) {
      const label =
        imageNums.length === 1
          ? `Image ${imageNums[0]}`
          : `Images ${imageNums.join(", ")}`;
      parts.push(`${label}:\n${recipe}`);
    }
    return parts.join("\n\n---\n\n");
  }

  return "";
}

export default function PublishTab() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [uploadedPaths, setUploadedPaths] = useState<string[] | null>(null);

  async function uploadAndExtract(fileList: File[]) {
    if (fileList.length === 0) {
      setUploadedPaths(null);
      setCaption("");
      return;
    }

    setStatus({ state: "uploading" });
    const formData = new FormData();
    for (const file of fileList) {
      formData.append("files", file);
    }

    try {
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        setStatus({ state: "error", message: uploadData.error });
        return;
      }

      setUploadedPaths(uploadData.imagePaths);
      setCaption(buildCaptionFromRecipes(uploadData.recipes ?? []));
      setStatus({ state: "idle" });
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Upload failed",
      });
    }
  }

  async function addFiles(newFiles: FileList | null) {
    if (!newFiles || newFiles.length === 0) return;
    const incoming = Array.from(newFiles);
    const combined = [...files, ...incoming].slice(0, MAX_IMAGES);
    setFiles(combined);
    setPreviews(combined.map((f) => URL.createObjectURL(f)));
    await uploadAndExtract(combined);
  }

  async function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    await uploadAndExtract(next);
  }

  async function moveFile(from: number, to: number) {
    if (to < 0 || to >= files.length) return;
    const next = [...files];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    await uploadAndExtract(next);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (!uploadedPaths || uploadedPaths.length === 0) {
      setStatus({ state: "error", message: "Please select at least one image." });
      return;
    }

    setStatus({ state: "publishing" });

    try {
      const publishRes = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePaths: uploadedPaths, caption }),
      });
      const publishData = await publishRes.json();

      if (!publishRes.ok) {
        setStatus({ state: "error", message: publishData.error });
        return;
      }

      setStatus({ state: "success", postId: publishData.postId });
      setFiles([]);
      setPreviews([]);
      setCaption("");
      setUploadedPaths(null);
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  const isProcessing =
    status.state === "uploading" || status.state === "publishing";

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Images
            <span className="text-xs text-gray-600 ml-2">
              ({files.length}/{MAX_IMAGES})
            </span>
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => addFiles(e.target.files)}
            className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-gray-800 file:text-white hover:file:bg-gray-700"
          />
        </div>

        {previews.length > 0 && (
          <div className="grid grid-cols-5 gap-2">
            {previews.map((src, i) => (
              <div key={i} className="relative group">
                <Image
                  src={src}
                  alt={`Preview ${i + 1}`}
                  width={300}
                  height={300}
                  unoptimized
                  className="w-full aspect-square object-cover rounded"
                />
                <div className="absolute top-0 right-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => moveFile(i, i - 1)}
                      className="bg-black/70 text-white text-xs px-1 rounded-bl"
                    >
                      ←
                    </button>
                  )}
                  {i < files.length - 1 && (
                    <button
                      type="button"
                      onClick={() => moveFile(i, i + 1)}
                      className="bg-black/70 text-white text-xs px-1"
                    >
                      →
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="bg-red-600/80 text-white text-xs px-1 rounded-tr"
                  >
                    ×
                  </button>
                </div>
                <span className="absolute bottom-0 left-0 bg-black/70 text-white text-xs px-1 rounded-tr">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-400 mb-1">Caption</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={5}
            className="w-full rounded bg-gray-900 border border-gray-700 p-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            placeholder="Write a caption... (auto-filled from Fujifilm recipe if detected)"
          />
        </div>

        <button
          type="submit"
          disabled={isProcessing || !uploadedPaths}
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
  );
}
```

- [ ] **Step 2: Replace `app/page.tsx` with the tab container**

```tsx
"use client";

import { useState } from "react";
import PublishTab from "@/app/components/PublishTab";

type Tab = "publish" | "history" | "stats";

const TABS: { id: Tab; label: string }[] = [
  { id: "publish", label: "Publish" },
  { id: "history", label: "History" },
  { id: "stats", label: "Stats" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("publish");

  return (
    <main className="min-h-screen bg-gray-950">
      <div className="flex border-b border-gray-800 sticky top-0 bg-gray-950 z-10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm transition-colors ${
              tab === t.id
                ? "text-white border-b-2 border-blue-500"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {tab === "publish" && <PublishTab />}
        {tab === "history" && (
          <p className="text-gray-500 text-sm">History coming soon</p>
        )}
        {tab === "stats" && (
          <p className="text-gray-500 text-sm">Stats coming soon</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify the app still works**

```bash
npm run dev
```

1. Log in with your password
2. Publish tab should look and work exactly as before
3. History and Stats tabs should show placeholder text

- [ ] **Step 4: Commit**

```bash
git add app/components/PublishTab.tsx app/page.tsx
git commit -m "refactor: extract PublishTab component, add tab navigation shell"
```

---

## Task 4: Instagram media helpers

**Files:**
- Modify: `lib/instagram.ts`
- Modify: `lib/__tests__/instagram.test.ts`

- [ ] **Step 1: Write failing tests for `getMediaList` and `getMediaInsights`**

First update the top-level import in `lib/__tests__/instagram.test.ts` (line 2):
```ts
import { createMediaContainer, publishMedia, getMediaList, getMediaInsights } from "@/lib/instagram";
```

Then append the following describe blocks to the bottom of `lib/__tests__/instagram.test.ts`:

describe("getMediaList", () => {
  it("fetches media list with correct fields and returns data array", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            id: "media-1",
            caption: "Velvia 100\nGreat day",
            media_url: "https://cdn.instagram.com/photo1.jpg",
            thumbnail_url: null,
            timestamp: "2024-01-03T10:00:00+0000",
            media_type: "IMAGE",
            permalink: "https://www.instagram.com/p/abc/",
          },
        ],
      }),
    });

    const result = await getMediaList(25);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v18.0/123456/media?fields=id%2Ccaption%2Cmedia_url%2Cthumbnail_url%2Ctimestamp%2Cmedia_type%2Cpermalink&limit=25&access_token=test-token"
    );
    expect(result).toEqual([
      {
        id: "media-1",
        caption: "Velvia 100\nGreat day",
        media_url: "https://cdn.instagram.com/photo1.jpg",
        thumbnail_url: null,
        timestamp: "2024-01-03T10:00:00+0000",
        media_type: "IMAGE",
        permalink: "https://www.instagram.com/p/abc/",
      },
    ]);
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "Invalid token" } }),
    });

    await expect(getMediaList(25)).rejects.toThrow(
      "Instagram API error: Invalid token"
    );
  });
});

describe("getMediaInsights", () => {
  it("fetches insights and returns mapped metrics object", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { name: "impressions", values: [{ value: 200 }] },
          { name: "reach", values: [{ value: 150 }] },
          { name: "likes", values: [{ value: 12 }] },
          { name: "saved", values: [{ value: 4 }] },
          { name: "comments_count", values: [{ value: 2 }] },
          { name: "shares", values: [{ value: 1 }] },
        ],
      }),
    });

    const result = await getMediaInsights("media-1");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v18.0/media-1/insights?metric=impressions%2Creach%2Clikes%2Csaved%2Ccomments_count%2Cshares&access_token=test-token"
    );
    expect(result).toEqual({
      impressions: 200,
      reach: 150,
      likes: 12,
      saves: 4,
      comments: 2,
      shares: 1,
    });
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "Media not found" } }),
    });

    await expect(getMediaInsights("media-1")).rejects.toThrow(
      "Instagram API error: Media not found"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/__tests__/instagram.test.ts
```

Expected: FAIL — `getMediaList is not a function`, `getMediaInsights is not a function`

- [ ] **Step 3: Add `getMediaList` and `getMediaInsights` to `lib/instagram.ts`**

Append to the end of `lib/instagram.ts`:

```ts
export type IGMedia = {
  id: string;
  caption: string | null;
  media_url: string;
  thumbnail_url: string | null;
  timestamp: string;
  media_type: string;
  permalink: string;
};

export type IGMediaInsights = {
  impressions: number;
  reach: number;
  likes: number;
  saves: number;
  comments: number;
  shares: number;
};

export async function getMediaList(limit: number): Promise<IGMedia[]> {
  const userId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  const params = new URLSearchParams({
    fields: "id,caption,media_url,thumbnail_url,timestamp,media_type,permalink",
    limit: String(limit),
    access_token: accessToken!,
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${userId}/media?${params}`
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Instagram API error: ${data.error?.message ?? "Unknown error"}`
    );
  }

  return data.data;
}

export async function getMediaInsights(
  mediaId: string
): Promise<IGMediaInsights> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  const params = new URLSearchParams({
    metric: "impressions,reach,likes,saved,comments_count,shares",
    access_token: accessToken!,
  });

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${mediaId}/insights?${params}`
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Instagram API error: ${data.error?.message ?? "Unknown error"}`
    );
  }

  const map: Record<string, number> = {};
  for (const item of data.data as Array<{
    name: string;
    values: Array<{ value: number }>;
  }>) {
    map[item.name] = item.values[item.values.length - 1]?.value ?? 0;
  }

  return {
    impressions: map.impressions ?? 0,
    reach: map.reach ?? 0,
    likes: map.likes ?? 0,
    saves: map.saved ?? 0,
    comments: map.comments_count ?? 0,
    shares: map.shares ?? 0,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/__tests__/instagram.test.ts
```

Expected: all tests PASS (existing + 4 new)

- [ ] **Step 5: Commit**

```bash
git add lib/instagram.ts lib/__tests__/instagram.test.ts
git commit -m "feat: add getMediaList and getMediaInsights helpers"
```

---

## Task 5: `/api/posts` route

**Files:**
- Create: `app/api/posts/route.ts`
- Create: `app/api/posts/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `app/api/posts/__tests__/route.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run app/api/posts/__tests__/route.test.ts
```

Expected: FAIL — `Cannot find module '@/app/api/posts/route'`

- [ ] **Step 3: Create `app/api/posts/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getMediaList, getMediaInsights } from "@/lib/instagram";

export async function GET(_request: Request) {
  try {
    const media = await getMediaList(25);

    const posts = await Promise.all(
      media.map(async (item) => {
        const insights = await getMediaInsights(item.id);
        return {
          id: item.id,
          caption: item.caption,
          mediaUrl: item.media_url,
          timestamp: item.timestamp,
          mediaType: item.media_type,
          permalink: item.permalink,
          ...insights,
        };
      })
    );

    return NextResponse.json({ posts });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run app/api/posts/__tests__/route.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/posts/route.ts app/api/posts/__tests__/route.test.ts
git commit -m "feat: add /api/posts route with per-post insights"
```

---

## Task 6: HistoryTab component

**Files:**
- Create: `app/components/HistoryTab.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `app/components/HistoryTab.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

type Post = {
  id: string;
  caption: string | null;
  mediaUrl: string;
  timestamp: string;
  mediaType: string;
  permalink: string;
  likes: number;
  saves: number;
  reach: number;
  comments: number;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function PostRow({ post }: { post: Post }) {
  const captionSnippet = post.caption
    ? post.caption.split("\n")[0].slice(0, 60)
    : "No caption";

  return (
    <a
      href={post.permalink}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 items-center bg-gray-900 rounded-lg p-3 hover:bg-gray-800 transition-colors"
    >
      <div className="relative w-10 h-10 flex-shrink-0">
        <Image
          src={post.mediaUrl}
          alt={captionSnippet}
          fill
          unoptimized
          className="object-cover rounded"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm truncate">{captionSnippet}</p>
        <p className="text-gray-500 text-xs mt-0.5">{formatDate(post.timestamp)}</p>
      </div>
      <div className="text-right flex-shrink-0 space-y-0.5">
        <p className="text-gray-400 text-xs">
          ♥ {formatCount(post.likes)} &nbsp; 🔖 {formatCount(post.saves)}
        </p>
        <p className="text-gray-600 text-xs">reach {formatCount(post.reach)}</p>
      </div>
    </a>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex gap-3 items-center bg-gray-900 rounded-lg p-3 animate-pulse"
        >
          <div className="w-10 h-10 bg-gray-800 rounded flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-gray-800 rounded w-3/4" />
            <div className="h-2 bg-gray-800 rounded w-1/3" />
          </div>
          <div className="space-y-1">
            <div className="h-2 bg-gray-800 rounded w-16" />
            <div className="h-2 bg-gray-800 rounded w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HistoryTab() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/posts")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPosts(data.posts);
        setStatus("success");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  if (status === "loading") return <Skeleton />;
  if (status === "error") return (
    <p className="text-red-400 text-sm">{error}</p>
  );
  if (posts.length === 0) return (
    <p className="text-gray-500 text-sm">No posts yet.</p>
  );

  return (
    <div className="space-y-2">
      {posts.map((post) => (
        <PostRow key={post.id} post={post} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire `HistoryTab` into `app/page.tsx`**

Replace the History placeholder in `app/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import PublishTab from "@/app/components/PublishTab";
import HistoryTab from "@/app/components/HistoryTab";

type Tab = "publish" | "history" | "stats";

const TABS: { id: Tab; label: string }[] = [
  { id: "publish", label: "Publish" },
  { id: "history", label: "History" },
  { id: "stats", label: "Stats" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("publish");

  return (
    <main className="min-h-screen bg-gray-950">
      <div className="flex border-b border-gray-800 sticky top-0 bg-gray-950 z-10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm transition-colors ${
              tab === t.id
                ? "text-white border-b-2 border-blue-500"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {tab === "publish" && <PublishTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "stats" && (
          <p className="text-gray-500 text-sm">Stats coming soon</p>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify History tab works**

```bash
npm run dev
```

1. Log in, go to History tab
2. Should show loading skeletons, then list of posts
3. Each row shows thumbnail, caption snippet, date, likes/saves/reach
4. Clicking a row opens the post in Instagram

- [ ] **Step 4: Commit**

```bash
git add app/components/HistoryTab.tsx app/page.tsx
git commit -m "feat: add History tab with post list and inline metrics"
```

---

## Task 7: Instagram account + token refresh helpers

**Files:**
- Modify: `lib/instagram.ts`
- Modify: `lib/__tests__/instagram.test.ts`

- [ ] **Step 1: Write failing tests for `getAccountInfo` and `refreshToken`**

First update the top-level import in `lib/__tests__/instagram.test.ts` (line 2) to add the two new helpers:
```ts
import { createMediaContainer, publishMedia, getMediaList, getMediaInsights, getAccountInfo, refreshToken } from "@/lib/instagram";
```

Then append the following describe blocks to the bottom of `lib/__tests__/instagram.test.ts`:

describe("getAccountInfo", () => {
  it("fetches account fields and 28-day insights and returns merged object", async () => {
    // First call: account fields
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        username: "ericfan",
        followers_count: 4200,
        media_count: 89,
      }),
    });
    // Second call: insights
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { name: "reach", values: [{ value: 18400 }] },
          { name: "profile_views", values: [{ value: 342 }] },
        ],
      }),
    });

    const result = await getAccountInfo();

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      "https://graph.facebook.com/v18.0/123456?fields=username%2Cfollowers_count%2Cmedia_count&access_token=test-token"
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "https://graph.facebook.com/v18.0/123456/insights?metric=reach%2Cprofile_views&period=days_28&access_token=test-token"
    );
    expect(result).toEqual({
      username: "ericfan",
      followersCount: 4200,
      mediaCount: 89,
      reach28d: 18400,
      profileViews28d: 342,
    });
  });

  it("throws on account fields API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "Invalid token" } }),
    });

    await expect(getAccountInfo()).rejects.toThrow(
      "Instagram API error: Invalid token"
    );
  });
});

describe("refreshToken", () => {
  it("calls refresh endpoint and returns new access token", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "new-token-abc",
        token_type: "bearer",
        expires_in: 5183944,
      }),
    });

    const result = await refreshToken();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=test-token"
    );
    expect(result).toBe("new-token-abc");
  });

  it("throws on refresh failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: "Token expired" } }),
    });

    await expect(refreshToken()).rejects.toThrow(
      "Instagram API error: Token expired"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/__tests__/instagram.test.ts
```

Expected: FAIL — `getAccountInfo is not a function`, `refreshToken is not a function`

- [ ] **Step 3: Add `getAccountInfo` and `refreshToken` to `lib/instagram.ts`**

Append to the end of `lib/instagram.ts`:

```ts
export type IGAccountInfo = {
  username: string;
  followersCount: number;
  mediaCount: number;
  reach28d: number;
  profileViews28d: number;
};

export async function getAccountInfo(): Promise<IGAccountInfo> {
  const userId = process.env.INSTAGRAM_USER_ID;
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  const accountParams = new URLSearchParams({
    fields: "username,followers_count,media_count",
    access_token: accessToken!,
  });

  const insightParams = new URLSearchParams({
    metric: "reach,profile_views",
    period: "days_28",
    access_token: accessToken!,
  });

  const [accountRes, insightRes] = await Promise.all([
    fetch(`https://graph.facebook.com/v18.0/${userId}?${accountParams}`),
    fetch(
      `https://graph.facebook.com/v18.0/${userId}/insights?${insightParams}`
    ),
  ]);

  const accountData = await accountRes.json();
  if (!accountRes.ok) {
    throw new Error(
      `Instagram API error: ${accountData.error?.message ?? "Unknown error"}`
    );
  }

  const insightData = await insightRes.json();
  if (!insightRes.ok) {
    throw new Error(
      `Instagram API error: ${insightData.error?.message ?? "Unknown error"}`
    );
  }

  const insightMap: Record<string, number> = {};
  for (const item of insightData.data as Array<{
    name: string;
    values: Array<{ value: number }>;
  }>) {
    insightMap[item.name] =
      item.values[item.values.length - 1]?.value ?? 0;
  }

  return {
    username: accountData.username,
    followersCount: accountData.followers_count,
    mediaCount: accountData.media_count,
    reach28d: insightMap.reach ?? 0,
    profileViews28d: insightMap.profile_views ?? 0,
  };
}

export async function refreshToken(): Promise<string> {
  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN;

  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: accessToken!,
  });

  const response = await fetch(
    `https://graph.instagram.com/refresh_access_token?${params}`
  );
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Instagram API error: ${data.error?.message ?? "Unknown error"}`
    );
  }

  return data.access_token;
}
```

- [ ] **Step 4: Run all tests to verify they pass**

```bash
npx vitest run lib/__tests__/instagram.test.ts
```

Expected: all tests PASS (existing + 4 new)

- [ ] **Step 5: Commit**

```bash
git add lib/instagram.ts lib/__tests__/instagram.test.ts
git commit -m "feat: add getAccountInfo and refreshToken helpers"
```

---

## Task 8: `/api/account` and `/api/instagram/refresh` routes

**Files:**
- Create: `app/api/account/route.ts`
- Create: `app/api/account/__tests__/route.test.ts`
- Create: `app/api/instagram/refresh/route.ts`
- Create: `app/api/instagram/refresh/__tests__/route.test.ts`

- [ ] **Step 1: Write failing tests for `/api/account`**

Create `app/api/account/__tests__/route.test.ts`:

```ts
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
```

- [ ] **Step 2: Write failing tests for `/api/instagram/refresh`**

Create `app/api/instagram/refresh/__tests__/route.test.ts`:

```ts
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
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npx vitest run app/api/account/__tests__/route.test.ts app/api/instagram/refresh/__tests__/route.test.ts
```

Expected: FAIL — modules not found

- [ ] **Step 4: Create `app/api/account/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getAccountInfo } from "@/lib/instagram";

export async function GET(_request: Request) {
  try {
    const account = await getAccountInfo();

    const issuedAt = Number(process.env.INSTAGRAM_TOKEN_ISSUED_AT);
    const tokenDaysLeft = issuedAt
      ? Math.max(
          0,
          Math.ceil(
            (issuedAt * 1000 + 60 * 24 * 60 * 60 * 1000 - Date.now()) /
              (24 * 60 * 60 * 1000)
          )
        )
      : null;

    return NextResponse.json({ ...account, tokenDaysLeft });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 5: Create `app/api/instagram/refresh/route.ts`**

```ts
import { NextResponse } from "next/server";
import { refreshToken } from "@/lib/instagram";

export async function POST(_request: Request) {
  try {
    const newToken = await refreshToken();
    return NextResponse.json({ newToken });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run app/api/account/__tests__/route.test.ts app/api/instagram/refresh/__tests__/route.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add app/api/account/route.ts app/api/account/__tests__/route.test.ts app/api/instagram/refresh/route.ts app/api/instagram/refresh/__tests__/route.test.ts
git commit -m "feat: add /api/account and /api/instagram/refresh routes"
```

---

## Task 9: StatsTab component + wire all tabs

**Files:**
- Create: `app/components/StatsTab.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `app/components/StatsTab.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";

type AccountData = {
  username: string;
  followersCount: number;
  mediaCount: number;
  reach28d: number;
  profileViews28d: number;
  tokenDaysLeft: number | null;
};

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function StatTile({ value, label }: { value: string; label: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 text-center">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
}

export default function StatsTab() {
  const [account, setAccount] = useState<AccountData | null>(null);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setAccount(data);
        setStatus("success");
      })
      .catch((err) => {
        setError(err.message);
        setStatus("error");
      });
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    setNewToken(null);
    try {
      const res = await fetch("/api/instagram/refresh", { method: "POST" });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNewToken(data.newToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-gray-900 rounded-lg h-20" />
          ))}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return <p className="text-red-400 text-sm">{error}</p>;
  }

  if (!account) return null;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs text-gray-500 uppercase tracking-wider">
          Account
        </p>
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            value={formatCount(account.followersCount)}
            label="followers"
          />
          <StatTile
            value={formatCount(account.reach28d)}
            label="reach (28d)"
          />
          <StatTile
            value={formatCount(account.profileViews28d)}
            label="profile views"
          />
          <StatTile value={String(account.mediaCount)} label="posts" />
        </div>
      </div>

      <div className="border-t border-gray-800 pt-4 text-center">
        {account.tokenDaysLeft !== null ? (
          <p className="text-xs text-gray-500">
            Token expires in {account.tokenDaysLeft} days
          </p>
        ) : (
          <p className="text-xs text-gray-600">
            Set INSTAGRAM_TOKEN_ISSUED_AT in .env.local to track expiry
          </p>
        )}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="mt-2 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50"
        >
          {refreshing ? "Refreshing..." : "Refresh token"}
        </button>
        {newToken && (
          <div className="mt-3 bg-gray-900 border border-gray-700 rounded p-3 text-left">
            <p className="text-xs text-gray-400 mb-1">
              New token — copy to .env.local and update INSTAGRAM_TOKEN_ISSUED_AT:
            </p>
            <code className="text-xs text-green-400 break-all">{newToken}</code>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire `StatsTab` into `app/page.tsx`**

Replace the full `app/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import PublishTab from "@/app/components/PublishTab";
import HistoryTab from "@/app/components/HistoryTab";
import StatsTab from "@/app/components/StatsTab";

type Tab = "publish" | "history" | "stats";

const TABS: { id: Tab; label: string }[] = [
  { id: "publish", label: "Publish" },
  { id: "history", label: "History" },
  { id: "stats", label: "Stats" },
];

export default function Home() {
  const [tab, setTab] = useState<Tab>("publish");

  return (
    <main className="min-h-screen bg-gray-950">
      <div className="flex border-b border-gray-800 sticky top-0 bg-gray-950 z-10">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-sm transition-colors ${
              tab === t.id
                ? "text-white border-b-2 border-blue-500"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-lg mx-auto">
        {tab === "publish" && <PublishTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "stats" && <StatsTab />}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 4: Verify full app manually**

```bash
npm run dev
```

1. Login with password — redirects to home ✓
2. Publish tab — works as before ✓
3. History tab — loads posts list with skeletons, then rows with metrics ✓
4. Stats tab — loads account grid (followers, reach, profile views, posts) ✓
5. Stats tab — token expiry shown, "Refresh token" button works and shows new token ✓

- [ ] **Step 5: Final commit**

```bash
git add app/components/StatsTab.tsx app/page.tsx
git commit -m "feat: add Stats tab with account overview and token refresh"
```
