-- AI-matching architecture: sessions / submissions / results.
-- Additive only — the old trips/participants/responses/confirmations/shortlists
-- tables are left in place (real data lives there) but the app stops writing
-- to them once the frontend is migrated in a later step.
--
-- Access model: RLS is enabled with NO anon policies on any of these three
-- tables — every read and write goes through Next.js API routes using the
-- service-role key (see src/lib/supabaseAdmin.ts). This is what makes
-- "no results/scores visible before lock" and "reject writes after the
-- deadline with a clear error" actually enforceable, rather than relying on
-- the frontend to just not ask.

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  deadline timestamptz not null,
  created_at timestamptz not null default now(),
  locked boolean not null default false
);

create table if not exists submissions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null,
  budget_min integer not null,
  budget_max integer not null,
  date_ranges jsonb not null default '[]',
  destination_types text[] not null default '{}',
  dealbreakers text not null default '', -- free text, not a fixed category list — Gemini reasons over it directly
  submitted_at timestamptz not null default now()
);

-- Case-insensitive: re-submitting under "Priya" or "priya" edits the same row.
create unique index if not exists submissions_session_name_key
  on submissions (session_id, lower(name));

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  generated_at timestamptz not null default now(),
  options jsonb not null
);

-- Exactly one results row per session ("write into results exactly once").
create unique index if not exists results_session_id_key on results (session_id);

create index if not exists idx_submissions_session on submissions (session_id);

alter table sessions enable row level security;
alter table submissions enable row level security;
alter table results enable row level security;
-- Deliberately no policies: anon key gets zero direct access to any of these
-- three tables. All access is mediated by API routes using the service role.
