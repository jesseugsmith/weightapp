-- Create a table to store valid signup tokens
create table signup_tokens (
  id uuid primary key default uuid_generate_v4(),
  token text unique not null,
  email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  expires_at timestamp with time zone not null,
  used_at timestamp with time zone,
  used_by uuid references auth.users(id)
);

-- Create an index for faster token lookups
create index idx_signup_tokens_token on signup_tokens(token);

-- Function to validate signup tokens
create or replace function check_signup_token(token_param text, email_param text)
returns boolean as $$
begin
  -- Check if token exists, matches email, hasn't been used, and hasn't expired
  return exists (
    select 1 from signup_tokens
    where token = token_param
    and email = email_param
    and used_at is null
    and expires_at > now()
  );
end;
$$ language plpgsql security definer;

-- Function to mark token as used
create or replace function use_signup_token(token_param text, user_id_param uuid)
returns void as $$
begin
  update signup_tokens
  set used_at = now(),
      used_by = user_id_param
  where token = token_param
  and used_at is null;
end;
$$ language plpgsql security definer;
