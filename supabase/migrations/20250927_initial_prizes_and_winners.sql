-- This migration creates the initial prizes and winners tables
-- Migration: 20250927_initial_prizes_and_winners

-- Revert previous changes if they exist (idempotency)
drop function if exists get_competition_standings;
drop table if exists competition_winners;
drop table if exists prizes;

-- Create prizes table
create table prizes (
  id uuid default uuid_generate_v4() primary key,
  competition_id uuid references competitions(id) on delete cascade,
  rank int not null,  -- 1st place, 2nd place, etc.
  prize_amount decimal not null,
  prize_description text,
  created_at timestamptz default now()
);

-- Create winners table
create table competition_winners (
  id uuid default uuid_generate_v4() primary key,
  competition_id uuid references competitions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  rank int not null,
  weight_loss_percentage decimal not null,
  prize_id uuid references prizes(id) on delete set null,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table prizes enable row level security;
alter table competition_winners enable row level security;

-- Prizes table policies
-- Anyone can view prizes
create policy "Prizes are viewable by everyone"
  on prizes for select
  to authenticated
  using (true);

-- Only competition creators can create prizes
create policy "Competition creators can create prizes"
  on prizes for insert
  to authenticated
  with check (
    exists (
      select 1 from competitions c
      where c.id = competition_id
      and c.created_by = auth.uid()
    )
  );

-- Only competition creators can update prizes
create policy "Competition creators can update prizes"
  on prizes for update
  to authenticated
  using (
    exists (
      select 1 from competitions c
      where c.id = competition_id
      and c.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from competitions c
      where c.id = competition_id
      and c.created_by = auth.uid()
    )
  );

-- Only competition creators can delete prizes
create policy "Competition creators can delete prizes"
  on prizes for delete
  to authenticated
  using (
    exists (
      select 1 from competitions c
      where c.id = competition_id
      and c.created_by = auth.uid()
    )
  );

-- Winners table policies
-- Anyone can view winners
create policy "Winners are viewable by everyone"
  on competition_winners for select
  to authenticated
  using (true);

-- Only the system (service role) can insert winners
create policy "Only system can insert winners"
  on competition_winners for insert
  to authenticated
  with check (false); -- Only allow service role to insert

-- Only the system (service role) can update winners
create policy "Only system can update winners"
  on competition_winners for update
  to authenticated
  using (false)
  with check (false); -- Only allow service role to update

-- Only the system (service role) can delete winners
create policy "Only system can delete winners"
  on competition_winners for delete
  to authenticated
  using (false); -- Only allow service role to delete

-- Create competition standings function
create or replace function get_competition_standings(competition_id uuid)
returns table (
  user_id uuid,
  user_email text,
  weight_loss_percentage decimal
)
language plpgsql
security definer
as $$
begin
  return query
  with first_weights as (
    select 
      w.user_id,
      w.weight,
      w.date
    from weight_entries w
    join competition_participants cp on cp.user_id = w.user_id
    where cp.competition_id = $1
    and w.date >= (select start_date from competitions where id = $1)
    and not exists (
      select 1 
      from weight_entries w2 
      where w2.user_id = w.user_id 
      and w2.date < w.date 
      and w2.date >= (select start_date from competitions where id = $1)
    )
  ),
  last_weights as (
    select 
      w.user_id,
      w.weight,
      w.date
    from weight_entries w
    join competition_participants cp on cp.user_id = w.user_id
    where cp.competition_id = $1
    and w.date <= (select end_date from competitions where id = $1)
    and not exists (
      select 1 
      from weight_entries w2 
      where w2.user_id = w.user_id 
      and w2.date > w.date 
      and w2.date <= (select end_date from competitions where id = $1)
    )
  )
  select 
    fw.user_id,
    u.email as user_email,
    case 
      when fw.weight = 0 then 0
      else ((fw.weight - lw.weight) / fw.weight * 100)::decimal(5,2)
    end as weight_loss_percentage
  from first_weights fw
  join last_weights lw on lw.user_id = fw.user_id
  join auth.users u on u.id = fw.user_id
  order by weight_loss_percentage desc;
end;
$$;
