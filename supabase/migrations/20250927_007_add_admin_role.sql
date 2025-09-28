-- Add admin column to profiles table
alter table profiles add column is_admin boolean not null default false;

-- Create policy to restrict invite token creation to admins only
create policy "Only admins can create signup tokens" on signup_tokens
  for insert to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and is_admin = true
    )
  );

-- Create policy to allow admins to view all tokens
create policy "Admins can view all signup tokens" on signup_tokens
  for select to authenticated
  using (
    exists (
      select 1 from profiles
      where id = auth.uid()
      and is_admin = true
    )
  );

-- Create function to check if user is admin
create or replace function is_admin()
returns boolean as $$
begin
  return exists (
    select 1 from profiles
    where id = auth.uid()
    and is_admin = true
  );
end;
$$ language plpgsql security definer;
