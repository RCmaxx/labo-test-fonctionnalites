-- Le compte admin n'apparaît jamais sous son nom propre : ses actions portent le nom du profil choisi.
create or replace function private.log_event(p_intervention uuid, p_type public.event_type, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_name text; v_real public.member_role; v_role public.member_role := private.my_role();
begin
  select org_id into v_org from public.interventions where id = p_intervention;
  select coalesce(nullif(full_name, ''), email), role into v_name, v_real from public.members where user_id = auth.uid();
  if v_real = 'admin' then
    v_name := case v_role when 'admin' then 'Admin' when 'directeur' then 'Directeur'
      when 'responsable_tech' then 'Responsable tech' else 'Tech' end;
  end if;
  insert into public.intervention_events(org_id, intervention_id, type, body, actor_id, actor_name, actor_role)
  values (v_org, p_intervention, p_type, coalesce(trim(p_body), ''), auth.uid(), coalesce(v_name, ''), v_role);
  perform set_config('app.transition', 'on', true);
  update public.interventions set updated_at = now() where id = p_intervention;
  perform set_config('app.transition', 'off', true);
end $$;

update public.intervention_events e set actor_name = case e.actor_role when 'admin' then 'Admin'
  when 'directeur' then 'Directeur' when 'responsable_tech' then 'Responsable tech' else 'Tech' end
from public.members m where m.user_id = e.actor_id and m.role = 'admin';

-- Comptes de test nommés selon leur profil.
update public.members set full_name = 'Responsable tech' where email = 'resp.a@test.local';
update public.members set full_name = 'Tech' where email = 'tech.a@test.local';
update public.members set full_name = 'Tech bis' where email = 'tech.bis@test.local';
update public.intervention_events e set actor_name = m.full_name
from public.members m where m.user_id = e.actor_id and m.role <> 'admin';
