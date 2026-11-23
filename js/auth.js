import { sb } from './sb.js?v=20261123215029';
import { S, app, esc, fmt, options, rerender, ACCOUNTS, ROLES, VERSION } from './state.js?v=20261123215029';
import { stopLive } from './live.js?v=20261123215029';

export function renderLogin(error = '', intro = '') {
  app.innerHTML = `${intro}
    <h1>Connexion</h1><p>${VERSION}</p>
    <form id="login">
      <label>Compte <select name="email">${ACCOUNTS.map(a => `<option value="${a}@test.local">${a}</option>`).join('')}</select></label>
      <label>Mot de passe <input name="password" type="password" required autocomplete="current-password"></label>
      <button>Se connecter</button>
      <p>${esc(error)}</p>
    </form>`;
  app.querySelector('#login').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword(Object.fromEntries(new FormData(e.target)));
    error ? renderLogin(error.message, intro) : rerender();
  };
}

export async function signOut() { await sb.auth.signOut(); stopLive(); S.me = null; location.hash = ''; rerender(); }

// Compte connecté sans entreprise : création de la sienne.
export function renderOrg(user) {
  app.innerHTML = `
    <h1>Créer votre entreprise</h1>
    <p>Le compte ${esc(user.email)} n'est rattaché à aucune entreprise. Créez-la, ou ouvrez le lien d'invitation reçu.</p>
    <form>
      <label>Nom de l'entreprise <input name="org" required maxlength="120"></label>
      <label>Votre nom <input name="name" required maxlength="12"></label>
      <button>Créer l'entreprise</button><p></p>
    </form>
    <button id="out">Se déconnecter</button>`;
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
  if (!inv) return app.innerHTML = `<h1>Invitation</h1><p>${esc(error?.message || 'Invitation invalide, expirée ou déjà utilisée.')}</p><a href="#">Connexion</a>`;
  const intro = `<h1>Invitation</h1><p>Rejoindre ${esc(inv.org_name)} en tant que ${ROLES[inv.role] || esc(inv.role)} (${esc(inv.email)}).</p>`;
  if (!session) {
    app.innerHTML = `${intro}
      <form id="signup">
        <label>Votre nom <input name="name" required maxlength="12"></label>
        <label>Mot de passe <input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
        <button>Créer le compte et rejoindre</button><p></p>
      </form>
      <p>Déjà un compte ? Connectez-vous ci-dessous, puis cette page s'affichera à nouveau.</p>
      <form id="inlogin">
        <label>E-mail <input name="email" type="email" required value="${esc(inv.email)}" autocomplete="username"></label>
        <label>Mot de passe <input name="password" type="password" required autocomplete="current-password"></label>
        <button>Se connecter</button><p></p>
      </form>`;
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
    app.querySelector('#inlogin').onsubmit = async e => {
      e.preventDefault();
      const { error } = await sb.auth.signInWithPassword(Object.fromEntries(new FormData(e.target)));
      error ? e.target.querySelector('p').textContent = error.message : rerender();
    };
    return;
  }
  app.innerHTML = `${intro}
    <form><label>Votre nom <input name="name" required maxlength="12"></label> <button>Accepter l'invitation</button><p></p></form>`;
  app.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    await acceptInvite(token, e.target.name.value.trim(), e.target.querySelector('p'));
  };
}

export async function renderMe(el) {
  const admin = S.me.role === 'admin';
  el.innerHTML = `
    <h1>Mon compte</h1>
    <p>Nom : ${esc(S.me.full_name) || '—'}</p>
    <p>E-mail : ${esc(S.me.email)}</p>
    <p>Rôle : ${esc(ROLES[S.me.role] || S.me.role || 'aucun')}</p>
    ${S.me.real === 'admin' ? `<form id="acting"><label>Voir en tant que <select name="role">${options(ROLES, S.me.role)}</select></label> <button>Changer</button><p></p></form>` : ''}
    ${admin ? `<section><h2>Invitations</h2>
      <form id="invite"><label>E-mail <input name="email" type="email" required></label>
        <label>Rôle <select name="role">${options(ROLES, 'technicien')}</select></label> <button>Créer l'invitation</button><p></p></form>
      <ul id="invs"><li>Chargement…</li></ul></section>` : ''}
    <button id="out">Se déconnecter</button>`;
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
    · <a href="${link(i.token)}">lien</a> <button data-revoke="${i.id}">Annuler</button></li>`).join('') || '<li>Aucune invitation en attente.</li>';
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
