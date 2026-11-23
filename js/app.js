import { sb } from './sb.js';

const ACCOUNTS = ['admin.a', 'resp.a', 'tech.a', 'tech.bis', 'client'];
const ROLES = { admin: 'Admin', directeur: 'Directeur', responsable_tech: 'Responsable tech', technicien: 'Technicien', reception: 'Réception', client: 'Client' };
const app = document.getElementById('app');

async function render() {
  const { data: { session } } = await sb.auth.getSession();
  return session ? renderMe(session.user) : renderLogin();
}

function renderLogin(error = '') {
  app.innerHTML = `
    <h1>Connexion</h1>
    <form id="login">
      <label>Compte <select name="email">${ACCOUNTS.map(a => `<option value="${a}@test.local">${a}</option>`).join('')}</select></label>
      <label>Mot de passe <input name="password" type="password" required autocomplete="current-password"></label>
      <button>Se connecter</button>
      <p>${error}</p>
    </form>`;
  app.querySelector('#login').onsubmit = async e => {
    e.preventDefault();
    const { email, password } = Object.fromEntries(new FormData(e.target));
    const { error } = await sb.auth.signInWithPassword({ email, password });
    error ? renderLogin(error.message) : render();
  };
}

async function renderMe(user) {
  const { data: m } = await sb.from('members').select('full_name, email, role, acting_role').eq('user_id', user.id).maybeSingle();
  const role = m?.role === 'admin' && m.acting_role ? m.acting_role : m?.role;
  app.innerHTML = `
    <h1>Mon compte</h1>
    <p>Nom : ${m?.full_name || '—'}</p>
    <p>E-mail : ${user.email}</p>
    <p>Rôle : ${ROLES[role] || role || 'aucun'}</p>
    <button id="logout">Se déconnecter</button>`;
  app.querySelector('#logout').onclick = async () => { await sb.auth.signOut(); render(); };
}

render();
