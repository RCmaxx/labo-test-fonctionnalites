-- Lot 62 : événements d'historique pour les demandes de transfert faites avant le lot 61.
insert into public.intervention_events(org_id, intervention_id, type, body, actor_id, actor_name, actor_role, created_at)
select r.org_id, r.intervention_id, 'demande_transfert',
  'Demande à ' || coalesce(nullif(h.full_name, ''), h.email, ''),
  r.requester_id,
  case when q.role = 'admin' then case r.requester_role::text when 'responsable_tech' then 'Julien' else 'Thomas' end else coalesce(nullif(q.full_name, ''), q.email, '') end,
  r.requester_role, r.created_at
from public.transfer_requests r
left join public.members q on q.user_id = r.requester_id
left join public.members h on h.user_id = r.holder_id
where not exists (select 1 from public.intervention_events e where e.intervention_id = r.intervention_id and e.type = 'demande_transfert' and e.actor_id = r.requester_id and abs(extract(epoch from e.created_at - r.created_at)) < 5);
