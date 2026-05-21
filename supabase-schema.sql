create table if not exists public.survey_responses (
  id text primary key,
  "createdAt" timestamptz not null,
  rating integer not null check (rating between 1 and 5),
  "reviewEligible" boolean not null default false,
  "goodPoint" text not null default '',
  comment text not null default ''
);

create index if not exists survey_responses_created_at_idx
  on public.survey_responses ("createdAt" desc);

alter table public.survey_responses enable row level security;

drop policy if exists "deny anon direct access" on public.survey_responses;
create policy "deny anon direct access"
  on public.survey_responses
  for all
  using (false)
  with check (false);
