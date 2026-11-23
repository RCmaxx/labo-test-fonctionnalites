-- Photos de création versées au tchat : toute photo crée un message « photo ».
create or replace function private.photos_after() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.log_event(new.intervention_id, 'photo', new.path);
  return null;
end $$;

-- Reprise : messages manquants au nom du signaleur (événement de création), à l'heure de la photo.
insert into public.intervention_events(org_id, intervention_id, type, body, actor_id, actor_name, actor_role, created_at)
select i.org_id, p.intervention_id, 'photo', p.path,
       coalesce(c.actor_id, p.uploaded_by), coalesce(c.actor_name, ''), c.actor_role, p.created_at
from public.intervention_photos p
join public.interventions i on i.id = p.intervention_id
left join lateral (select e.actor_id, e.actor_name, e.actor_role from public.intervention_events e
  where e.intervention_id = p.intervention_id and e.type in ('creee', 'publiee') order by (e.type = 'creee') desc, e.created_at limit 1) c on true
where not exists (select 1 from public.intervention_events e where e.type = 'photo' and e.body = p.path);

update public.intervention_photos set in_chat = true where in_chat = false;
alter table public.intervention_photos alter column in_chat set default true;
