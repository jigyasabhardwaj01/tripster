-- Tripster data model
-- Destinations are a hardcoded list in src/lib/destinations.ts (not a DB table) —
-- they're a fixed candidate set the app scores against, not user-editable data.

create extension if not exists "pgcrypto";

create table if not exists trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organizer_name text not null,
  status text not null default 'collecting'
    check (status in ('collecting', 'results_ready', 'confirming', 'final')),
  invitees text[] not null default '{}', -- expected participant names, entered by the organizer up front (optional)
  expected_participant_count int not null default 5, -- auto-matching triggers once responses hit this count
  confirmation_window_hours int not null default 48, -- how long the confirmation round stays open once opened
  confirmation_deadline timestamptz, -- set the moment matching runs; past this, the trip auto-locks to 'final'
  -- Identifies the organizer's browser without a login: a random token generated at creation,
  -- stashed in the organizer's localStorage, and compared back on load. Not a security boundary —
  -- anyone with the trip link could still act as organizer if they guessed it; it's just enough to
  -- show/hide the extra organizer controls on /trip/[id] for the common case.
  creator_token text not null default gen_random_uuid()::text,
  created_at timestamptz not null default now()
);

create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (trip_id, name)
);

create table if not exists responses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade unique,
  max_budget integer not null,
  date_ranges jsonb not null default '[]', -- [{ "start": "2026-11-01", "end": "2026-11-10" }, ...]
  destination_types text[] not null default '{}', -- e.g. {beach, hills}
  dealbreakers text[] not null default '{}', -- e.g. {alcohol_nightlife, high_altitude}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per (trip, participant, shortlisted destination) confirmation.
create table if not exists confirmations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  participant_id uuid not null references participants(id) on delete cascade,
  destination_id text not null, -- id from the hardcoded destinations list
  confirmed boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, participant_id, destination_id)
);

-- Stores the computed shortlist so /confirm and /results agree on the same
-- 2-3 options even if scoring logic later changes.
create table if not exists shortlists (
  trip_id uuid primary key references trips(id) on delete cascade,
  destination_ids text[] not null,
  computed_at timestamptz not null default now()
);

create index if not exists idx_participants_trip on participants(trip_id);
create index if not exists idx_responses_trip on responses(trip_id);
create index if not exists idx_confirmations_trip on confirmations(trip_id);

-- Row Level Security: this app has no login, participants are identified by
-- name and trips are reached only via an unguessable UUID link, so we allow
-- anon read/write scoped to those tables. Tighten this if you add auth later.
alter table trips enable row level security;
alter table participants enable row level security;
alter table responses enable row level security;
alter table confirmations enable row level security;
alter table shortlists enable row level security;

create policy "anon full access - trips" on trips for all using (true) with check (true);
create policy "anon full access - participants" on participants for all using (true) with check (true);
create policy "anon full access - responses" on responses for all using (true) with check (true);
create policy "anon full access - confirmations" on confirmations for all using (true) with check (true);
create policy "anon full access - shortlists" on shortlists for all using (true) with check (true);
