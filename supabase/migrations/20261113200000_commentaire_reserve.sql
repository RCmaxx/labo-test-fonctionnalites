-- Commentaires réservés aux gestionnaires et au technicien qui a pris l'intervention.
create or replace function private.add_comment(p_id uuid, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not private.can_see(p_id) then raise exception 'Intervention introuvable'; end if;
  if not private.can_work_on(p_id) then raise exception 'Seul le technicien qui a pris en charge l''intervention peut la commenter'; end if;
  if length(trim(coalesce(p_body, ''))) = 0 then raise exception 'Commentaire vide'; end if;
  perform private.log_event(p_id, 'commentaire', left(p_body, 4000));
end $$;
