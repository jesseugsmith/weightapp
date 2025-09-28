-- Migration: Add user_current_weight table and weight entry triggers
-- This ensures weight entries are tracked for users overall and all active competitions

-- Create table to track user's current weight
create table if not exists user_current_weight (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weight decimal not null,
  last_updated timestamptz not null default now()
);

-- Enable RLS on user_current_weight
alter table user_current_weight enable row level security;

-- Users can view their own current weight
create policy "Users can view their own current weight"
  on user_current_weight for select
  to authenticated
  using (user_id = auth.uid());

-- Only the system can update current weight
create policy "Only system can update current weight"
  on user_current_weight for insert
  to authenticated
  with check (false);

create policy "Only system can modify current weight"
  on user_current_weight for update
  to authenticated
  using (false)
  with check (false);

-- Function to update user's current weight and competition entries
create or replace function process_weight_entry()
returns trigger
language plpgsql
security definer
as $$
declare
  comp_record record;
begin
  -- Update or insert user's current weight
  insert into user_current_weight (user_id, weight, last_updated)
  values (NEW.user_id, NEW.weight, NEW.date)
  on conflict (user_id)
  do update set
    weight = NEW.weight,
    last_updated = NEW.date
  where NEW.date > user_current_weight.last_updated;

  -- Find all active competitions the user is participating in
  for comp_record in
    select distinct c.id, c.start_date, c.end_date
    from competitions c
    join competition_participants cp on cp.competition_id = c.id
    where cp.user_id = NEW.user_id
    and c.status = 'started'
    and NEW.date >= c.start_date
    and NEW.date <= c.end_date
  loop
    -- Check if this is their first weight entry for this competition
    if not exists (
      select 1
      from weight_entries w
      join competition_participants cp on cp.user_id = w.user_id
      where cp.competition_id = comp_record.id
      and w.user_id = NEW.user_id
      and w.date < NEW.date
      and w.date >= comp_record.start_date
    ) then
      -- Create a notification for first weight entry in competition
      insert into notifications (
        user_id,
        title,
        message,
        type,
        action_url,
        read
      )
      select
        p.user_id,
        'New Weight Entry',
        format('A participant has logged their first weight in "%s"!', c.name),
        'weight_logged',
        '/competitions',
        false
      from competition_participants p
      join competitions c on c.id = p.competition_id
      where p.competition_id = comp_record.id
      and p.user_id != NEW.user_id;
    end if;
  end loop;

  return NEW;
end;
$$;

-- Create trigger for weight entries
drop trigger if exists on_weight_entry_insert on weight_entries;
create trigger on_weight_entry_insert
  after insert
  on weight_entries
  for each row
  execute function process_weight_entry();

-- Backfill user_current_weight table with latest weights
insert into user_current_weight (user_id, weight, last_updated)
select distinct on (user_id)
  user_id,
  weight,
  date as last_updated
from weight_entries
order by user_id, date desc
on conflict (user_id)
do update set
  weight = EXCLUDED.weight,
  last_updated = EXCLUDED.last_updated
where EXCLUDED.last_updated > user_current_weight.last_updated;
