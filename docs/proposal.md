# auto_portfolio

Mobile-first Instagram publishing tool. Pick a photo, write a caption, post — straight to Instagram via Graph API.

---

## Stack

- **Next.js 14** (App Router) + **Tailwind CSS**
- **Supabase** — Auth, Storage (temp image hosting for IG API), PostgreSQL
- **Instagram Graph API** — two-step publish flow
- **Vercel** — deployment

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
│   ├── admin/
│   │   ├── page.tsx              # Dashboard / post history
│   │   ├── upload/page.tsx       # Upload + publish interface
│   │   └── drafts/page.tsx       # Draft management (v1.5)
│   └── api/
│       ├── upload/route.ts       # Upload file to Supabase Storage
│       ├── publish/route.ts      # Instagram API + save record
│       ├── posts/route.ts        # Fetch post history
│       └── instagram/
│           └── refresh/route.ts  # Token refresh
├── components/
│   ├── AdminUploader.tsx
│   ├── PublishForm.tsx
│   └── PostHistory.tsx
├── lib/
│   ├── supabase.ts
│   └── instagram.ts              # IG API helpers
└── middleware.ts                  # Auth guard for /admin
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

**Phase 1 — Foundation**

- [ ] Init Next.js project
- [ ] Supabase project setup (DB + storage bucket)
- [ ] Auth + admin login page
- [ ] File upload flow → Supabase Storage

**Phase 2 — Instagram Integration**

- [ ] Meta Developer app + long-lived token
- [ ] Publish API route (2-step flow)
- [ ] Wire publish button + save post record
- [ ] Error handling (fail gracefully)

**Phase 3 — Polish & Deploy**

- [ ] Post history view
- [ ] Loading + success/error states
- [ ] Deploy to Vercel + end-to-end mobile test

**Phase 4 — V1.5**

- [ ] Draft mode
- [ ] Carousel posts
- [ ] Scheduled posting
- [ ] Multi-photo upload

---

## MVP Scope

Admin-only app (no public site). Single photo upload, caption, tags, one-tap publish to Instagram. Post history log. Public portfolio is a future V2 consideration.
