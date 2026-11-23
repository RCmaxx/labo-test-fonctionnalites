-- Lot 300 (FA 737) : « Présence client requise » enregistrée sur l'intervention (interrupteur du formulaire, lot 282) ; icône main sur la carte.
alter table public.interventions add column if not exists client_presence boolean not null default false;
comment on column public.interventions.client_presence is 'Mission 737 : presence client requise (interrupteur du formulaire, lot 282) ; icone main sur la carte.';
