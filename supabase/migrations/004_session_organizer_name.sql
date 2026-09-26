-- Additive: the session-creation form had no way to identify who started
-- the trip (unlike the old /trip system's organizer_name). Applied.
alter table sessions add column if not exists organizer_name text not null default '';
