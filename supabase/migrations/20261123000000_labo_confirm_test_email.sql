-- Labo uniquement : les adresses @test.local n'ont pas de boîte mail, on les confirme à la création.
create or replace function private.confirm_test_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.email ilike '%@test.local' and new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists confirm_test_email on auth.users;
create trigger confirm_test_email before insert or update on auth.users
  for each row execute function private.confirm_test_email();
