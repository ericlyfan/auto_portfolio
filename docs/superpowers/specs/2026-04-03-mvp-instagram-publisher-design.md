# MVP Instagram Publisher — Design Spec

## Overview

A local-dev-only Next.js website for uploading a photo, writing a caption, and publishing it to Instagram via the Graph API. No auth, no database, no external storage — just a working publish flow for testing.

## Stack

- **Next.js 14** (App Router) + **Tailwind CSS**
- **Local file storage** (`public/uploads/`)
- **ngrok** — tunnels localhost so Instagram can fetch images
- **Instagram Graph API** — two-step publish flow

## Env Vars

```
INSTAGRAM_USER_ID=
INSTAGRAM_ACCESS_TOKEN=
NGROK_URL=          # e.g. https://abc123.ngrok-free.app
```

## Architecture

```
auto_portfolio/
├── app/
│   ├── page.tsx                  # Upload + publish UI
│   └── api/
│       ├── upload/route.ts       # Save image locally
│       └── publish/route.ts      # Instagram publish flow
├── lib/
│   └── instagram.ts              # Graph API helpers
├── public/
│   └── uploads/                  # Uploaded images (served statically by Next.js)
└── .env.local
```

### Responsibilities

- **`app/page.tsx`** — Single page with file picker, caption textarea, publish button, and status display.
- **`app/api/upload/route.ts`** — Accepts multipart form data, saves the image to `public/uploads/`, returns the image path.
- **`app/api/publish/route.ts`** — Accepts `{ imagePath, caption }`, constructs the public URL using `NGROK_URL`, calls the two-step Instagram API, returns success/error.
- **`lib/instagram.ts`** — Two functions wrapping the Graph API calls: `createMediaContainer(imageUrl, caption)` and `publishMedia(creationId)`.

## Data Flow

1. User picks an image and writes a caption in the browser.
2. Frontend POSTs the image to `/api/upload` — image saved to `public/uploads/<filename>`.
3. Frontend POSTs to `/api/publish` with `{ imagePath: "/uploads/<filename>", caption: "..." }`.
4. Publish route builds the public URL: `${NGROK_URL}/uploads/<filename>`.
5. Publish route calls Graph API step 1: `POST /v18.0/{ig-user-id}/media` with `image_url` + `caption` — returns `creation_id`.
6. Publish route calls Graph API step 2: `POST /v18.0/{ig-user-id}/media_publish` with `creation_id` — returns Instagram post ID.
7. Response sent to frontend with success/error and Instagram permalink if available.

## UI

One page, minimal Tailwind styling. Functional, not polished.

- **File input** — accepts images only; hint about recommended aspect ratios (1:1, 4:5, 1.91:1)
- **Caption textarea** — plain text input
- **Publish button** — triggers upload then publish
- **Status area** — shows current state: uploading → publishing → success (with IG link) or error message

## Error Handling

The publish route catches errors from either Graph API step and returns a descriptive message. The frontend displays it. No retries, no queuing.

Common failure modes:
- **Image not publicly accessible** — ngrok not running or URL mismatch
- **Invalid/expired access token** — token needs refresh (manual for MVP)
- **Rate limit** — 25 posts/day cap
- **Image rejected** — wrong format or size

## Out of Scope (MVP)

- Authentication / login
- Database / post history
- Supabase integration
- Draft mode / scheduling
- Carousel / multi-photo posts
- Automated token refresh
- Production deployment

## Dev Setup

1. `npm install` / `npx create-next-app`
2. Configure `.env.local` with Instagram credentials and ngrok URL
3. Start ngrok: `ngrok http 3000`
4. Copy ngrok URL to `.env.local`
5. `npm run dev`
6. Upload a photo, write a caption, hit publish
