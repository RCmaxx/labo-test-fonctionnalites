import { sb } from './sb.js';
import { S, app, esc, fmt, options, rerender, ACCOUNTS, ROLES, VERSION } from './state.js';
import { stopLive } from './live.js';

// Formulaire de connexion unique : le champ e-mail varie (liste des comptes de test, ou e-mail invité).
const loginForm = (emailField, error = '') => `<form class="panel" id="login">${emailField}
  <label>Mot de passe <input name="password" type="password" required autocomplete="current-password"></label>
  <button class="primary">Se connecter</button><p class="error">${esc(error)}</p></form>`;
const bindLogin = () => app.querySelector('#login').onsubmit = async e => {
  e.preventDefault();
  const { error } = await sb.auth.signInWithPassword(Object.fromEntries(new FormData(e.target)));
  error ? e.target.querySelector('.error').textContent = error.message : rerender();
};

export function renderLogin(error = '') {
  app.innerHTML = `<div class="auth"><h1>Connexion</h1><p class="muted">${VERSION}</p>
    ${loginForm(`<label>Compte <select name="email">${ACCOUNTS.map(a => `<option value="${a}@test.local">${a}</option>`).join('')}</select></label>`, error)}</div>`;
  bindLogin();
}

export async function signOut() { await sb.auth.signOut(); stopLive(); S.me = null; location.hash = ''; rerender(); }

// Compte connecté sans entreprise : création de la sienne.
export function renderOrg(user) {
  app.innerHTML = `<div class="auth">
    <h1>Créer votre entreprise</h1>
    <p>Le compte ${esc(user.email)} n'est rattaché à aucune entreprise. Créez-la, ou ouvrez le lien d'invitation reçu.</p>
    <form class="panel">
      <label>Nom de l'entreprise <input name="org" required maxlength="120"></label>
      <label>Votre nom <input name="name" required maxlength="12"></label>
      <button class="primary">Créer l'entreprise</button><p class="error"></p>
    </form>
    <button id="out">Se déconnecter</button></div>`;
  app.querySelector('#out').onclick = signOut;
  app.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.rpc('create_organization', { p_name: e.target.org.value.trim(), p_full_name: e.target.name.value.trim() });
    error ? e.target.querySelector('p').textContent = error.message : rerender();
  };
}

// Lien d'invitation : #invitation/<token>. Inscription (signUp) puis accept_invitation.
// Les @test.local n'ont pas de boîte mail : un trigger confirme ces comptes à la création.
async function acceptInvite(token, name, out) {
  const { error } = await sb.rpc('accept_invitation', { p_token: token, p_full_name: name });
  if (error) { if (out) out.textContent = error.message; return; }
  stopLive(); S.me = null; location.hash = '';
}
export async function renderInvitation(token, session) {
  const { data, error } = await sb.rpc('invitation_info', { p_token: token });
  const inv = data?.[0];
  if (!inv) return app.innerHTML = `<div class="auth"><h1>Invitation</h1><p>${esc(error?.message || 'Invitation invalide, expirée ou déjà utilisée.')}</p><a href="#">Connexion</a></div>`;
  const intro = `<h1>Invitation</h1><p>Rejoindre ${esc(inv.org_name)} en tant que ${ROLES[inv.role] || esc(inv.role)} (${esc(inv.email)}).</p>`;
  if (!session) {
    app.innerHTML = `<div class="auth">${intro}
      <form class="panel" id="signup">
        <label>Votre nom <input name="name" required maxlength="12"></label>
        <label>Mot de passe <input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
        <button class="primary">Créer le compte et rejoindre</button><p class="error"></p>
      </form>
      <p>Déjà un compte ? Connectez-vous ci-dessous, puis cette page s'affichera à nouveau.</p>
      ${loginForm(`<label>E-mail <input name="email" type="email" required value="${esc(inv.email)}" autocomplete="username"></label>`)}`;
    app.querySelector('#signup').onsubmit = async e => {
      e.preventDefault();
      const name = e.target.name.value.trim(), password = e.target.password.value, out = e.target.querySelector('p');
      const { data, error } = await sb.auth.signUp({ email: inv.email, password, options: { data: { full_name: name } } });
      if (error) return out.textContent = error.message;
      if (!data.session) {
        const { error: e2 } = await sb.auth.signInWithPassword({ email: inv.email, password });
        if (e2) return out.textContent = "Compte créé, mais il n'est pas encore confirmé. Les adresses @test.local ne reçoivent pas d'e-mail : confirmez le compte dans Supabase (Authentication) puis rouvrez ce lien.";
      }
      await acceptInvite(token, name, out);
    };
    bindLogin();
    return;
  }
  app.innerHTML = `<div class="auth">${intro}
    <form class="panel"><label>Votre nom <input name="name" required maxlength="12"></label><button class="primary">Accepter l'invitation</button><p class="error"></p></form></div>`;
  app.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    await acceptInvite(token, e.target.name.value.trim(), e.target.querySelector('p'));
  };
}

export async function renderMe(el) {
  const admin = S.me.role === 'admin';
  el.innerHTML = `
    <div class="account"><h1>Mon compte</h1>
    <section class="panel"><dl class="facts"><dt>Nom</dt><dd>${esc(S.me.full_name) || '—'}</dd><dt>E-mail</dt><dd>${esc(S.me.email)}</dd><dt>Rôle</dt><dd>${esc(ROLES[S.me.role] || S.me.role || 'aucun')}</dd></dl></section>
    ${S.me.real === 'admin' ? `<form class="panel inline" id="acting"><label>Voir en tant que <select name="role">${options(ROLES, S.me.role)}</select></label> <button>Changer</button><p class="error"></p></form>` : ''}
    ${admin ? `<section class="panel"><h2>Invitations</h2>
      <form class="inline" id="invite"><label>E-mail <input name="email" type="email" required></label>
        <label>Rôle <select name="role">${options(ROLES, 'technicien')}</select></label> <button class="primary">Créer l'invitation</button><p class="error"></p></form>
      <ul class="invs" id="invs"><li>Chargement…</li></ul></section>` : ''}
    <p><button id="out">Se déconnecter</button></p></div>`;
  el.querySelector('#out').onclick = signOut;
  const acting = el.querySelector('#acting');
  if (acting) acting.onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.rpc('set_acting_role', { p_role: e.target.role.value });
    if (error) return e.target.querySelector('p').textContent = error.message;
    stopLive(); S.me = null; rerender();
  };
  if (!admin) return;
  const link = t => `${location.origin}${location.pathname}#invitation/${t}`;
  const { data: invs, error } = await sb.from('invitations').select('id, email, role, token, expires_at').is('accepted_at', null).order('created_at', { ascending: false });
  el.querySelector('#invs').innerHTML = error ? `<li>${esc(error.message)}</li>` : invs.map(i => `<li>${esc(i.email)} · ${ROLES[i.role]} · expire le ${fmt(i.expires_at)}
    · <a href="${link(i.token)}">lien</a> <button class="danger" data-revoke="${i.id}">Annuler</button></li>`).join('') || '<li>Aucune invitation en attente.</li>';
  el.querySelectorAll('[data-revoke]').forEach(b => b.onclick = async () => {
    const { error } = await sb.from('invitations').delete().eq('id', b.dataset.revoke);
    error ? b.after(` ${error.message}`) : renderMe(el);
  });
  el.querySelector('#invite').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.from('invitations')
      .insert({ org_id: S.me.org_id, email: e.target.email.value.trim().toLowerCase(), role: e.target.role.value, invited_by: S.me.id }).select('token').single();
    error ? e.target.querySelector('p').textContent = error.message : renderMe(el);
  };
}
