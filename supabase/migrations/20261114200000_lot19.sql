-- Lot 19 : désistement, heure de passage (fourchette horaire), commentaire de l'auteur même clôturée.
alter type public.event_type add value if not exists 'liberee';
alter table public.interventions add column if not exists available_from timestamptz, add column if not exists available_until timestamptz;

create or replace function private.transition(p_id uuid, p_action text, p_comment text)
returns public.intervention_status
language plpgsql security definer set search_path = '' as $$
declare i public.interventions; v_role public.member_role := private.my_role(); v_new public.intervention_status;
  v_ev public.event_type;
begin
  select * into i from public.interventions where id = p_id and org_id = private.my_org() for update;
  if not found then raise exception 'Intervention introuvable'; end if;
  perform set_config('app.transition', 'on', true);
  if p_action = 'publier' then
    if not (private.is_manager() or i.created_by = auth.uid()) then raise exception 'Action réservée aux responsables' using errcode = '42501'; end if;
    if i.status <> 'brouillon' then raise exception 'Seul un brouillon peut être publié'; end if;
    update public.interventions set status = 'publiee', published_at = now() where id = p_id;
    v_new := 'publiee'; v_ev := 'publiee';
  elsif p_action = 'prendre' then
    if v_role not in ('technicien', 'responsable_tech') then raise exception 'Action réservée aux techniciens' using errcode = '42501'; end if;
    if i.status <> 'publiee' or i.assignee_id is not null then raise exception 'Intervention déjà prise ou non publiée'; end if;
    if i.available_from is not null and i.available_from > now() then raise exception 'Intervention programmée : pas encore disponible'; end if;
    update public.interventions set status = 'prise_en_charge', assignee_id = auth.uid(), assignee_role = v_role where id = p_id;
    v_new := 'prise_en_charge'; v_ev := 'prise_en_charge';
  elsif p_action = 'liberer' then
    if i.assignee_id is distinct from auth.uid() then raise exception 'Seul le technicien en charge peut se désister' using errcode = '42501'; end if;
    if i.status <> 'prise_en_charge' then raise exception 'L''intervention n''est pas en cours'; end if;
    update public.interventions set status = 'publiee', assignee_id = null, assignee_role = null where id = p_id;
    v_new := 'publiee'; v_ev := 'liberee';
  elsif p_action = 'resoudre' then
    if i.assignee_id is distinct from auth.uid() then raise exception 'Seul le technicien en charge peut résoudre' using errcode = '42501'; end if;
    if i.status <> 'prise_en_charge' then raise exception 'L''intervention n''est pas en cours'; end if;
    update public.interventions set status = 'resolue', resolved_at = now() where id = p_id;
    v_new := 'resolue'; v_ev := 'resolue';
  else
    raise exception 'Action inconnue';
  end if;
  perform set_config('app.transition', 'off', true);
  perform private.log_event(p_id, v_ev, p_comment);
  return v_new;
end $$;

create or replace function private.add_comment(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_author boolean;
begin
  if not private.can_see(p_id) then raise exception 'Intervention introuvable'; end if;
  select i.created_by = auth.uid() into v_author from public.interventions i where i.id = p_id;
  if not coalesce(v_author, false) then
    if not (private.my_role() = 'responsable_tech' or exists (select 1 from public.interventions i
        where i.id = p_id and i.assignee_id = auth.uid() and i.status <> 'brouillon')) then
      raise exception 'Seuls l''auteur, le technicien en charge et le responsable technique peuvent commenter' using errcode = '42501';
    end if;
    if exists (select 1 from public.interventions i where i.id = p_id and i.status in ('resolue', 'validee')) then
      raise exception 'Intervention clôturée : plus de commentaires possibles' using errcode = '42501';
    end if;
  end if;
  if length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Commentaire vide'; end if;
  perform private.log_event(p_id, 'commentaire', left(p_body, 4000));
end $$;
