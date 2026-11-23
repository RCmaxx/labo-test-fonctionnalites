-- Lot 17 : seul l'auteur d'une intervention peut la modifier (le workflow passe par les RPC security definer).
drop policy if exists itv_update on public.interventions;
create policy itv_update on public.interventions for update to authenticated
  using (org_id = (select private.my_org()) and created_by = (select auth.uid()))
  with check (org_id = (select private.my_org()) and created_by = (select auth.uid()));
