# auto_portfolio

Personal Instagram publishing tool. Pick photos, write a caption, post — straight to Instagram via Graph API. Runs locally in dev mode for personal use only.

---

## Stack

- **Next.js 14** (App Router) + **Tailwind CSS**
- **Supabase** — Storage (temp image hosting for IG API), PostgreSQL
- **Instagram Graph API** — two-step publish flow
- **Local dev** — no deployment, no auth needed (personal use only)

## Env Vars

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
INSTAGRAM_USER_ID=
INSTAGRAM_ACCESS_TOKEN=
```

---

## Architecture

```
auto_portfolio/
├── app/
│   ├── page.tsx                  # Upload + publish interface
│   └── api/
│       ├── upload/route.ts       # Upload file to Supabase Storage
│       ├── publish/route.ts      # Instagram API + save record
│       ├── posts/route.ts        # Fetch post history
│       └── instagram/
│           └── refresh/route.ts  # Token refresh
├── lib/
│   ├── supabase.ts
│   ├── exif.ts                   # Fujifilm recipe EXIF extraction
│   └── instagram.ts              # IG API helpers
```

---

## Database

```sql
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  caption TEXT,
  tags TEXT[],
  location TEXT,
  instagram_post_id TEXT,
  instagram_permalink TEXT,
  published_at TIMESTAMPTZ,
  is_draft BOOLEAN DEFAULT FALSE,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Instagram Publish Flow

Two-step Graph API process:

```
POST /v18.0/{ig-user-id}/media
  image_url: <public Supabase URL>
  caption: <text>
→ returns creation_id

POST /v18.0/{ig-user-id}/media_publish
  creation_id: <id>
```

Image must be publicly accessible at publish time. Supabase public bucket handles this.

**Constraints:**

- 25 posts/day rate limit
- Cannot delete posts via API
- Recommended ratios: 1:1, 4:5, 1.91:1
- Long-lived tokens expire every 60 days — handle refresh proactively

---

## Build Phases

**Phase 1 — Foundation** ✓

- [x] Init Next.js project
- [x] Supabase project setup (DB + storage bucket)
- [x] File upload flow → Supabase Storage

**Phase 2 — Instagram Integration** ✓

- [x] Meta Developer app + long-lived token
- [x] Publish API route (2-step flow)
- [x] Wire publish button + save post record
- [x] Error handling (fail gracefully)
- [x] Multi-photo / carousel support (up to 10 images)
- [x] Fujifilm EXIF recipe auto-caption

**Phase 3 — Polish**

- [x] Loading + success/error states
- [ ] Post history view
- [ ] Token refresh route (`/api/instagram/refresh`) — tokens expire every 60 days

**Phase 4 — V1.5**

- [ ] Draft mode
- [ ] Scheduled posting

---

## MVP Scope

Personal local tool, no auth required. Multi-photo upload, caption auto-filled from Fujifilm EXIF recipe data, one-tap publish to Instagram. Post history log. No public deployment planned.
