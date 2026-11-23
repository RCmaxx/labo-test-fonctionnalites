# Gestion des interventions

Application web multi-entreprise de suivi des interventions de maintenance (V1).
Front en HTML/CSS/JS sans compilation, back-end Supabase (Postgres, Auth, Storage), hébergement GitHub Pages.

- Appli en ligne : https://rcmaxx.github.io/gestion-interventions/
- Projet Supabase : `alkmkdzazprskhchcofp` (région eu-west-3, Paris)

## Fonctionnalités (V1)

- **Comptes** : création d'un compte entreprise (crée l'entreprise et son administrateur), connexion, déconnexion, mot de passe oublié.
- **Équipe** : invitation par lien (e-mail + rôle), acceptation, changement de rôle, retrait d'un membre.
- **Rôles** : administrateur, directeur, responsable technique, technicien.
- **« Voir en tant que »** : un administrateur peut simuler un autre rôle ; la base applique alors réellement les droits de ce rôle.
- **Workflow** : brouillon → publiée → prise en charge → résolue → validée (ou refusée, retour en prise en charge).
- **Suivi** : onglets *En cours* (groupés par statut), *Terminées* et *Brouillons* ; recherche texte, lieu, période.
- **Fiche intervention** : informations, photos (stockage privé), commentaires, et chronologie de tous les événements (auteur, rôle, date).

## Droits (appliqués par la Row Level Security)

| Action | Admin | Directeur | Resp. technique | Technicien |
|---|---|---|---|---|
| Voir les interventions publiées et suivantes | ✓ | ✓ | ✓ | ✓ |
| Voir les brouillons | ✓ | ✓ | ✓ | |
| Créer, modifier, publier, supprimer | ✓ | ✓ | ✓ | |
| Prendre en charge | | | ✓ | ✓ |
| Résoudre (technicien en charge) | | | ✓ | ✓ |
| Valider / refuser | ✓ | ✓ | ✓ | |
| Commenter | ✓ | ✓ | ✓ | ✓ |
| Ajouter des photos | ✓ | ✓ | ✓ | si en charge |
| Gérer l'équipe, les invitations, l'entreprise | ✓ | | | |

Chaque table porte un `org_id` : un utilisateur ne voit jamais les données d'une autre entreprise.
Les changements de statut passent uniquement par la fonction `transition()` ; le journal `intervention_events` n'est écrit que côté serveur.

## Structure

```
index.html            point d'entrée
css/app.css           styles
js/config.js          URL et clé publique Supabase
js/app.js             routeur, en-tête, session
js/state.js           membre connecté, rôle effectif
js/views/*.js         écrans (connexion, liste, fiche, formulaire, équipe, paramètres)
supabase/migrations/  schéma SQL (tables, RLS, fonctions, stockage)
supabase/tests/       test de bout en bout des droits (Node + supabase-js)
```

## Installation sur un nouveau projet Supabase

1. Créer un projet Supabase, puis exécuter `supabase/migrations/*.sql` (éditeur SQL ou `supabase db push`).
2. Renseigner l'URL du projet et la clé **publishable** dans `js/config.js` (jamais la clé `service_role`).
3. Dans *Authentication → URL Configuration* : *Site URL* = URL de l'appli, et l'ajouter aux *Redirect URLs*.
4. Dans *Authentication → Emails → SMTP Settings* : configurer un SMTP (Resend, Brevo, Postmark…). Sans SMTP, Supabase n'envoie les e-mails (confirmation, mot de passe oublié) qu'aux membres de l'équipe Supabase.
5. Publier le dossier (GitHub Pages : branche `main`, dossier racine).

En local : `python3 -m http.server 8080` puis ouvrir http://localhost:8080 (ajouter cette URL aux Redirect URLs).

## Tests

`supabase/tests/e2e-rls.mjs` vérifie les droits de bout en bout avec de vrais comptes : isolation entre entreprises, workflow, simulation de rôle, invitations. Il nécessite quatre comptes de test confirmés (voir le script).
