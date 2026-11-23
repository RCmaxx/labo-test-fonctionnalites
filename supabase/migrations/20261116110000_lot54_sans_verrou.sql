-- Lot 54 : plus aucun verrouillage des interventions programmées ; suppression de scheduled_date (inutilisée).
-- Appliquée via Supabase (transition : ligne « pas encore disponible » retirée ; interventions_after sans scheduled_date).
alter table public.interventions drop column if exists scheduled_date;
