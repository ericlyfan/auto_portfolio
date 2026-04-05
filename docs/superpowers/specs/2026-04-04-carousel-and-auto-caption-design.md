# Carousel Posts & Auto Caption Generation — Design Spec

**Goal:** Extend the Instagram publisher with (1) multi-image carousel support (up to 10 images) and (2) automatic caption generation from Fujifilm EXIF recipe data.

**Prerequisite workflow:** Photos transferred from camera to phone via Fujifilm XApp, which preserves MakerNotes metadata.

---

## Feature 1: Multi-Image Carousel Posts

### Instagram Carousel API Flow

Carousels require a three-step process (vs. two for single images):

1. **Create item containers** — For each image, call `POST /{user-id}/media` with `image_url` and `is_carousel_item=true`. Returns a container ID per image.
2. **Create carousel container** — Call `POST /{user-id}/media` with `media_type=CAROUSEL`, `children=[id1,id2,...]`, and the `caption`. Returns a single carousel container ID.
3. **Publish** — Call `POST /{user-id}/media_publish` with the carousel container ID. Same endpoint as single-image publish.

Single-image posts continue to use the existing two-step flow (create container + publish).

### API Changes

**`lib/instagram.ts`**

Add two new functions:
- `createCarouselItemContainer(imageUrl: string): Promise<string>` — Creates a single item container with `is_carousel_item=true`. No caption (caption goes on the carousel container).
- `createCarouselContainer(childIds: string[], caption: string): Promise<string>` — Creates the carousel container referencing all child IDs.

The existing `publishMedia(creationId)` works unchanged for both single and carousel posts.

**`app/api/upload/route.ts`**

Accept multiple files in a single multipart request. Return an array of image paths. Validate:
- At least 1 file, at most 10
- Each file must be an allowed image type (JPEG, PNG, WebP)

Response shape: `{ imagePaths: string[] }`

**`app/api/publish/route.ts`**

Accept `{ imagePaths: string[], caption: string }` (array instead of single path).

Logic:
- If 1 image → existing single-image flow (`createMediaContainer` + `publishMedia`)
- If 2-10 images → carousel flow (`createCarouselItemContainer` for each → `createCarouselContainer` → `publishMedia`)

### UI Changes

**`app/page.tsx`**

- Multi-file picker with `multiple` attribute, limited to 10 files
- Image preview thumbnails showing selected images
- Ability to remove individual images from the selection
- Image count indicator (e.g., "3/10 images")
- Drag-to-reorder thumbnails (determines carousel order)

---

## Feature 2: Auto Caption from Fujifilm EXIF Recipe

### EXIF Extraction

**`lib/exif.ts`** — Adapted from `experiments/exif-extraction/extract.ts`.

Exports:
- `extractFujiRecipe(filePath: string): Promise<string | null>` — Runs `exiftool -json -G -a` on the file, extracts Fujifilm MakerNotes recipe fields, returns a formatted recipe string or `null` if no Fujifilm data found.

Recipe fields extracted and their formatting:
- **Film Simulation** — standalone title line (no label)
- **Grain Effect** — combines GrainEffectRoughness + GrainEffectSize (e.g., "Weak, Small" or "Off")
- **Color Chrome Effect** — as-is from MakerNotes
- **Color Chrome Effect Blue** — as-is from MakerNotes
- **White Balance** — combines WhiteBalance + WhiteBalanceFineTune, converting raw units (÷20) to steps (e.g., "Auto, +2 Red & -4 Blue")
- **Dynamic Range** — combines DynamicRangeSetting + DevelopmentDynamicRange (e.g., "DR-Auto" or "DR200")
- **Highlight** — numeric value, stripped of parenthetical descriptions
- **Shadow** — numeric value, stripped of parenthetical descriptions
- **Color** — from Saturation field, stripped of parenthetical descriptions
- **Noise Reduction** — numeric value, stripped of parenthetical descriptions
- **Sharpening** — numeric value, stripped of parenthetical descriptions
- **Clarity** — numeric value
- **Exposure Compensation** — numeric value

Example output:
```
Classic Chrome
Grain Effect: Weak, Small
Color Chrome Effect: Strong
Color Chrome Effect Blue: Weak
White Balance: Auto, +2 Red & -4 Blue
Dynamic Range: DR-Auto
Highlight: -1
Shadow: -1
Color: +2
Noise Reduction: -4
Sharpening: -2
Clarity: 0
Exposure Compensation: 0
```

### Integration with Upload Flow

**`app/api/upload/route.ts`**

After saving files, run `extractFujiRecipe` on each image. Return recipes alongside image paths.

Response shape: `{ imagePaths: string[], recipes: (string | null)[] }`

### Recipe Mismatch Warning

When multiple images are uploaded, compare the full formatted recipe string from each image (not just the film simulation name — any field difference counts as a mismatch):

- If all images have the same recipe (or only one has recipe data) → auto-fill the caption with that recipe.
- If images have different recipes → auto-fill with the first image's recipe and return metadata about which images differ and what their recipe is.

Response includes: `{ imagePaths: string[], recipes: (string | null)[], primaryRecipe: string | null, mismatchedImages: { index: number, recipe: string }[] }`

### UI Behavior

**`app/page.tsx`**

- After upload completes, if `primaryRecipe` is present, auto-populate the caption textarea.
- If `mismatchedImages` is non-empty, show a warning below the caption: *"Images 3, 5 use a different recipe (Nostalgic Neg). Include all recipes?"* with a button to append mismatched recipes to the caption.
- User can freely edit, clear, or add to the auto-filled caption before publishing.
- Non-Fujifilm images or stripped metadata → no auto-caption, caption field stays empty.

---

## File Summary

| File | Change | Responsibility |
|------|--------|---------------|
| `lib/instagram.ts` | Modify | Add `createCarouselItemContainer` and `createCarouselContainer` |
| `lib/exif.ts` | Create | EXIF extraction and Fuji recipe formatting (from experiment script) |
| `app/api/upload/route.ts` | Modify | Accept multiple files, run EXIF extraction, return recipes |
| `app/api/publish/route.ts` | Modify | Accept array of image paths, carousel vs. single logic |
| `app/page.tsx` | Modify | Multi-image picker, previews, reorder, recipe auto-fill, mismatch warning |
| `lib/__tests__/instagram.test.ts` | Modify | Add tests for carousel functions |
| `lib/__tests__/exif.test.ts` | Create | Tests for recipe extraction and formatting |
| `app/api/upload/__tests__/route.test.ts` | Modify | Tests for multi-file upload + recipe extraction |
| `app/api/publish/__tests__/route.test.ts` | Modify | Tests for carousel publish flow |

---

## Out of Scope

- AI-generated creative captions (future feature)
- Post scheduling
- Post history / duplicate detection
- Video or Reel support
