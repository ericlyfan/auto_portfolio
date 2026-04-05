# Carousel Posts & Auto Caption Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-image carousel posting (up to 10 images) and automatic Fujifilm recipe caption generation from EXIF metadata.

**Architecture:** The existing single-image flow is extended with carousel API helpers. A new `lib/exif.ts` module (adapted from the validated experiment script) extracts recipe data during upload. The upload route returns both image paths and recipes, and the publish route branches between single-image and carousel flows based on image count. The UI gets multi-file selection with previews and recipe auto-fill with mismatch warnings.

**Tech Stack:** Next.js 14 (App Router), Tailwind CSS, Vitest, Instagram Graph API v18.0, exiftool (system dependency)

---

## File Structure

| File | Change | Responsibility |
|------|--------|---------------|
| `lib/exif.ts` | Create | Extract Fujifilm recipe from image file via exiftool. Exports `extractFujiRecipe(filePath): Promise<string \| null>` |
| `lib/__tests__/exif.test.ts` | Create | Tests for recipe extraction and formatting |
| `lib/instagram.ts` | Modify | Add `createCarouselItemContainer(imageUrl)` and `createCarouselContainer(childIds, caption)` |
| `lib/__tests__/instagram.test.ts` | Modify | Add tests for carousel functions |
| `app/api/upload/route.ts` | Modify | Accept multiple files, run EXIF extraction, return `{ imagePaths, recipes, primaryRecipe, mismatchedImages }` |
| `app/api/upload/__tests__/route.test.ts` | Modify | Tests for multi-file upload + recipe response |
| `app/api/publish/route.ts` | Modify | Accept `imagePaths[]`, branch single vs carousel flow |
| `app/api/publish/__tests__/route.test.ts` | Modify | Tests for carousel publish flow |
| `app/page.tsx` | Modify | Multi-file picker, image previews, reorder/remove, recipe auto-fill, mismatch warning |

---

### Task 1: EXIF Recipe Extraction Library

**Files:**
- Create: `lib/exif.ts`
- Create: `lib/__tests__/exif.test.ts`

- [ ] **Step 1: Write failing tests for `extractFujiRecipe`**

Create `lib/__tests__/exif.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { extractFujiRecipe } from "@/lib/exif";

vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

import { execFileSync } from "child_process";

const mockExecFileSync = vi.mocked(execFileSync);

beforeEach(() => {
  mockExecFileSync.mockReset();
});

describe("extractFujiRecipe", () => {
  it("returns formatted recipe string for a Fujifilm image", async () => {
    mockExecFileSync.mockReturnValueOnce(
      JSON.stringify([
        {
          "MakerNotes:FilmMode": "Classic Chrome",
          "MakerNotes:GrainEffectRoughness": "Weak",
          "MakerNotes:GrainEffectSize": "Small",
          "MakerNotes:ColorChromeEffect": "Strong",
          "MakerNotes:ColorChromeFXBlue": "Weak",
          "MakerNotes:WhiteBalance": "Auto",
          "MakerNotes:WhiteBalanceFineTune": "Red +40, Blue -80",
          "MakerNotes:DynamicRangeSetting": "Auto",
          "MakerNotes:HighlightTone": "-1 (medium soft)",
          "MakerNotes:ShadowTone": "-1 (medium soft)",
          "MakerNotes:Saturation": "+2 (high)",
          "MakerNotes:NoiseReduction": "-4 (weakest)",
          "MakerNotes:Sharpness": "-2 (soft)",
          "MakerNotes:Clarity": "0",
          "EXIF:ExposureCompensation": "0",
        },
      ])
    );

    const result = await extractFujiRecipe("/fake/path.jpg");

    expect(mockExecFileSync).toHaveBeenCalledWith(
      "exiftool",
      ["-json", "-G", "-a", "/fake/path.jpg"],
      { encoding: "utf-8" }
    );

    expect(result).toBe(
      [
        "Classic Chrome",
        "Grain Effect: Weak, Small",
        "Color Chrome Effect: Strong",
        "Color Chrome Effect Blue: Weak",
        "White Balance: Auto, +2 Red & -4 Blue",
        "Dynamic Range: DR-Auto",
        "Highlight: -1",
        "Shadow: -1",
        "Color: +2",
        "Noise Reduction: -4",
        "Sharpening: -2",
        "Clarity: 0",
        "Exposure Compensation: 0",
      ].join("\n")
    );
  });

  it("returns null for non-Fujifilm image (no FilmMode)", async () => {
    mockExecFileSync.mockReturnValueOnce(
      JSON.stringify([
        {
          "EXIF:Make": "Canon",
          "EXIF:Model": "EOS R5",
          "EXIF:ISO": "400",
        },
      ])
    );

    const result = await extractFujiRecipe("/fake/canon.jpg");
    expect(result).toBeNull();
  });

  it("handles grain effect both off", async () => {
    mockExecFileSync.mockReturnValueOnce(
      JSON.stringify([
        {
          "MakerNotes:FilmMode": "Provia",
          "MakerNotes:GrainEffectRoughness": "Off",
          "MakerNotes:GrainEffectSize": "Off",
          "MakerNotes:ColorChromeEffect": "Off",
          "MakerNotes:ColorChromeFXBlue": "Off",
          "MakerNotes:WhiteBalance": "Auto",
          "MakerNotes:WhiteBalanceFineTune": "Red 0, Blue 0",
          "MakerNotes:DynamicRange": "Standard",
          "MakerNotes:DevelopmentDynamicRange": "200",
          "MakerNotes:HighlightTone": "0 (normal)",
          "MakerNotes:ShadowTone": "0 (normal)",
          "MakerNotes:Saturation": "0 (normal)",
          "MakerNotes:NoiseReduction": "0 (normal)",
          "MakerNotes:Sharpness": "0 (normal)",
          "MakerNotes:Clarity": "0",
          "EXIF:ExposureCompensation": "0",
        },
      ])
    );

    const result = await extractFujiRecipe("/fake/provia.jpg");

    expect(result).toContain("Provia");
    expect(result).toContain("Grain Effect: Off");
    expect(result).toContain("White Balance: Auto");
    expect(result).not.toContain("Red");
    expect(result).toContain("Dynamic Range: DR200");
  });

  it("returns null when exiftool fails", async () => {
    mockExecFileSync.mockImplementationOnce(() => {
      throw new Error("exiftool not found");
    });

    const result = await extractFujiRecipe("/fake/broken.jpg");
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run lib/__tests__/exif.test.ts
```

Expected: FAIL — `extractFujiRecipe` is not defined.

- [ ] **Step 3: Implement `lib/exif.ts`**

Create `lib/exif.ts` — adapted from `experiments/exif-extraction/extract.ts`, exporting a single async function:

```ts
import { execFileSync } from "child_process";

/** Get a flat map of metadata, preferring MakerNotes values */
function flattenMetadata(
  metadata: Record<string, unknown>
): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(metadata)) {
    const shortKey = key.includes(":") ? key.split(":").pop()! : key;
    if (key.startsWith("MakerNotes:") || !flat[shortKey]) {
      flat[shortKey] = String(value ?? "");
    }
  }
  return flat;
}

/** Strip parenthetical descriptions: "-2 (soft)" → "-2" */
function stripParens(value: string): string {
  return value.replace(/\s*\(.*?\)\s*$/, "").trim();
}

/**
 * Convert WB fine tune "Red +40, Blue -100" to "+2 Red & -5 Blue"
 * exiftool reports in units of 20 per step
 */
function formatWBFineTune(raw: string): string {
  const redMatch = raw.match(/Red\s*([+-]?\d+)/i);
  const blueMatch = raw.match(/Blue\s*([+-]?\d+)/i);
  if (!redMatch || !blueMatch) return raw;

  const redSteps = Math.round(parseInt(redMatch[1]) / 20);
  const blueSteps = Math.round(parseInt(blueMatch[1]) / 20);

  const redStr = redSteps >= 0 ? `+${redSteps}` : `${redSteps}`;
  const blueStr = blueSteps >= 0 ? `+${blueSteps}` : `${blueSteps}`;

  return `${redStr} Red & ${blueStr} Blue`;
}

function formatRecipe(flat: Record<string, string>): string {
  const lines: string[] = [];

  const filmMode = flat["FilmMode"];
  if (filmMode) lines.push(filmMode);

  const grainRoughness = flat["GrainEffectRoughness"];
  const grainSize = flat["GrainEffectSize"];
  if (grainRoughness && grainSize) {
    if (grainRoughness === "Off" && grainSize === "Off") {
      lines.push("Grain Effect: Off");
    } else {
      lines.push(`Grain Effect: ${grainRoughness}, ${grainSize}`);
    }
  }

  const colorChrome = flat["ColorChromeEffect"] || flat["ChromeEffect"];
  if (colorChrome) lines.push(`Color Chrome Effect: ${colorChrome}`);

  const colorChromeFXBlue = flat["ColorChromeFXBlue"];
  if (colorChromeFXBlue)
    lines.push(`Color Chrome Effect Blue: ${colorChromeFXBlue}`);

  const wb = flat["WhiteBalance"];
  const wbFineTune = flat["WhiteBalanceFineTune"];
  if (wb) {
    if (wbFineTune && wbFineTune !== "0" && wbFineTune !== "Red 0, Blue 0") {
      lines.push(`White Balance: ${wb}, ${formatWBFineTune(wbFineTune)}`);
    } else {
      lines.push(`White Balance: ${wb}`);
    }
  }

  const drSetting = flat["DynamicRangeSetting"];
  const drValue = flat["DevelopmentDynamicRange"];
  const dr = flat["DynamicRange"];
  if (drSetting === "Auto" || dr === "Auto") {
    lines.push("Dynamic Range: DR-Auto");
  } else if (drValue) {
    lines.push(`Dynamic Range: DR${drValue}`);
  } else if (dr) {
    lines.push(`Dynamic Range: ${dr}`);
  }

  const highlight = flat["HighlightTone"];
  if (highlight) lines.push(`Highlight: ${stripParens(highlight)}`);

  const shadow = flat["ShadowTone"];
  if (shadow) lines.push(`Shadow: ${stripParens(shadow)}`);

  const color = flat["Saturation"] || flat["Color"];
  if (color) lines.push(`Color: ${stripParens(color)}`);

  const nr = flat["NoiseReduction"];
  if (nr) lines.push(`Noise Reduction: ${stripParens(nr)}`);

  const sharpness = flat["Sharpness"];
  if (sharpness) lines.push(`Sharpening: ${stripParens(sharpness)}`);

  const clarity = flat["Clarity"];
  if (clarity !== undefined) lines.push(`Clarity: ${stripParens(clarity)}`);

  const ec = flat["ExposureCompensation"];
  if (ec !== undefined) lines.push(`Exposure Compensation: ${ec}`);

  return lines.join("\n");
}

/**
 * Extract Fujifilm recipe from an image file using exiftool.
 * Returns formatted recipe string, or null if no Fuji data found.
 */
export async function extractFujiRecipe(
  filePath: string
): Promise<string | null> {
  try {
    const raw = execFileSync(
      "exiftool",
      ["-json", "-G", "-a", filePath],
      { encoding: "utf-8" }
    );
    const metadata = JSON.parse(raw)[0] as Record<string, unknown>;
    const flat = flattenMetadata(metadata);

    if (!flat["FilmMode"]) return null;

    return formatRecipe(flat);
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run lib/__tests__/exif.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/exif.ts lib/__tests__/exif.test.ts
git commit -m "feat: add Fujifilm EXIF recipe extraction library"
```

---

### Task 2: Instagram Carousel API Helpers

**Files:**
- Modify: `lib/instagram.ts`
- Modify: `lib/__tests__/instagram.test.ts`

- [ ] **Step 1: Write failing tests for carousel functions**

Append to `lib/__tests__/instagram.test.ts`:

```ts
describe("createCarouselItemContainer", () => {
  it("sends image_url with is_carousel_item flag and returns container id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "item-001" }),
    });

    const { createCarouselItemContainer } = await import("@/lib/instagram");
    const result = await createCarouselItemContainer(
      "https://example.com/photo1.jpg"
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v18.0/123456/media",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: "https://example.com/photo1.jpg",
          is_carousel_item: true,
          access_token: "test-token",
        }),
      }
    );
    expect(result).toBe("item-001");
  });

  it("throws on API error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { message: "Invalid image", type: "OAuthException" },
      }),
    });

    const { createCarouselItemContainer } = await import("@/lib/instagram");
    await expect(
      createCarouselItemContainer("https://example.com/bad.jpg")
    ).rejects.toThrow("Instagram API error: Invalid image");
  });
});

describe("createCarouselContainer", () => {
  it("sends children ids and caption and returns container id", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "carousel-001" }),
    });

    const { createCarouselContainer } = await import("@/lib/instagram");
    const result = await createCarouselContainer(
      ["item-001", "item-002", "item-003"],
      "My carousel caption"
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v18.0/123456/media",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          media_type: "CAROUSEL",
          children: ["item-001", "item-002", "item-003"],
          caption: "My carousel caption",
          access_token: "test-token",
        }),
      }
    );
    expect(result).toBe("carousel-001");
  });

  it("throws on API error response", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        error: { message: "Too many children", type: "OAuthException" },
      }),
    });

    const { createCarouselContainer } = await import("@/lib/instagram");
    await expect(
      createCarouselContainer(["item-001"], "caption")
    ).rejects.toThrow("Instagram API error: Too many children");
  });
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
npx vitest run lib/__tests__/instagram.test.ts
```

Expected: New carousel tests FAIL — functions not defined. Existing tests still pass.

- [ ] **Step 3: Implement carousel functions**

Add to `lib/instagram.ts` (after the existing `createMediaContainer` function, before `waitForMediaReady`):

```ts
export async function createCarouselItemContainer(
  imageUrl: string
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
        is_carousel_item: true,
        access_token: accessToken,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Instagram API error: ${data.error?.message ?? "Unknown error"}`
    );
  }

  return data.id;
}

export async function createCarouselContainer(
  childIds: string[],
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
        media_type: "CAROUSEL",
        children: childIds,
        caption,
        access_token: accessToken,
      }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Instagram API error: ${data.error?.message ?? "Unknown error"}`
    );
  }

  return data.id;
}
```

- [ ] **Step 4: Run all instagram tests to verify they pass**

```bash
npx vitest run lib/__tests__/instagram.test.ts
```

Expected: All tests pass (existing + 4 new carousel tests).

- [ ] **Step 5: Commit**

```bash
git add lib/instagram.ts lib/__tests__/instagram.test.ts
git commit -m "feat: add Instagram carousel API helpers"
```

---

### Task 3: Multi-File Upload Route with EXIF Extraction

**Files:**
- Modify: `app/api/upload/route.ts`
- Modify: `app/api/upload/__tests__/route.test.ts`

- [ ] **Step 1: Update upload tests for multi-file support and recipe extraction**

Replace the contents of `app/api/upload/__tests__/route.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run app/api/upload/__tests__/route.test.ts
```

Expected: FAIL — tests expect new multi-file API shape.

- [ ] **Step 3: Rewrite upload route for multi-file + EXIF**

Replace the contents of `app/api/upload/route.ts`:

```ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { extractFujiRecipe } from "@/lib/exif";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILES = 10;

export async function POST(request: Request) {
  const formData = await request.formData();
  const files = formData.getAll("files") as File[];

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: "Maximum 10 images allowed" },
      { status: 400 }
    );
  }

  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only image files are allowed" },
        { status: 400 }
      );
    }
  }

  const imagePaths: string[] = [];
  const recipes: (string | null)[] = [];

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filename = `${Date.now()}-${path.basename(file.name)}`;
    const uploadPath = path.join(process.cwd(), "public", "uploads", filename);

    await fs.writeFile(uploadPath, buffer);

    const imagePath = `/uploads/${filename}`;
    imagePaths.push(imagePath);

    const recipe = await extractFujiRecipe(uploadPath);
    recipes.push(recipe);
  }

  // Determine primary recipe (first non-null)
  const primaryRecipe = recipes.find((r) => r !== null) ?? null;

  // Find mismatched images
  const mismatchedImages: { index: number; recipe: string }[] = [];
  if (primaryRecipe) {
    for (let i = 0; i < recipes.length; i++) {
      if (recipes[i] !== null && recipes[i] !== primaryRecipe) {
        mismatchedImages.push({ index: i, recipe: recipes[i]! });
      }
    }
  }

  return NextResponse.json({
    imagePaths,
    recipes,
    primaryRecipe,
    mismatchedImages,
  });
}
```

- [ ] **Step 4: Run upload tests to verify they pass**

```bash
npx vitest run app/api/upload/__tests__/route.test.ts
```

Expected: All 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/upload/route.ts app/api/upload/__tests__/route.test.ts
git commit -m "feat: multi-file upload with EXIF recipe extraction"
```

---

### Task 4: Carousel Publish Route

**Files:**
- Modify: `app/api/publish/route.ts`
- Modify: `app/api/publish/__tests__/route.test.ts`

- [ ] **Step 1: Update publish tests for carousel support**

Replace the contents of `app/api/publish/__tests__/route.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run app/api/publish/__tests__/route.test.ts
```

Expected: FAIL — route still expects `imagePath` (singular).

- [ ] **Step 3: Rewrite publish route for single/carousel branching**

Replace the contents of `app/api/publish/route.ts`:

```ts
import { NextResponse } from "next/server";
import {
  createMediaContainer,
  createCarouselItemContainer,
  createCarouselContainer,
  publishMedia,
} from "@/lib/instagram";

export async function POST(request: Request) {
  const body = await request.json();
  const { imagePaths, caption } = body as {
    imagePaths?: string[];
    caption?: string;
  };

  if (!imagePaths || imagePaths.length === 0) {
    return NextResponse.json(
      { success: false, error: "imagePaths is required" },
      { status: 400 }
    );
  }

  const ngrokUrl = process.env.NGROK_URL;

  try {
    let creationId: string;

    if (imagePaths.length === 1) {
      // Single image flow
      const publicUrl = `${ngrokUrl}${imagePaths[0]}`;
      creationId = await createMediaContainer(publicUrl, caption ?? "");
    } else {
      // Carousel flow
      const childIds: string[] = [];
      for (const imagePath of imagePaths) {
        const publicUrl = `${ngrokUrl}${imagePath}`;
        const childId = await createCarouselItemContainer(publicUrl);
        childIds.push(childId);
      }
      creationId = await createCarouselContainer(childIds, caption ?? "");
    }

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

- [ ] **Step 4: Run publish tests to verify they pass**

```bash
npx vitest run app/api/publish/__tests__/route.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass across all test files.

- [ ] **Step 6: Commit**

```bash
git add app/api/publish/route.ts app/api/publish/__tests__/route.test.ts
git commit -m "feat: carousel publish support with single/multi branching"
```

---

### Task 5: Frontend — Multi-Image Upload with Previews

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Replace `app/page.tsx` with multi-image UI**

Replace the contents of `app/page.tsx`:

```tsx
"use client";

import { useState, FormEvent, useCallback } from "react";

const MAX_IMAGES = 10;

type Status =
  | { state: "idle" }
  | { state: "uploading" }
  | { state: "publishing" }
  | { state: "success"; postId: string }
  | { state: "error"; message: string };

type MismatchedImage = {
  index: number;
  recipe: string;
};

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [mismatchedImages, setMismatchedImages] = useState<MismatchedImage[]>(
    []
  );

  const addFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return;
      const incoming = Array.from(newFiles);
      const combined = [...files, ...incoming].slice(0, MAX_IMAGES);

      setFiles(combined);
      setPreviews(combined.map((f) => URL.createObjectURL(f)));
    },
    [files]
  );

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    setMismatchedImages([]);
  }

  function moveFile(from: number, to: number) {
    if (to < 0 || to >= files.length) return;
    const next = [...files];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
    setMismatchedImages([]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();

    if (files.length === 0) {
      setStatus({ state: "error", message: "Please select at least one image." });
      return;
    }

    try {
      // Step 1: Upload
      setStatus({ state: "uploading" });
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadRes.ok) {
        setStatus({ state: "error", message: uploadData.error });
        return;
      }

      // Auto-fill caption from recipe if caption is empty
      if (uploadData.primaryRecipe && !caption) {
        setCaption(uploadData.primaryRecipe);
      }

      // Show mismatch warning if applicable
      if (uploadData.mismatchedImages?.length > 0) {
        setMismatchedImages(uploadData.mismatchedImages);
        setStatus({ state: "idle" });
        // Store image paths for later publish
        setUploadedPaths(uploadData.imagePaths);
        return;
      }

      // Step 2: Publish
      await doPublish(uploadData.imagePaths, uploadData.primaryRecipe);
    } catch (err) {
      setStatus({
        state: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
    }
  }

  const [uploadedPaths, setUploadedPaths] = useState<string[] | null>(null);

  async function doPublish(imagePaths: string[], recipe?: string | null) {
    setStatus({ state: "publishing" });
    const finalCaption = caption || recipe || "";

    const publishRes = await fetch("/api/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ imagePaths, caption: finalCaption }),
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
    setMismatchedImages([]);
    setUploadedPaths(null);
  }

  function appendMismatchedRecipes() {
    const additions = mismatchedImages
      .map((m) => `\n\n---\nImage ${m.index + 1}:\n${m.recipe}`)
      .join("");
    setCaption((prev) => prev + additions);
    setMismatchedImages([]);
  }

  async function handlePublishAfterReview() {
    if (!uploadedPaths) return;
    try {
      await doPublish(uploadedPaths);
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
    <main className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-lg space-y-6">
        <h1 className="text-2xl font-bold text-white text-center">
          Publish to Instagram
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File picker */}
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

          {/* Image previews */}
          {previews.length > 0 && (
            <div className="grid grid-cols-5 gap-2">
              {previews.map((src, i) => (
                <div key={i} className="relative group">
                  <img
                    src={src}
                    alt={`Preview ${i + 1}`}
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

          {/* Caption */}
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

          {/* Mismatch warning */}
          {mismatchedImages.length > 0 && (
            <div className="rounded bg-yellow-900/50 border border-yellow-700 p-3 text-sm text-yellow-300 space-y-2">
              <p>
                {mismatchedImages.map((m) => `Image ${m.index + 1}`).join(", ")}{" "}
                {mismatchedImages.length === 1 ? "uses" : "use"} a different
                recipe (
                {mismatchedImages[0].recipe.split("\n")[0]}).
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={appendMismatchedRecipes}
                  className="text-xs bg-yellow-800 px-2 py-1 rounded hover:bg-yellow-700"
                >
                  Include all recipes
                </button>
                <button
                  type="button"
                  onClick={handlePublishAfterReview}
                  className="text-xs bg-gray-700 px-2 py-1 rounded hover:bg-gray-600"
                >
                  Publish as-is
                </button>
              </div>
            </div>
          )}

          {/* Submit */}
          {!uploadedPaths ? (
            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status.state === "uploading"
                ? "Uploading..."
                : status.state === "publishing"
                  ? "Publishing..."
                  : "Publish"}
            </button>
          ) : (
            !mismatchedImages.length && (
              <button
                type="button"
                onClick={handlePublishAfterReview}
                disabled={isProcessing}
                className="w-full py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status.state === "publishing" ? "Publishing..." : "Publish"}
              </button>
            )
          )}
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

Open `http://localhost:3000`. Expected: updated UI with multi-file picker, preview grid, and updated caption placeholder.

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: multi-image UI with previews, reorder, and recipe auto-caption"
```

---

### Task 6: End-to-End Manual Smoke Test

**Files:** None — verification task.

- [ ] **Step 1: Start ngrok and dev server**

```bash
ngrok http 3000
```

Copy the forwarding URL. Update `NGROK_URL` in `.env.local`. Start the dev server:

```bash
npm run dev
```

- [ ] **Step 2: Test single image publish with recipe**

Select one Fujifilm image (transferred via XApp). Expected:
- Image preview appears
- After clicking Publish, caption auto-fills with Fujifilm recipe
- Status shows "Uploading..." → "Publishing..." → green success banner

- [ ] **Step 3: Test carousel publish (2-3 images, same recipe)**

Select multiple Fujifilm images with the same recipe. Expected:
- All preview thumbnails appear with numbered badges
- Reorder arrows work on hover
- Remove button works
- Caption auto-fills with recipe
- No mismatch warning
- Publishes as carousel successfully

- [ ] **Step 4: Test recipe mismatch warning**

Select images with different film simulations. Expected:
- Caption auto-fills with first image's recipe
- Yellow mismatch warning appears identifying which images differ
- "Include all recipes" button appends the differing recipes to caption
- "Publish as-is" button publishes with only the primary recipe

- [ ] **Step 5: Test non-Fujifilm image**

Select a non-Fujifilm image (e.g., phone screenshot). Expected:
- Caption field stays empty (no auto-fill)
- Publish works normally

- [ ] **Step 6: Run full test suite one final time**

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Step 7: Commit any final adjustments**

```bash
git add -A
git commit -m "chore: finalize carousel and auto-caption features"
```
