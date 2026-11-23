-- Données de test du labo (idempotent). Ne jamais exécuter sur la production.
-- Org Labo test + 5 comptes déjà présents.
DO $$
DECLARE
  org uuid := 'ea945488-da4b-4ffd-a23c-3c3068c58cf7';
  admin uuid := 'bab5fc10-303f-4a15-bb40-e2cc19192e70';
  resp uuid := 'a4d1350e-8687-4b7a-a29a-5428ad70458f';
  techa uuid := '59d0a3e2-084a-44eb-8126-5554ad795682';
  techb uuid := '50ccfb3b-d306-4409-ae04-98dfe4a6f63b';
  client uuid := 'de38baf1-15ec-49b5-9a3f-9035d4a5f02e';
  i01 uuid := 'a1000000-0000-4000-8000-000000000001';
  i02 uuid := 'a1000000-0000-4000-8000-000000000002';
  i03 uuid := 'a1000000-0000-4000-8000-000000000003';
  i04 uuid := 'a1000000-0000-4000-8000-000000000004';
  i05 uuid := 'a1000000-0000-4000-8000-000000000005';
  i06 uuid := 'a1000000-0000-4000-8000-000000000006';
  i07 uuid := 'a1000000-0000-4000-8000-000000000007';
  i08 uuid := 'a1000000-0000-4000-8000-000000000008';
  i09 uuid := 'a1000000-0000-4000-8000-000000000009';
  i10 uuid := 'a1000000-0000-4000-8000-000000000010';
  i11 uuid := 'a1000000-0000-4000-8000-000000000011';
  i12 uuid := 'a1000000-0000-4000-8000-000000000012';
BEGIN
  DELETE FROM public.interventions WHERE org_id = org;
  DELETE FROM public.places WHERE org_id = org;
  DELETE FROM public.invitations WHERE org_id = org;
  DELETE FROM public.intervention_locks WHERE org_id = org;

  INSERT INTO public.places (org_id, label, num) VALUES
    (org, 'Mobil-home 1', 1),
    (org, 'Mobil-home 2', 2),
    (org, 'Mobil-home 3', 3),
    (org, 'Mobil-home 5', 5),
    (org, 'Mobil-home 7', 7),
    (org, 'Mobil-home 9', 9),
    (org, 'Mobil-home 12', 12),
    (org, 'Mobil-home 15', 15),
    (org, 'Mobil-home 18', 18),
    (org, 'Mobil-home 21', 21),
    (org, 'Accueil', NULL),
    (org, 'Piscine', NULL);

  INSERT INTO public.interventions (id, org_id, title, location, description, priority, created_by, created_at, client_presence) VALUES
    (i01, org, 'Fuite robinet cuisine', 'Mobil-home 12', 'Le robinet goutte en continu depuis hier soir.', 'normale', admin, now() - interval '2 days', false),
    (i02, org, 'Télévision qui ne s''allume pas', 'Mobil-home 3', 'Écran noir, le voyant rouge clignote.', 'basse', client, now() - interval '1 day', false),
    (i03, org, 'Ampoule grillée au salon', 'Mobil-home 7', 'Plus de lumière au plafonnier du salon.', 'haute', admin, now() - interval '8 hours', false),
    (i04, org, 'Chauffage ne démarre plus', 'Mobil-home 21', 'Le convecteur reste froid. Client sur place jusqu''à 18 h.', 'urgente', resp, now() - interval '6 hours', true),
    (i05, org, 'Toile de store déchirée', 'Mobil-home 15', 'Déchirure sur le côté droit du store, à changer si possible.', 'basse', admin, now() - interval '5 hours', true),
    (i06, org, 'Volets bloqués', 'Mobil-home 5', 'Les volets de la chambre ne remontent plus.', 'normale', admin, now() - interval '3 days', false),
    (i07, org, 'Plaque électrique en panne', 'Mobil-home 18', 'Un feu sur deux ne chauffe plus.', 'haute', resp, now() - interval '2 days 4 hours', false),
    (i08, org, 'Fuite sous évier', 'Mobil-home 9', 'Eau au sol sous le meuble évier.', 'haute', admin, now() - interval '5 days', false),
    (i09, org, 'Serrure d''entrée grippée', 'Mobil-home 2', 'La clé tourne difficilement, risque de coincer le client.', 'normale', resp, now() - interval '4 days', false),
    (i10, org, 'Remplacer le joint de douche', 'Mobil-home 1', 'Joint moisie à changer avant l''arrivée des prochains locataires.', 'basse', admin, now() - interval '10 days', false),
    (i11, org, 'Nettoyage filtre climatisation', 'Accueil', 'Filtre encrassé, souffle tiède.', 'normale', resp, now() - interval '8 days', false),
    (i12, org, 'Prise de terre à vérifier', 'Piscine', 'Le disjoncteur saute quand on branche le robot.', 'urgente', resp, now() - interval '6 days', false);

  PERFORM set_config('app.transition', 'on', true);

  UPDATE public.interventions SET status = 'publiee', published_at = created_at + interval '20 minutes'
    WHERE id IN (i03, i04, i05, i06, i07, i08, i09, i10, i11, i12);

  UPDATE public.interventions SET proposed_to = techa, assigned_by = resp, client_presence = true
    WHERE id = i04;

  UPDATE public.interventions
    SET available_from = (current_date + 1 + time '10:00') at time zone 'Europe/Paris',
        available_until = (current_date + 1 + time '11:00') at time zone 'Europe/Paris',
        remind_minutes = 60, client_presence = true
    WHERE id = i05;

  UPDATE public.interventions SET
    status = 'prise_en_charge', assignee_id = techa, assignee_role = 'technicien', assigned_by = admin
    WHERE id = i06;
  UPDATE public.interventions SET
    status = 'prise_en_charge', assignee_id = techb, assignee_role = 'technicien', assigned_by = resp
    WHERE id = i07;

  UPDATE public.interventions SET
    status = 'resolue', assignee_id = techa, assignee_role = 'technicien', assigned_by = admin,
    resolved_at = now() - interval '1 day'
    WHERE id = i08;
  UPDATE public.interventions SET
    status = 'resolue', assignee_id = techb, assignee_role = 'technicien', assigned_by = resp,
    resolved_at = now() - interval '20 hours'
    WHERE id = i09;

  UPDATE public.interventions SET
    status = 'validee', assignee_id = techa, assignee_role = 'technicien', assigned_by = admin,
    resolved_at = now() - interval '8 days', validated_at = now() - interval '7 days'
    WHERE id = i10;
  UPDATE public.interventions SET
    status = 'validee', assignee_id = techb, assignee_role = 'technicien', assigned_by = resp,
    resolved_at = now() - interval '6 days', validated_at = now() - interval '5 days'
    WHERE id = i11;
  UPDATE public.interventions SET
    status = 'validee', assignee_id = techb, assignee_role = 'technicien', assigned_by = resp,
    resolved_at = now() - interval '4 days', validated_at = now() - interval '3 days'
    WHERE id = i12;

  PERFORM set_config('app.transition', 'off', true);

  DELETE FROM public.intervention_events WHERE org_id = org;

  INSERT INTO public.intervention_events (org_id, intervention_id, type, body, actor_id, actor_name, actor_role, created_at) VALUES
    (org, i01, 'creee', '', admin, 'Admin A', 'admin', now() - interval '2 days'),
    (org, i02, 'creee', '', client, 'Client', 'client', now() - interval '1 day'),
    (org, i03, 'creee', '', admin, 'Admin A', 'admin', now() - interval '8 hours'),
    (org, i03, 'publiee', '', admin, 'Admin A', 'admin', now() - interval '8 hours' + interval '20 minutes'),
    (org, i04, 'creee', '', resp, 'Resp A', 'responsable_tech', now() - interval '6 hours'),
    (org, i04, 'publiee', '', resp, 'Resp A', 'responsable_tech', now() - interval '6 hours' + interval '20 minutes'),
    (org, i04, 'commentaire', 'Client au camping jusqu''à 18 h.', resp, 'Resp A', 'responsable_tech', now() - interval '5 hours'),
    (org, i05, 'creee', '', admin, 'Admin A', 'admin', now() - interval '5 hours'),
    (org, i05, 'publiee', '', admin, 'Admin A', 'admin', now() - interval '5 hours' + interval '20 minutes'),
    (org, i06, 'creee', '', admin, 'Admin A', 'admin', now() - interval '3 days'),
    (org, i06, 'publiee', '', admin, 'Admin A', 'admin', now() - interval '3 days' + interval '30 minutes'),
    (org, i06, 'prise_en_charge', '', techa, 'Tech A', 'technicien', now() - interval '2 days 12 hours'),
    (org, i06, 'commentaire', 'Les volets côté terrasse.', admin, 'Admin A', 'admin', now() - interval '2 days 10 hours'),
    (org, i06, 'commentaire', 'Je passe cet après-midi.', techa, 'Tech A', 'technicien', now() - interval '2 days 8 hours'),
    (org, i07, 'creee', '', resp, 'Resp A', 'responsable_tech', now() - interval '2 days 4 hours'),
    (org, i07, 'publiee', '', resp, 'Resp A', 'responsable_tech', now() - interval '2 days 4 hours' + interval '15 minutes'),
    (org, i07, 'prise_en_charge', '', techb, 'Tech bis', 'technicien', now() - interval '1 day 6 hours'),
    (org, i07, 'commentaire', 'Je commande la résistance.', techb, 'Tech bis', 'technicien', now() - interval '1 day 5 hours'),
    (org, i08, 'creee', '', admin, 'Admin A', 'admin', now() - interval '5 days'),
    (org, i08, 'publiee', '', admin, 'Admin A', 'admin', now() - interval '5 days' + interval '20 minutes'),
    (org, i08, 'prise_en_charge', '', techa, 'Tech A', 'technicien', now() - interval '4 days 12 hours'),
    (org, i08, 'resolue', '', techa, 'Tech A', 'technicien', now() - interval '1 day'),
    (org, i08, 'commentaire', 'Joint changé, plus de fuite.', techa, 'Tech A', 'technicien', now() - interval '1 day' + interval '10 minutes'),
    (org, i08, 'commentaire', 'Merci.', resp, 'Resp A', 'responsable_tech', now() - interval '20 hours'),
    (org, i09, 'creee', '', resp, 'Resp A', 'responsable_tech', now() - interval '4 days'),
    (org, i09, 'publiee', '', resp, 'Resp A', 'responsable_tech', now() - interval '4 days' + interval '20 minutes'),
    (org, i09, 'prise_en_charge', '', techb, 'Tech bis', 'technicien', now() - interval '3 days'),
    (org, i09, 'resolue', '', techb, 'Tech bis', 'technicien', now() - interval '20 hours'),
    (org, i10, 'creee', '', admin, 'Admin A', 'admin', now() - interval '10 days'),
    (org, i10, 'publiee', '', admin, 'Admin A', 'admin', now() - interval '10 days' + interval '20 minutes'),
    (org, i10, 'prise_en_charge', '', techa, 'Tech A', 'technicien', now() - interval '9 days'),
    (org, i10, 'resolue', '', techa, 'Tech A', 'technicien', now() - interval '8 days'),
    (org, i10, 'validee', '', resp, 'Resp A', 'responsable_tech', now() - interval '7 days'),
    (org, i11, 'creee', '', resp, 'Resp A', 'responsable_tech', now() - interval '8 days'),
    (org, i11, 'publiee', '', resp, 'Resp A', 'responsable_tech', now() - interval '8 days' + interval '20 minutes'),
    (org, i11, 'prise_en_charge', '', techb, 'Tech bis', 'technicien', now() - interval '7 days'),
    (org, i11, 'resolue', '', techb, 'Tech bis', 'technicien', now() - interval '6 days'),
    (org, i11, 'validee', '', resp, 'Resp A', 'responsable_tech', now() - interval '5 days'),
    (org, i12, 'creee', '', resp, 'Resp A', 'responsable_tech', now() - interval '6 days'),
    (org, i12, 'publiee', '', resp, 'Resp A', 'responsable_tech', now() - interval '6 days' + interval '20 minutes'),
    (org, i12, 'prise_en_charge', '', techb, 'Tech bis', 'technicien', now() - interval '5 days'),
    (org, i12, 'resolue', '', techb, 'Tech bis', 'technicien', now() - interval '4 days'),
    (org, i12, 'validee', '', resp, 'Resp A', 'responsable_tech', now() - interval '3 days');
END $$;

SELECT status, count(*) FROM public.interventions GROUP BY status ORDER BY 1;
SELECT count(*) AS places FROM public.places;
SELECT type, count(*) FROM public.intervention_events GROUP BY type ORDER BY 1;
