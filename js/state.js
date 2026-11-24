export const ACCOUNTS = ['admin.a', 'resp.a', 'tech.a', 'tech.bis', 'client'];
export const ROLES = {
  admin: 'Admin',
  directeur: 'Directeur',
  responsable_tech: 'Responsable tech',
  technicien: 'Technicien',
  reception: 'Réception',
  client: 'Client',
};
export const PNAME = {
  admin: 'Raphaël',
  directeur: 'Raphaël',
  responsable_tech: 'Julien',
  technicien: 'Thomas',
  reception: 'Léa',
  client: 'Client',
};
export const PRIORITY = { basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: 'Urgente' };
export const DONE = ['resolue', 'validee'];
export const STATUS = {
  brouillon: 'Brouillon',
  publiee: 'Nouvelle',
  prise_en_charge: 'En cours',
  resolue: 'Terminée',
  validee: 'Validée',
};
export const REMIND = {
  15: '15 min avant',
  30: '30 min avant',
  60: '1 h avant',
  120: '2 h avant',
  1440: '1 jour avant',
};
export const MGR = ['admin', 'directeur', 'responsable_tech'],
  TECH = ['technicien', 'responsable_tech'];
export const PAGE = 50; // terminées chargées par page
export const VERSION = 'v61';
export const app = document.getElementById('app');
document.documentElement.classList.toggle('sim', !!localStorage.labosim); // mobile simulé : même CSS que le mobile réel
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
// Date de carte, comme l'appli : « Il y a X min / h » le jour même, « Hier / Avant-hier à HH:MM », puis « 18 novembre ».
export function fmtCard(d) {
  const x = new Date(d),
    now = new Date(),
    day = v => new Date(v).setHours(0, 0, 0, 0);
  const n = Math.round((day(now) - day(x)) / 864e5),
    m = Math.max(0, Math.floor((now - x) / 6e4));
  const hm = x.toTimeString().slice(0, 5);
  if (n === 0) return m < 1 ? "À l'instant" : m < 60 ? `Il y a ${m} min` : `Il y a ${Math.floor(m / 60)} h`;
  if (n === 1) return `Hier à ${hm}`;
  if (n === 2) return `Avant-hier à ${hm}`;
  return x.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    ...(x.getFullYear() !== now.getFullYear() && { year: 'numeric' }),
  });
}
export const fmt = d => (d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '');
export const norm = s =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
export const options = (map, sel) =>
  Object.entries(map)
    .map(([k, v]) => `<option value="${k}" ${String(k) === String(sel) ? 'selected' : ''}>${v}</option>`)
    .join('');
export const route = () => location.hash.slice(1).split('/'); // [page, id, sous-page]
export const isMob = () =>
  document.documentElement.classList.contains('sim') ||
  (document.getElementById('app')?.clientWidth || innerWidth) <= 600;
// État partagé, modifié uniquement via cet objet.
export const S = {
  me: null, // { id, email, full_name, org_id, role (affiché), real (rôle réel) }
  org: null, // { name }
  team: [], // membres de l'entreprise : { user_id, full_name, role }
};
export const nameOf = id => S.team.find(m => m.user_id === id)?.full_name || 'Quelqu’un';
// Demande un nouvel affichage complet (écouté par app.js, évite une dépendance circulaire).
export const rerender = () => dispatchEvent(new Event('labo:render'));
