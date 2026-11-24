# Labo — banc d'essai des fonctionnalités

Réécriture propre de l'appli tech (mobile) : même rendu, même usage, code lisible et facile à modifier.
Aucune compilation : HTML + CSS + JavaScript (modules ES), base Supabase de **test** (`js/sb.js`).

## Où modifier quoi

| Je veux changer… | Fichier |
|---|---|
| une couleur, un rayon, une ombre, un espacement | `css/tokens.css` (source unique, rien de codé en dur ailleurs) |
| l'en-tête, la barre du bas, le menu du compte | `css/layout.css` + `js/app.js` |
| les cartes et les listes | `css/list.css` + `js/list.js` |
| les cercles de « Mes interventions » | `js/circles.js` |
| le détail d'une intervention et le tchat | `css/detail.css` + `js/detail.js` |
| le formulaire | `css/form.css` + `js/form.js` |
| le balayage entre onglets | `js/tabs.js` |
| les compteurs (header, barre du bas) | `js/counts.js` |
| le temps réel | `js/live.js` |

## Règles de code

- Couleurs et mesures : uniquement des variables de `css/tokens.css`. Pas de `!important`.
- Mise en page mobile : requêtes de conteneur sur `#app` (le mode simulateur et le vrai mobile partent du même CSS).
- Un fichier = une responsabilité ; `js/state.js` porte l'état partagé `S` et les constantes.
- Avant de publier : `prettier --write js css` puis `eslint js` (aucune erreur attendue).
- Chaque modification publiée augmente `VERSION` dans `js/state.js`.

## Fonctionnement

`js/app.js` : `render()` construit l'en-tête et la barre du bas, puis `show()` affiche la vue de la route dans `<main>`.
Entre les onglets de liste, seul `show()` est rappelé (pas de reconstruction du cadre) ; `js/tabs.js` garde les pages en vie pour un balayage instantané.
