-- Competition issues reported by participants (viewable by admins)

create extension if not exists "pgcrypto";

create table if not exists public.competition_issues (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  reporter_id uuid references public.profiles(id) on delete set null,
  issue_type text not null default 'general',
  description text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  resolution_notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  resolved_at timestamptz
);

comment on table public.competition_issues is 'Issues reported against competitions (for admin triage)';

create index if not exists idx_competition_issues_competition_id on public.competition_issues (competition_id);
create index if not exists idx_competition_issues_status on public.competition_issues (status);
create index if not exists idx_competition_issues_created_at on public.competition_issues (created_at desc);

alter table public.competition_issues enable row level security;

-- Allow participants in a competition to file issues for that competition
create policy "Participants can insert competition issues" on public.competition_issues
  for insert
  with check (
    exists (
      select 1
      from public.competition_participants cp
      where cp.competition_id = competition_issues.competition_id
        and cp.user_id = auth.uid()
    )
  );

-- Allow reporters to view their own submissions
create policy "Reporters can view own competition issues" on public.competition_issues
  for select
  using (reporter_id = auth.uid());

-- Note: admin/service-role access bypasses RLS; add additional policies as needed.


