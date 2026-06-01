# Memivo

> Keep your knowledge alive.

Memivo turns PDFs and web pages into high-quality spaced-repetition flashcards using AI. The focus is on card quality — every card is grounded in the source text, not generated from thin air.

**Live:** https://memivo.app

---

## Features

- Upload a PDF or paste a URL
- Extracts and chunks the source text before generation — this is the quality lever
- Generates 2–4 flashcards per chunk using Llama 3.3 70B via Groq
- Reviews cards using the SM-2 spaced repetition algorithm with interval-based XP
- Vocab card mode — swaps question/answer randomly during review
- Folders, playlists, pinning, and soft-delete trash
- Magic link authentication — no passwords

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Auth + Database | Supabase |
| AI | Groq — `llama-3.3-70b-versatile` |
| PDF parsing | unpdf |
| Spaced repetition | SM-2 (custom implementation) |
| Deployment | Vercel |

## Architecture

```
User uploads PDF or URL
  ↓
Text extracted server-side (unpdf / cheerio)
  ↓
Text split into semantic chunks (lib/chunker.ts)
  ↓
Each chunk → Groq LLM → 2–4 flashcards (lib/prompts.ts)
  ↓
Cards stored in Supabase, linked to source chunk
  ↓
SM-2 algorithm schedules reviews (lib/sm2.ts)
```

Chunking before generation is the core architectural decision. A card generated from a tightly-scoped passage is grounded. A card generated from a full document is a hallucination risk.

## Database Schema

```
documents    — one per upload, owned by a user
chunks       — text segments extracted from a document
cards        — front/back pairs, each linked to a chunk
card_reviews — SM-2 state per card per user (ease_factor, interval, due_date)
folders      — organise decks into groups
playlists    — curated subsets of cards within a deck
```

Row Level Security is enabled on all tables. Users can only access their own data.

## Running Locally

```bash
git clone https://github.com/albertkupperdev/memivo
cd memivo
npm install
cp .env.example .env.local
```

Fill in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GROQ_API_KEY=
```

Run the SQL in `supabase/schema.sql` in your Supabase project's SQL editor, then:

```bash
npm run dev
```

## Project Structure

```
app/
  api/
    documents/upload/   — PDF ingestion
    documents/url/      — URL ingestion
    cards/generate/     — flashcard generation
    review/[cardId]/    — submit SM-2 review
  dashboard/            — deck list
  deck/[id]/            — deck detail + card list
  review/[id]/          — review session
  trash/                — soft-deleted decks
  login/                — magic link sign in
lib/
  ai.ts                 — Groq client
  chunker.ts            — text → chunks
  extract.ts            — PDF and URL text extraction
  prompts.ts            — card generation prompt
  sm2.ts                — SM-2 algorithm
  levels.ts             — XP and level system
  supabase/             — browser and server Supabase clients
```
