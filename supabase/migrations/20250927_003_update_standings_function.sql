-- Migration: Update competition standings function to include current weight

-- Update the competition standings function
create or replace function get_competition_standings(competition_id uuid)
returns table (
  user_id uuid,
  user_email text,
  weight_loss_percentage decimal,
  current_weight decimal
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
    end as weight_loss_percentage,
    ucw.weight as current_weight
  from first_weights fw
  join last_weights lw on lw.user_id = fw.user_id
  join auth.users u on u.id = fw.user_id
  left join user_current_weight ucw on ucw.user_id = fw.user_id
  order by weight_loss_percentage desc;
end;
$$;
