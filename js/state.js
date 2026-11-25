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
export const VERSION = 'v88';
export const app = document.getElementById('app');
// Mobile simulé (cadre de téléphone) : seulement sur grand écran ; sur un vrai téléphone la largeur suffit, comme l'appli tech.
export const setSim = on => document.documentElement.classList.toggle('sim', on && innerWidth > 600);
setSim(!!localStorage.labosim);
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
// Avatars de l'appli tech : un animal et sa couleur pastel par prénom (le même partout, quelle que soit la liste).
const AV_NAMED = {
  Raphaël: ['🦉', '#E6E0F5'],
  Julien: ['🦊', '#FFD9CC'],
  Thomas: ['🐻', '#DDEBD9'],
  Antoine: ['🐼', '#E6E6E6'],
  Léa: ['👤', '#E6E6E6'],
  Client: ['🐨', '#FFE3D1'],
  'Client mobile': ['🐨', '#F5C4A8'],
};
const AV_OTHERS = [
  ['🐢', '#DFF2E1'],
  ['🐙', '#F7DCE8'],
  ['🐝', '#FFF1C2'],
  ['🐬', '#D6EEF8'],
  ['🦄', '#EEDDF7'],
  ['🐸', '#E3F3D0'],
  ['🦝', '#E4E8EE'],
  ['🦋', '#DCE3FB'],
  ['🐞', '#FBDCDC'],
  ['🦔', '#EFE4D6'],
];
export function avatar(name, role) {
  const k = String(name || '');
  if (role === 'directeur' && k === 'Raphaël') return { e: '🦁', bg: '#FCE7C8' };
  let a = AV_NAMED[k];
  if (!a) {
    let h = 0;
    for (const c of k) h = (h * 31 + c.codePointAt(0)) >>> 0;
    a = AV_OTHERS[h % AV_OTHERS.length];
  }
  return { e: a[0], bg: a[1] };
}
export const roleOf = id => S.team.find(m => m.user_id === id)?.role;
// Intervention prise par moi (un admin ne voit comme siennes que celles prises sous le rôle qu'il affiche).
export const isMine = r =>
  r.assignee_id === S.me.id && (S.me.real !== 'admin' || !r.assignee_role || r.assignee_role === S.me.role);
export const canTake = r =>
  TECH.includes(S.me.role) &&
  r.status === 'publiee' &&
  !r.assignee_id &&
  (!r.proposed_to || r.proposed_to === S.me.id || (S.me.real === 'admin' && roleOf(r.proposed_to) === S.me.role));
export const nameOf = id => S.team.find(m => m.user_id === id)?.full_name || 'Quelqu’un';
// Demande un nouvel affichage complet (écouté par app.js, évite une dépendance circulaire).
export const rerender = () => dispatchEvent(new Event('labo:render'));
export const MONTHS = 'janv. févr. mars avr. mai juin juil. août sept. oct. nov. déc.'.split(' ');
export const p2 = n => String(n).padStart(2, '0');
export const hostModal = () => document.querySelector('.sim #app') || document.body;
// Icône trait (24×24) : d = contenu SVG, w = épaisseur, s = taille en px (sinon pilotée par le CSS).
export const svg = (d, w = 2, s) =>
  `<svg${s ? ` width="${s}" height="${s}"` : ''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const WRENCH =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
export const BRIEFCASE =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>';
