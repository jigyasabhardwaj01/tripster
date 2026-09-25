# Tripster

Group trip planning without the 1,200-message WhatsApp thread. One link, everyone submits
budget/dates/type/dealbreakers, a rule-based matcher shortlists 2-3 destinations, everyone
confirms per-option, then a side-by-side comparison — no algorithm picks the winner.

## Setup

1. **Install deps** (needs Node 18+):
   ```bash
   npm install
   ```

2. **Create a Supabase project** at supabase.com, then in the SQL editor run
   [`supabase/schema.sql`](supabase/schema.sql) to create the tables.

3. **Env vars** — copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Project Settings → API.
   - `GEMINI_API_KEY` — optional. Only powers the one-line plain-language summary on the
     results page (`src/lib/summary.ts`), via the Gemini API. Without it, the app falls back
     to a template sentence built from the same numbers — nothing breaks.

4. **Run it**:
   ```bash
   npm run dev
   ```

5. **Deploy** — push to a repo and import into Vercel, or `vercel deploy`. Set the same env
   vars in the Vercel project settings.

## How it works

- `/trip/new` — organizer names the trip, gets redirected straight to the shareable
  `/trip/[id]/submit` link.
- `/trip/[id]/submit` — each participant enters their name (no login), max budget, available
  date ranges, destination type preferences, and dealbreakers.
- Once at least 3 people have submitted (`MIN_RESPONSES` in `src/lib/shortlist.ts`), the
  candidate list in `src/lib/destinations.ts` (~20 hardcoded destinations) is scored against
  every submitted response by `src/lib/scoring.ts` — plain rule-based checks on the four
  fields, no LLM involved. Top 2-3 are stored in the `shortlists` table so everyone sees the
  same options.
- `/trip/[id]/confirm` — each participant reviews the shortlist and confirms or opts out of
  each option individually (not a full form redo), because the group's earlier poll collapsed
  when people changed their minds after a single round.
- `/trip/[id]/results` — side-by-side comparison of all shortlisted options with per-person
  fit breakdowns and who's still in. The app never declares a winner.

## Data model

See [`supabase/schema.sql`](supabase/schema.sql) for the full DDL: `trips`, `participants`,
`responses`, `confirmations`, `shortlists`. Destinations are a fixed, hardcoded list in code
(`src/lib/destinations.ts`), not a database table.
