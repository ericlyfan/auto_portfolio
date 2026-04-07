# Design: Tabs, History, Stats, Password Protection

**Date:** 2026-04-06

## Overview

Extend auto_portfolio with three features: password protection, post history, and account/post stats. The app gains tab-based navigation (Publish | History | Stats) and a login screen. All data comes directly from the Instagram Graph API — no database reads needed.

---

## Architecture

Single `app/page.tsx` manages tab state (`"publish" | "history" | "stats"`). Each tab is a component that fetches its own data on first render. No new page routes.

```
app/
├── page.tsx                    # Tab container (Publish | History | Stats)
├── login/
│   └── page.tsx                # Password form → sets cookie
├── api/
│   ├── upload/route.ts         # (existing)
│   ├── publish/route.ts        # (existing)
│   ├── posts/route.ts          # GET: IG media list + per-post insights
│   ├── account/route.ts        # GET: account info + 28-day insights
│   └── instagram/
│       └── refresh/route.ts    # POST: refresh long-lived token
├── components/
│   ├── PublishTab.tsx           # Existing publish form, lifted into tab
│   ├── HistoryTab.tsx           # List of past posts with metrics
│   └── StatsTab.tsx             # Account overview cards + token expiry
└── middleware.ts                # Cookie check → redirect to /login
```

---

## Password Protection

- `APP_PASSWORD` env var (plain string, set in `.env.local`)
- `/login` page: centered form with single password field, no username
- On submit: POST to `/api/auth` → validates password → sets `httpOnly` cookie `session=<APP_PASSWORD>`
- `middleware.ts`: runs on all routes except `/login` and `/api/auth`. Reads cookie, redirects to `/login` if missing or wrong.
- API routes (`/api/upload`, `/api/publish`, etc.) are also protected by middleware so the publish endpoint can't be called without a valid cookie.

---

## Tab Navigation

- Tabs rendered as a fixed header row: `Publish | History | Stats`
- Active tab indicated by bottom border + white text; inactive tabs are muted gray
- Tab state is client-side (`useState`) — no URL changes, no routing
- Each tab component fetches lazily: data is only requested when the tab is first opened, then cached in component state for the session

---

## History Tab

**Data source:** `GET /api/posts`

The route fetches from Instagram Graph API:
```
GET /{ig-user-id}/media
  fields: id, caption, media_url, thumbnail_url, timestamp, media_type, permalink
  limit: 25
```

Then for each post fetches insights:
```
GET /{media-id}/insights
  metric: impressions,reach,likes,saved,comments_count,shares
```

**UI — list row:**
- 40×40px thumbnail (square crop)
- Caption snippet (first line of caption, truncated to ~60 chars)
- Date on second line
- Right side: `♥ N  🔖 N` and `reach N` below

Metrics are fetched in parallel for all posts in the list. A loading skeleton is shown while fetching.

---

## Stats Tab

**Data source:** `GET /api/account`

Fetches:
```
GET /{ig-user-id}
  fields: followers_count, media_count, profile_picture_url, username

GET /{ig-user-id}/insights
  metric: reach,profile_views,impressions
  period: days_28
```

**UI — account card:**
- 2×2 grid of stat tiles: Followers, Reach (28d), Profile Views, Posts
- Below the card: token expiry countdown + manual "Refresh" link

**Token expiry:**
- `INSTAGRAM_TOKEN_ISSUED_AT` env var (Unix timestamp in seconds — set this to `Date.now()/1000|0` when you first configure your token, and update it each time you refresh)
- Long-lived tokens last 60 days; expiry = issued_at + 60 days
- Expiry shown as "Token expires in N days"
- "Refresh" triggers `POST /api/instagram/refresh` → calls IG refresh endpoint → returns new token string in the UI response. User copies it to `.env.local` and updates `INSTAGRAM_TOKEN_ISSUED_AT`. No server-side file writes.

---

## New API Routes

### `GET /api/posts`
- Fetches IG media list (25 most recent)
- Fetches insights for each post in parallel
- Returns: `{ posts: [{ id, caption, mediaUrl, timestamp, mediaType, permalink, likes, saves, reach, comments }] }`
- Errors propagate as `{ error: string }` with appropriate HTTP status

### `GET /api/account`
- Fetches account fields + 28-day insights
- Returns: `{ username, followersCount, mediaCount, profilePictureUrl, reach28d, profileViews28d }`

### `POST /api/instagram/refresh`
- Calls IG token refresh endpoint with current `INSTAGRAM_ACCESS_TOKEN`
- Returns new token in response body — user copies it to `.env.local`
- Does not write to filesystem or env (not safe in Next.js server context)

### `POST /api/auth`
- Accepts `{ password }` in body
- Compares to `APP_PASSWORD` env var
- Sets `httpOnly; SameSite=Strict` cookie on match
- Returns 401 on mismatch

---

## `lib/instagram.ts` Extensions

Add helpers:
- `getMediaList(limit)` — fetch media with fields
- `getMediaInsights(mediaId)` — fetch per-post metrics
- `getAccountInfo()` — fetch account fields + insights
- `refreshToken()` — call refresh endpoint, return new token string

---

## Error Handling

- All API routes catch errors and return `{ error: message }` with status 500
- Tab components show an inline error state (red text, no crash)
- Instagram API rate limit (200 calls/hour for insights) is not a concern at this scale

---

## What's Not In Scope

- Storing post history in Supabase (IG API is the source of truth)
- Scheduled posting (removed from plan)
- Draft mode (deferred to later)
- Vercel deployment (local dev only)
