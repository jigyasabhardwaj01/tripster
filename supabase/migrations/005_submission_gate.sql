-- Replaces deadline-triggered scoring with a submission-count gate:
-- recommendations are generated only when submitted_count == expected_participant_count.
-- The deadline becomes informational only. Additive/backfill only — nothing
-- dropped, per the standing "keep old tables" convention.

alter table sessions
  add column if not exists expected_participant_count integer,
  add column if not exists submission_status text not null default 'collecting'
    check (submission_status in ('collecting', 'ready_for_analysis', 'generating', 'complete')),
  add column if not exists recommendation_status text not null default 'not_started'
    check (recommendation_status in ('not_started', 'in_progress', 'complete', 'failed'));

-- Backfill existing sessions (created before this column existed): assume
-- everyone who has already submitted is everyone expected, so they become
-- immediately eligible instead of stuck forever with an unset count. Floors
-- at 1 so a session with zero submissions doesn't trivially satisfy the gate.
update sessions s
set expected_participant_count = greatest(
  (select count(*) from submissions sub where sub.session_id = s.id),
  1
)
where expected_participant_count is null;

alter table sessions alter column expected_participant_count set not null;

-- Minimal, non-preference tracking of who has submitted (name + timestamp
-- only — never budget/dates/dealbreakers). This is a deliberate second,
-- narrower table alongside `submissions`, not a duplicate: its only job is
-- to be safely readable by anon/Realtime clients for the live "X of Y
-- submitted" view, without ever exposing preference data pre-lock.
create table if not exists session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name text not null,
  submission_status text not null default 'submitted' check (submission_status in ('pending', 'submitted')),
  submitted_at timestamptz not null default now()
);

create unique index if not exists session_participants_session_name_key
  on session_participants (session_id, lower(name));

create index if not exists idx_session_participants_session on session_participants (session_id);

alter table session_participants enable row level security;

-- Deliberately public read: only name/status/timestamp ever lands here, and
-- "who has submitted so far" was already exposed pre-lock by the old
-- submittedNames API response. Never insert/update/delete via anon — those
-- still go through the service-role API routes.
create policy "session_participants are publicly readable" on session_participants
  for select using (true);

-- Let Supabase Realtime broadcast changes on this table to subscribed
-- clients so the "X of Y submitted" view updates live.
alter publication supabase_realtime add table session_participants;

-- Backfill participants from existing submissions so pre-existing sessions'
-- "who's submitted" view keeps working under the new table.
insert into session_participants (session_id, name, submission_status, submitted_at)
select session_id, name, 'submitted', submitted_at from submissions
on conflict (session_id, lower(name)) do nothing;

-- Two-destination recommendation output, replacing `results`' role going
-- forward. `results` is left in place, unused by new code (it holds zero
-- rows in production as of this migration).
create table if not exists recommendations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  recommendation_type text not null check (recommendation_type in ('primary', 'alternative')),
  destination text not null,
  summary text not null,
  suggested_window jsonb not null,
  budget_estimate jsonb not null,
  attractions text[] not null default '{}',
  itinerary_days jsonb, -- reserved for a future day-by-day breakdown; unused for now
  created_at timestamptz not null default now()
);

create unique index if not exists recommendations_session_type_key
  on recommendations (session_id, recommendation_type);

alter table recommendations enable row level security;
-- No anon policies — same mediated-access model as submissions/results.

-- Atomic "claim the gate" guard: this is what makes generation fire exactly
-- once even under simultaneous submissions. The UPDATE only matches (and
-- Postgres only takes the row lock and commits) for whichever caller's
-- statement executes while submission_status is still 'collecting' — a
-- concurrent second caller's WHERE clause re-evaluates against the already-
-- flipped row and matches zero rows, so it returns false instead of firing
-- generation a second time.
create or replace function claim_session_gate(p_session_id uuid)
returns boolean
language plpgsql
as $$
declare
  v_rows integer;
begin
  update sessions
  set submission_status = 'ready_for_analysis', locked = true
  where id = p_session_id
    and submission_status = 'collecting'
    and (select count(*) from session_participants where session_id = p_session_id) >= expected_participant_count;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;
