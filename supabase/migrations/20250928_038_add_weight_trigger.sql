-- This migration depends on 20250928_039_add_current_weight.sql
-- Add trigger to update competition participant current weights
create or replace function update_competition_current_weights()
returns trigger
language plpgsql
security definer
as $$
declare
  competition_record record;
begin
  -- Loop through each active competition the user is in
  for competition_record in 
    select cp.competition_id, cp.user_id, c.start_date, c.end_date
    from competition_participants cp
    join competitions c on c.id = cp.competition_id
    where cp.user_id = NEW.user_id
    and c.status = 'started'
  loop
    -- Update the current weight if the weight entry is within the competition period
    if NEW.date >= competition_record.start_date and NEW.date <= competition_record.end_date then
      update competition_participants
      set current_weight = NEW.weight
      where user_id = competition_record.user_id
      and competition_id = competition_record.competition_id;
    end if;
  end loop;
  
  return NEW;
end;
$$;

-- Drop the trigger if it exists
drop trigger if exists update_competition_weights on weight_entries;

-- Create the trigger
create trigger update_competition_weights
  after insert
  on weight_entries
  for each row
  execute function update_competition_current_weights();
