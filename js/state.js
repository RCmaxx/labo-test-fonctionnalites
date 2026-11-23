import { sb } from './sb.js?v=20261123155224';

// État de session partagé entre les vues.
export const state = {
  session: null,
  user: null,
  member: null, // { user_id, org_id, role, acting_role, full_name, email }
  org: null,
  members: [], // membres de l'entreprise (pour les noms)
};

// Rôle effectif (un admin peut simuler un autre rôle).
export const role = () => {
  const m = state.member;
  if (!m) return null;
  return m.role === 'admin' && m.acting_role ? m.acting_role : m.role;
};
export const isRealAdmin = () => state.member?.role === 'admin';
export const isManager = () => ['admin', 'directeur', 'responsable_tech'].includes(role());
export const isAdmin = () => role() === 'admin';

export async function loadMember() {
  state.member = null; state.org = null; state.members = [];
  if (!state.user) return;
  const uid = state.user.id;
  const { data: m } = await sb.from('members').select('*').eq('user_id', uid).maybeSingle();
  // Ignore une réponse arrivée après un changement de compte (ex. passage à Technicien Bis).
  if (state.user?.id !== uid) return;
  state.member = m || null;
  if (!m) return;
  const [{ data: org }, { data: members }] = await Promise.all([
    sb.from('organizations').select('*').eq('id', m.org_id).single(),
    sb.from('members').select('user_id, full_name, email, role, acting_role, created_at').order('created_at'),
  ]);
  if (state.user?.id !== uid) return;
  state.org = org;
  state.members = members || [];
}

export const ROLE_NAMES = { admin: 'Admin', directeur: 'Directeur', responsable_tech: 'Resp.tech', technicien: 'Tech', reception: 'Réception', client: 'Client' };
// Prénoms des profils simulés du compte admin (lot 53) ; le client garde « Client ».
export const PNAME = { admin: 'Raphaël', directeur: 'Raphaël', responsable_tech: 'Julien', technicien: 'Thomas', reception: 'Léa', client: 'Client' };
// Abréviation obligatoire dans les étiquettes : jamais « Responsable tech » en entier.
export const compactName = s => /^responsable(\s+tech(nique)?)?$/i.test(String(s || '').trim()) ? 'Resp.tech' : (s || '');
export const assigneeName = it => memberName(it.assignee_id, it.assignee_role);
export const roleKind = r => ['technicien', 'responsable_tech'].includes(r) ? 'tech' : r === 'client' ? 'cli' : 'rec';
// as = rôle avec lequel la personne a agi (assignee_role, actor_role) : le compte admin de test prend le prénom de ce profil, pas celui du profil affiché maintenant.
export const memberName = (id, as) => {
  const m = state.members.find(x => x.user_id === id);
  if (!m) return '';
  // Compte admin : affiché sous le nom du profil choisi (Administrateur, Directeur, Technicien…), jamais sous son nom propre.
  if (m.role === 'admin') return PNAME[as || m.acting_role || 'admin'];
  return compactName(m.full_name || m.email);
};
