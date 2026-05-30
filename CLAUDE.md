# Studyform

AI flashcard generator. Turns PDFs and web pages into spaced-repetition flashcards using Groq LLM. Cards are generated per text chunk (not per document) to keep them grounded. Users review cards using SM-2 scheduling with XP/level gamification.

Live: https://studyform.vercel.app

---

## Tech Stack

- **Next.js** 16.2.6 — App Router, TypeScript
- **React** 19.2.4
- **Tailwind CSS** v4 (PostCSS plugin, not v3 config)
- **Supabase** — auth + database (RLS enabled on all tables)
  - `@supabase/ssr` 0.10.3, `@supabase/supabase-js` 2.105.4
- **Groq SDK** 1.1.2 — model: `llama-3.1-8b-instant` (set in `lib/ai.ts`)
- **unpdf** 1.6.2 — PDF text extraction
- **cheerio** 1.2.0 — URL/HTML text extraction
- Fonts: Geist Sans, Newsreader (serif), JetBrains Mono

---

## Project Structure

```
app/
  layout.tsx              — root layout, NavBar
  page.tsx                — landing page
  login/                  — magic link sign-in form
  auth/callback/          — exchanges OTP code for session, redirects to /dashboard
  dashboard/              — deck list
  deck/[id]/              — deck detail + card list
  review/[id]/            — SM-2 review session
  settings/               — user settings (SM-2 intervals, type-in-answer toggle)
  api/
    documents/route.ts    — list/delete documents
    documents/[id]/       — single document ops
    documents/upload/     — PDF ingestion (extract → chunk → store)
    documents/url/        — URL ingestion (extract → chunk → store)
    cards/route.ts        — list cards
    cards/[id]/           — single card ops
    cards/generate/       — trigger card generation from stored chunks
    review/[cardId]/      — submit SM-2 review result
    decks/                — deck CRUD
    folders/[id]/         — folder CRUD
    playlists/[id]/       — playlist CRUD
    activity/             — activity feed
    settings/             — user settings CRUD

lib/
  ai.ts                   — Groq client + AI_MODEL constant
  chunker.ts              — text → chunks (200–800 char paragraphs)
  extract.ts              — PDF (unpdf) and URL (cheerio) extraction
  generate-cards.ts       — orchestrates chunk → Groq → cards (concurrency=5, cap=20 chunks)
  prompts.ts              — card generation prompt (returns JSON array)
  sm2.ts                  — SM-2 algorithm: applyReview(), formatInterval()
  levels.ts               — XP/level system for cards and decks
  supabase/client.ts      — browser Supabase client
  supabase/server.ts      — server Supabase client (uses Next.js cookies())

components/
  NavBar.tsx
  DeckList.tsx
  DocumentUploader.tsx
  DrawingCanvas.tsx       — cards can require a drawn answer (require_drawing flag)
  SignOutButton.tsx

types/index.ts            — all shared types: Document, Chunk, Card, CardReview, UserSettings, ReviewRating
supabase/schema.sql       — full DB schema to run in Supabase SQL editor
```

---

## Running Locally

```bash
npm install
cp .env.example .env.local   # fill in values below
npm run dev
```

Run `supabase/schema.sql` in Supabase SQL editor before first use.

### Required env vars (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GROQ_API_KEY=
```

No server-only Supabase service key — all DB access uses the anon key with RLS.

---

## Auth

- Magic links via `supabase.auth.signInWithOtp()` — no passwords
- OTP callback at `/auth/callback` exchanges the code for a session cookie
- Two Supabase clients: `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (server components / route handlers)
- RLS enforced on all tables — users can only read/write their own data

---

## AI Generation Pipeline

1. User uploads PDF or pastes URL
2. Text extracted server-side (`lib/extract.ts` — unpdf for PDFs, cheerio for URLs)
3. Text split into 200–800 char chunks by paragraph (`lib/chunker.ts`)
4. Chunks stored in `chunks` table, then generation is triggered
5. `lib/generate-cards.ts` filters boilerplate, samples up to 20 chunks, calls Groq with concurrency=5
6. Each chunk → `buildCardGenerationPrompt()` → Groq returns JSON array of `{front, back, hint}`
7. Cards stored in `cards` table linked to their source chunk
8. Generation streams progress events back to the client (`send({ progress, total })`)

---

## SM-2 Implementation

- `lib/sm2.ts` — `applyReview(state, rating, settings?)` returns updated `{ease_factor, interval_days, repetitions, due_date}`
- Ratings: `again` (0), `hard` (2), `good` (4), `easy` (5)
- Default intervals: again=1d, hard=1d, good=1d, easy=6d — user-configurable in settings
- `again` and `hard` reset repetitions to 0
- `lib/levels.ts` — XP per rating (again=2, hard=5, good=8, easy=10), card levels 1–10

---

## Database Schema (tables)

| Table | Purpose |
|---|---|
| `documents` | One per upload, owned by user, has `folder_id` |
| `chunks` | Text segments from a document, has `chunk_index` |
| `cards` | front/back/hint pairs, linked to chunk; supports `image_url`, `require_drawing` |
| `card_reviews` | SM-2 state per card per user (ease_factor, interval_days, repetitions, due_date) |
| `folders` | User-created folder groupings for documents |
| `playlists` | Named subsets of cards within a document |

---

## Gotchas

- **AI model mismatch**: README says `llama-3.3-70b-versatile` but `lib/ai.ts` uses `llama-3.1-8b-instant`. The constant `AI_MODEL` is the source of truth.
- **Tailwind v4**: Uses `@tailwindcss/postcss` plugin — no `tailwind.config.js`. Config is in `postcss.config.mjs`.
- **CSS variables**: Design tokens are CSS custom properties (`--ink`, `--accent`, `--bg`, etc.) defined in `globals.css`, not Tailwind theme tokens.
- **Chunk cap**: Generation is hard-capped at 20 chunks per document (`MAX_CHUNKS` in `generate-cards.ts`) regardless of document length.
- **No service role key**: Uses anon key + RLS everywhere. If adding admin operations, a service role key would need to be added.
- **`proxy.ts`** in root — purpose unclear, likely a dev utility; not part of the Next.js app.
