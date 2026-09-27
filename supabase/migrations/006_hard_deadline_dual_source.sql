-- Supersedes the "wait for everyone" gate: generation now fires on
-- whichever comes first — everyone submitted, OR the deadline passes with
-- at least one submission. Also supersedes primary/alternative with
-- differently-sourced destinations: "from_picks" (named locations only) and
-- "discovered" (real web-search-grounded, not list-constrained).

alter table sessions
  add column if not exists expected_names text[],
  add column if not exists included_count integer,
  add column if not exists missing_names text[];

alter table recommendations
  add column if not exists verified boolean not null default true;
-- true = this destination's facts came from a real, grounded web search
-- (google_search tool with actual groundingMetadata returned). false =
-- the grounded search step failed/was unavailable and this is an
-- ungrounded AI suggestion — the frontend must label it accordingly,
-- never with the same confidence as a verified one.

-- Drop the old check before remapping data — an UPDATE that produces
-- 'from_picks'/'discovered' would otherwise violate the OLD constraint
-- (which only allowed 'primary'/'alternative') before it's replaced below.
alter table recommendations drop constraint if exists recommendations_recommendation_type_check;

-- Production already holds real rows under the old primary/alternative
-- design (two live trips completed under it before this migration) — remap
-- rather than discard them. Old "primary" was already list-constrained, so
-- it maps cleanly to from_picks; old "alternative" was too (never a real
-- web search), so it's honestly relabeled discovered + verified:false
-- rather than claimed as web-search-backed.
update recommendations set recommendation_type = 'from_picks' where recommendation_type = 'primary';
update recommendations set recommendation_type = 'discovered', verified = false where recommendation_type = 'alternative';

-- Recreate the recommendation_type check to allow only the new values.
alter table recommendations add constraint recommendations_recommendation_type_check
  check (recommendation_type in ('from_picks', 'discovered'));

-- Trigger condition now fires on whichever comes first: everyone in, or
-- the deadline has passed with at least one submission (never with zero —
-- that case surfaces as "no responses" on the frontend instead, computed
-- from deadline + submittedCount, no separate status needed for it).
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
    and (
      (select count(*) from session_participants where session_id = p_session_id) >= expected_participant_count
      or (
        deadline <= now()
        and (select count(*) from session_participants where session_id = p_session_id) >= 1
      )
    );
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;
