-- Lot 32 : tout membre peut commenter une intervention ouverte ; qui a assigné (« Mes demandes d'intervention »).
create or replace function private.add_comment(p_id uuid, p_body text)
 returns void language plpgsql security definer set search_path to '' as $function$
declare i public.interventions;
begin
  if not private.can_see(p_id) then raise exception 'Intervention introuvable'; end if;
  select * into i from public.interventions where id = p_id;
  if i.created_by is distinct from auth.uid() then
    if i.status = 'brouillon' then raise exception 'Brouillon : commentaires réservés à l''auteur' using errcode = '42501'; end if;
    if i.status in ('resolue', 'validee') then raise exception 'Intervention clôturée : plus de commentaires possibles' using errcode = '42501'; end if;
  end if;
  if length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Commentaire vide'; end if;
  perform private.log_event(p_id, 'commentaire', left(p_body, 4000));
end $function$;

alter table public.interventions add column if not exists assigned_by uuid references auth.users(id);

create or replace function private.assign_tech(p_id uuid, p_tech uuid)
 returns void language plpgsql security definer set search_path to '' as $function$
declare i public.interventions; v_name text;
begin
  if not private.is_manager() then raise exception 'Action réservée aux responsables' using errcode = '42501'; end if;
  select * into i from public.interventions where id = p_id and org_id = private.my_org() for update;
  if not found then raise exception 'Intervention introuvable'; end if;
  if i.status <> 'publiee' or i.assignee_id is not null then raise exception 'Intervention déjà prise ou non publiée'; end if;
  if p_tech is null then
    perform set_config('app.transition', 'on', true);
    update public.interventions set proposed_to = null, assigned_by = null where id = p_id;
    perform set_config('app.transition', 'off', true);
    return;
  end if;
  select coalesce(nullif(full_name, ''), email) into v_name from public.members
    where user_id = p_tech and org_id = private.my_org()
      and (role = 'technicien' or (role = 'responsable_tech' and private.my_role() in ('directeur', 'admin')));
  if v_name is null then raise exception 'Technicien introuvable'; end if;
  perform set_config('app.transition', 'on', true);
  update public.interventions set proposed_to = p_tech, assigned_by = auth.uid() where id = p_id;
  perform set_config('app.transition', 'off', true);
end $function$;
