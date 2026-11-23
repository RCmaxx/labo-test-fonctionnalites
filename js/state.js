export const ACCOUNTS = ['admin.a', 'resp.a', 'tech.a', 'tech.bis', 'client'];
export const ROLES = { admin: 'Admin', directeur: 'Directeur', responsable_tech: 'Responsable tech', technicien: 'Technicien', reception: 'Réception', client: 'Client' };
export const PRIORITY = { basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: 'Urgente' };
export const DONE = ['resolue', 'validee'];
export const STATUS = { brouillon: 'Brouillon', publiee: 'Nouvelle', prise_en_charge: 'En cours', resolue: 'Terminée', validee: 'Validée' };
export const REMIND = { 15: '15 min avant', 30: '30 min avant', 60: '1 h avant', 120: '2 h avant', 1440: '1 jour avant' };
export const MGR = ['admin', 'directeur', 'responsable_tech'], TECH = ['technicien', 'responsable_tech'];
export const PAGE = 50; // terminées chargées par page
export const VERSION = 'v14';
export const app = document.getElementById('app');
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
export const fmt = d => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '';
export const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const options = (map, sel) => Object.entries(map).map(([k, v]) => `<option value="${k}" ${String(k) === String(sel) ? 'selected' : ''}>${v}</option>`).join('');
export const route = () => location.hash.slice(1).split('/'); // [page, id, sous-page]
// État partagé, modifié uniquement via cet objet.
export const S = {
  me: null, // { id, email, full_name, org_id, role (affiché), real (rôle réel) }
  team: [], // membres de l'entreprise : { user_id, full_name, role }
};
export const nameOf = id => S.team.find(m => m.user_id === id)?.full_name || 'Quelqu’un';
// Demande un nouvel affichage complet (écouté par app.js, évite une dépendance circulaire).
export const rerender = () => dispatchEvent(new Event('labo:render'));
