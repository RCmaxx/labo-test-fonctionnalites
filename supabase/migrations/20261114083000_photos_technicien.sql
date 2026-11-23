-- Photos : réservées au technicien en charge (et au signaleur à la création).
create or replace function private.can_work_on(p_intervention uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.interventions i
    where i.id = p_intervention and i.org_id = private.my_org()
      and ((i.assignee_id = auth.uid() and i.status <> 'brouillon')
        or (i.created_by = auth.uid() and i.status = 'brouillon')))
$$;
