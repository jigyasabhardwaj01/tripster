-- Supersedes the multi-option/per-person-score design from migration 002.
-- Same three tables, no drops — just adds the field this new spec needs.
-- `results.options` and `submissions.date_ranges` are jsonb, so their
-- *internal* shape change (finalized_trip/reason/budget_check/calendar_check;
-- start_date/exit_date instead of start/end) is an application-level change,
-- not a schema migration — old rows written under migration 002's shape
-- won't exist yet in practice (nothing in the new sessions system has been
-- exposed to real users), so no backfill is needed.

alter table submissions
  add column if not exists preferred_locations text[] not null default '{}';
