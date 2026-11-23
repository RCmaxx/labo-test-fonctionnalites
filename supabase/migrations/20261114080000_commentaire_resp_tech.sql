-- Commentaires : seuls le technicien en charge et le responsable technique.
create or replace function private.add_comment(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_see(p_id) then raise exception 'Intervention introuvable'; end if;
  if not (private.my_role() = 'responsable_tech' or exists (select 1 from public.interventions i
      where i.id = p_id and i.assignee_id = auth.uid() and i.status <> 'brouillon')) then
    raise exception 'Seuls le technicien en charge et le responsable technique peuvent commenter' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Commentaire vide'; end if;
  perform private.log_event(p_id, 'commentaire', left(p_body, 4000));
end $$;
