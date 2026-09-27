-- One combined-itinerary PDF per trip, generated once and served from
-- storage on every download (never regenerated per click, never triggers
-- a new AI call — it only renders already-generated recommendation data).

alter table sessions add column if not exists itinerary_pdf_path text;

insert into storage.buckets (id, name, public)
values ('itineraries', 'itineraries', false)
on conflict (id) do nothing;
-- Private: no anon policies, same mediated-access model as the rest of this
-- app — the download route fetches it with the service-role client and
-- streams the bytes back, rather than exposing a public bucket URL.
