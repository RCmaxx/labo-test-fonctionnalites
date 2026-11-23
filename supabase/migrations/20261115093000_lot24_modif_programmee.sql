-- Lot 24 : une intervention programmée (fourchette horaire) est modifiable par tout membre ; chaque modification est tracée.
drop policy if exists itv_update on public.interventions;
create policy itv_update on public.interventions for update
  using (org_id = (select private.my_org()) and (created_by = (select auth.uid()) or available_from is not null))
  with check (org_id = (select private.my_org()) and (created_by = (select auth.uid()) or available_from is not null));

create or replace function private.interventions_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform private.log_event(new.id, 'creee', '');
  elsif coalesce(current_setting('app.transition', true), 'off') <> 'on'
    and (new.title, new.location, new.description, new.priority, new.scheduled_date, new.available_from, new.available_until)
        is distinct from (old.title, old.location, old.description, old.priority, old.scheduled_date, old.available_from, old.available_until) then
    perform private.log_event(new.id, 'modifiee', '');
  end if;
  return null;
end $$;
