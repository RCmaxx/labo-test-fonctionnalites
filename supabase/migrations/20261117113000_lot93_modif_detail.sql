-- Lot 93 : chaque modification est tracée champ par champ (« a remplacé Y par Z », une ligne par champ).
create or replace function private.interventions_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v text[] := '{}'; o text; n text;
begin
  if tg_op = 'INSERT' then
    perform private.log_event(new.id, 'creee', '');
  elsif coalesce(current_setting('app.transition', true), 'off') <> 'on'
    and (new.title, new.location, new.description, new.priority, new.available_from, new.available_until)
        is distinct from (old.title, old.location, old.description, old.priority, old.available_from, old.available_until) then
    if new.title is distinct from old.title then
      v := v || format('a remplacé « %s » par « %s »', coalesce(nullif(old.title, ''), '—'), coalesce(nullif(new.title, ''), '—')); end if;
    if new.location is distinct from old.location then
      v := v || format('a remplacé « %s » par « %s »', coalesce(nullif(old.location, ''), '—'), coalesce(nullif(new.location, ''), '—')); end if;
    if new.description is distinct from old.description then
      v := v || format('a remplacé « %s » par « %s »', coalesce(nullif(old.description, ''), '—'), coalesce(nullif(new.description, ''), '—')); end if;
    if new.priority is distinct from old.priority then
      v := v || format('a remplacé « %s » par « %s »', initcap(old.priority::text), initcap(new.priority::text)); end if;
    if (new.available_from, new.available_until) is distinct from (old.available_from, old.available_until) then
      o := case when old.available_from is null then 'Dès maintenant' else to_char(old.available_from at time zone 'Europe/Paris', 'DD/MM HH24:MI') || coalesce('–' || to_char(old.available_until at time zone 'Europe/Paris', 'HH24:MI'), '') end;
      n := case when new.available_from is null then 'Dès maintenant' else to_char(new.available_from at time zone 'Europe/Paris', 'DD/MM HH24:MI') || coalesce('–' || to_char(new.available_until at time zone 'Europe/Paris', 'HH24:MI'), '') end;
      v := v || format('a remplacé « %s » par « %s »', o, n); end if;
    perform private.log_event(new.id, 'modifiee', array_to_string(v, E'\n'));
  end if;
  return null;
end $$;
