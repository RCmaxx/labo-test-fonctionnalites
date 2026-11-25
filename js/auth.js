import { sb } from './sb.js';
import { S, app, esc, fmt, options, rerender, ACCOUNTS, ROLES } from './state.js';
import { toast } from './alerts.js';
import { stopLive } from './live.js';

// Formulaire de connexion unique : le champ e-mail varie (liste des comptes de test, ou e-mail invité).
const loginForm = (emailField, error = '') => `<form class="panel" id="login">${emailField}
  <label>Mot de passe <input name="password" type="password" required autocomplete="current-password"></label>
  <button class="primary">Se connecter</button><p class="error">${esc(error)}</p></form>`;
// Un nom court (« admin.a ») vaut l'adresse de test correspondante, comme dans l'appli tech.
const emailOf = v => (v.trim().includes('@') ? v.trim() : v.trim().toLowerCase() + '@test.local');
const bindLogin = () =>
  (app.querySelector('#login').onsubmit = async e => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(e.target));
    const { error } = await sb.auth.signInWithPassword({ email: emailOf(d.email), password: d.password });
    error ? (e.target.querySelector('.error').textContent = error.message) : rerender();
  });

// Écrans sans session, comme l'appli tech : titre, formulaire, liens en pied.
const card = (title, body, foot = '') =>
  `<section class="auth"><h1>${title}</h1>${body}${foot ? `<p class="auth__foot">${foot}</p>` : ''}</section>`;
const done = (sel, run) =>
  (app.querySelector(sel).onsubmit = async e => {
    e.preventDefault();
    const out = e.target.querySelector('.error');
    out.textContent = '';
    const msg = await run(Object.fromEntries(new FormData(e.target)));
    if (msg) out.textContent = msg;
  });

export function renderLogin(error = '') {
  app.innerHTML = card(
    'Connexion',
    `<form id="login" class="stack">
      <label>E-mail<input name="email" type="text" required autocomplete="username" autocapitalize="off" spellcheck="false" list="accts"></label>
      <datalist id="accts">${ACCOUNTS.map(a => `<option value="${a}">`).join('')}</datalist>
      <label>Mot de passe<input name="password" type="password" required autocomplete="current-password"></label>
      <button class="primary" type="submit">Se connecter</button><p class="error">${esc(error)}</p>
    </form>`,
    '<a href="#mot-de-passe">Mot de passe oublié</a> · <a href="#inscription">Créer un compte entreprise</a>'
  );
  bindLogin();
}

export function renderForgot() {
  app.innerHTML = card(
    'Mot de passe oublié',
    `<form id="fg" class="stack">
      <label>E-mail<input name="email" type="email" required autocomplete="email"></label>
      <button class="primary" type="submit">Recevoir un lien</button><p class="error"></p>
    </form>`,
    '<a href="#">Retour à la connexion</a>'
  );
  done('#fg', async d => {
    const { error } = await sb.auth.resetPasswordForEmail(d.email.trim(), {
      redirectTo: location.origin + location.pathname,
    });
    if (error) return error.message;
    toast("Si un compte existe, un lien vient d'être envoyé.");
  });
}

// Création d'un compte entreprise : l'entreprise est créée à la première connexion (nom gardé dans le compte).
export function renderSignup() {
  app.innerHTML = card(
    'Créer un compte entreprise',
    `<form id="su" class="stack">
      <label>Nom de l'entreprise<input name="org" required maxlength="120"></label>
      <label>Votre nom<input name="name" required maxlength="12" autocomplete="name"></label>
      <label>E-mail<input name="email" type="email" required autocomplete="email"></label>
      <label>Mot de passe<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
      <button class="primary" type="submit">Créer le compte</button><p class="error"></p>
    </form>`,
    'Déjà un compte ? <a href="#">Se connecter</a>'
  );
  done('#su', async d => {
    const { data, error } = await sb.auth.signUp({
      email: d.email.trim(),
      password: d.password,
      options: { emailRedirectTo: location.origin + location.pathname, data: { full_name: d.name, org_name: d.org } },
    });
    if (error) return error.message;
    if (data.session) {
      location.hash = '';
      return rerender();
    }
    app.innerHTML = card(
      'Vérifiez vos e-mails',
      `<p>Un lien de confirmation a été envoyé à <b>${esc(d.email)}</b>. Ouvrez-le puis connectez-vous.</p>`,
      '<a href="#">Retour à la connexion</a>'
    );
  });
}

export async function signOut() {
  await sb.auth.signOut();
  stopLive();
  S.me = null;
  location.hash = '';
  rerender();
}

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
    const { error } = await sb.rpc('create_organization', {
      p_name: e.target.org.value.trim(),
      p_full_name: e.target.name.value.trim(),
    });
    error ? (e.target.querySelector('p').textContent = error.message) : rerender();
  };
}

// Lien d'invitation : #invitation/<token>. Inscription (signUp) puis accept_invitation.
// Les @test.local n'ont pas de boîte mail : un trigger confirme ces comptes à la création.
async function acceptInvite(token, name, out) {
  const { error } = await sb.rpc('accept_invitation', { p_token: token, p_full_name: name });
  if (error) {
    if (out) out.textContent = error.message;
    return;
  }
  stopLive();
  S.me = null;
  location.hash = '';
}
export async function renderInvitation(token, session) {
  const { data, error } = await sb.rpc('invitation_info', { p_token: token });
  const inv = data?.[0];
  if (!inv)
    return (app.innerHTML = `<div class="auth"><h1>Invitation</h1><p>${esc(error?.message || 'Invitation invalide, expirée ou déjà utilisée.')}</p><a href="#">Connexion</a></div>`);
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
      const name = e.target.name.value.trim(),
        password = e.target.password.value,
        out = e.target.querySelector('p');
      const { data, error } = await sb.auth.signUp({
        email: inv.email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) return (out.textContent = error.message);
      if (!data.session) {
        const { error: e2 } = await sb.auth.signInWithPassword({ email: inv.email, password });
        if (e2)
          return (out.textContent =
            "Compte créé, mais il n'est pas encore confirmé. Les adresses @test.local ne reçoivent pas d'e-mail : confirmez le compte dans Supabase (Authentication) puis rouvrez ce lien.");
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
    ${
      admin
        ? `<section class="panel"><h2>Invitations</h2>
      <form class="inline" id="invite"><label>E-mail <input name="email" type="email" required></label>
        <label>Rôle <select name="role">${options(ROLES, 'technicien')}</select></label> <button class="primary">Créer l'invitation</button><p class="error"></p></form>
      <ul class="invs" id="invs"><li>Chargement…</li></ul></section>`
        : ''
    }
    <p><button id="out">Se déconnecter</button></p></div>`;
  el.querySelector('#out').onclick = signOut;
  if (!admin) return;
  const link = t => `${location.origin}${location.pathname}#invitation/${t}`;
  const { data: invs, error } = await sb
    .from('invitations')
    .select('id, email, role, token, expires_at')
    .is('accepted_at', null)
    .order('created_at', { ascending: false });
  el.querySelector('#invs').innerHTML = error
    ? `<li>${esc(error.message)}</li>`
    : invs
        .map(
          i => `<li>${esc(i.email)} · ${ROLES[i.role]} · expire le ${fmt(i.expires_at)}
    · <a href="${link(i.token)}">lien</a> <button class="danger" data-revoke="${i.id}">Annuler</button></li>`
        )
        .join('') || '<li>Aucune invitation en attente.</li>';
  el.querySelectorAll('[data-revoke]').forEach(
    b =>
      (b.onclick = async () => {
        const { error } = await sb.from('invitations').delete().eq('id', b.dataset.revoke);
        error ? b.after(` ${error.message}`) : renderMe(el);
      })
  );
  el.querySelector('#invite').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb
      .from('invitations')
      .insert({
        org_id: S.me.org_id,
        email: e.target.email.value.trim().toLowerCase(),
        role: e.target.role.value,
        invited_by: S.me.id,
      })
      .select('token')
      .single();
    error ? (e.target.querySelector('p').textContent = error.message) : renderMe(el);
  };
}
