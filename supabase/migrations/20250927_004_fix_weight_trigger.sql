-- Migration to fix the weight entry trigger function
-- This migration updates the process_weight_entry trigger to handle notifications correctly

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
    select 
      c.id, 
      c.start_date, 
      c.end_date, 
      c.name
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
      where w.user_id = NEW.user_id
      and w.date < NEW.date
      and w.date >= comp_record.start_date
      and exists (
        select 1 
        from competition_participants cp2 
        where cp2.user_id = w.user_id 
        and cp2.competition_id = comp_record.id
      )
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
        format('A participant has logged their first weight in "%s"!', comp_record.name),
        'weight_logged',
        '/competitions',
        false
      from competition_participants p
      where p.competition_id = comp_record.id
      and p.user_id != NEW.user_id;
    end if;
  end loop;

  return NEW;
end;
$$;

-- Drop and recreate the trigger to ensure it's using the latest version
drop trigger if exists on_weight_entry_insert on weight_entries;
create trigger on_weight_entry_insert
  after insert
  on weight_entries
  for each row
  execute function process_weight_entry();
