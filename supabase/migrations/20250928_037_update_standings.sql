-- Update competition standings function to use competition_participants table data
drop function if exists get_competition_standings(uuid);

create function get_competition_standings(competition_id uuid)
returns table (
  user_id uuid,
  user_email text,
  weight_loss_percentage decimal,
  current_weight decimal,
  starting_weight decimal
)
language plpgsql
security definer
as $$
declare
  comp_record competitions%rowtype;
begin
  -- Get competition details
  select * into comp_record from competitions where id = competition_id;

  return query
  with latest_weight as (
    select distinct on (w.user_id) 
      w.user_id, 
      w.weight, 
      w.date
    from weight_entries w
    join competition_participants cp on cp.user_id = w.user_id
    where w.date <= LEAST(comp_record.end_date, NOW())
      and w.date >= comp_record.start_date
      and cp.competition_id = $1  -- Use parameter instead of column name
    order by w.user_id, w.date desc
  )
  select 
    cp.user_id,
    u.email::text as user_email,
    case 
      when cp.starting_weight is null or cp.starting_weight = 0 then 0
      when lw.weight is null then 0  -- No weight logged yet, show 0% change
      else ((cp.starting_weight - COALESCE(lw.weight, cp.starting_weight)) / NULLIF(cp.starting_weight, 0) * 100)::decimal(5,2)
    end as weight_loss_percentage,
    COALESCE(lw.weight, cp.starting_weight)::decimal as current_weight,  -- Use starting weight if no new weight logged
    COALESCE(cp.starting_weight, 0)::decimal as starting_weight  -- Always return a number, even if null
  from competition_participants cp
  join auth.users u on u.id = cp.user_id
  left join latest_weight lw on lw.user_id = cp.user_id
  where cp.competition_id = $1  -- Use parameter instead of column name
  order by weight_loss_percentage desc;
end;
$$;
