import { sb, APP_URL } from '../sb.js?v=20261123193833';
import { state, loadMember } from '../state.js?v=20261123193833';
import { $, esc, toast, errMsg, busy, formData, ROLES } from '../ui.js?v=20261123193833';
import { go } from '../app.js?v=20261123193833';

const card = (title, body, foot = '') => `
  <section class="auth">
    <h1>${title}</h1>
    ${body}
    ${foot ? `<p class="foot">${foot}</p>` : ''}
  </section>`;

export function login(app) {
  app.innerHTML = card('Connexion', `
    <form id="f" class="stack">
      <label>E-mail<input name="email" type="text" required autocomplete="username" autocapitalize="off" spellcheck="false"></label>
      <label>Mot de passe<input name="password" type="password" required autocomplete="current-password"></label>
      <button class="primary" type="submit">Se connecter</button>
    </form>`,
    `<a href="#/mot-de-passe">Mot de passe oublié</a> · <a href="#/inscription">Créer un compte entreprise</a>`);
  // Lot 225 : « Voir en tant que » vers un compte de test réel : e-mail prérempli.
  const pre = sessionStorage.getItem('gi-as-email'); if (pre) { $('#f [name=email]').value = pre; setTimeout(() => $('#f [name=password]')?.focus(), 50); }
  $('#f').onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    sessionStorage.removeItem('gi-as-email');
    busy(e.submitter, async () => {
      const { error } = await sb.auth.signInWithPassword({ email: (d.email.trim().includes('@') ? d.email.trim() : d.email.trim().toLowerCase() + '@test.local'), password: d.password });
      if (error) toast(errMsg(error), true);
    });
  };
}

export function signup(app, { invite } = {}) {
  const inv = invite || null;
  app.innerHTML = card(inv ? 'Créer votre compte' : 'Créer un compte entreprise', `
    <form id="f" class="stack">
      ${inv ? '' : '<label>Nom de l\'entreprise<input name="org" required maxlength="120"></label>'}
      <label>Votre nom<input name="name" required autocomplete="name"></label>
      <label>E-mail<input name="email" type="email" required autocomplete="email" value="${esc(inv?.email || '')}" ${inv ? 'readonly' : ''}></label>
      <label>Mot de passe<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
      <button class="primary" type="submit">Créer le compte</button>
    </form>`,
    `Déjà un compte ? <a href="#/connexion">Se connecter</a>`);
  $('#f').onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    busy(e.submitter, async () => {
      const { data, error } = await sb.auth.signUp({
        email: d.email.trim(),
        password: d.password,
        options: {
          emailRedirectTo: APP_URL,
          data: inv ? { full_name: d.name, invite: true } : { full_name: d.name, org_name: d.org },
        },
      });
      if (error) return toast(errMsg(error), true);
      if (!data.session) {
        app.innerHTML = card('Vérifiez vos e-mails', `<p>Un lien de confirmation a été envoyé à <b>${esc(d.email)}</b>. Ouvrez-le puis connectez-vous${inv ? ' depuis le lien d\'invitation' : ''}.</p>`,
          '<a href="#/connexion">Retour à la connexion</a>');
      }
      // Avec une session, onAuthStateChange crée l'entreprise ou accepte l'invitation.
    });
  };
}

export function forgot(app) {
  app.innerHTML = card('Mot de passe oublié', `
    <form id="f" class="stack">
      <label>E-mail<input name="email" type="email" required autocomplete="email"></label>
      <button class="primary" type="submit">Recevoir un lien</button>
    </form>`, '<a href="#/connexion">Retour à la connexion</a>');
  $('#f').onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    busy(e.submitter, async () => {
      const { error } = await sb.auth.resetPasswordForEmail(d.email.trim(), { redirectTo: APP_URL });
      if (error) return toast(errMsg(error), true);
      toast('Si un compte existe, un lien vient d\'être envoyé.');
    });
  };
}

export function newPassword(app) {
  app.innerHTML = card('Nouveau mot de passe', `
    <form id="f" class="stack">
      <label>Nouveau mot de passe<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
      <button class="primary" type="submit">Enregistrer</button>
    </form>`);
  $('#f').onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    busy(e.submitter, async () => {
      const { error } = await sb.auth.updateUser({ password: d.password });
      if (error) return toast(errMsg(error), true);
      state.recovery = false;
      toast('Mot de passe modifié.');
      go('');
    });
  };
}

// Utilisateur connecté sans entreprise : créer la sienne.
export function onboarding(app) {
  const md = state.user.user_metadata || {};
  app.innerHTML = card('Créer votre entreprise', `
    <p class="muted">Votre compte <b>${esc(state.user.email)}</b> n'est rattaché à aucune entreprise. Créez-la, ou ouvrez le lien d'invitation reçu de votre administrateur.</p>
    <form id="f" class="stack">
      <label>Nom de l'entreprise<input name="org" required maxlength="120" value="${esc(md.org_name || '')}"></label>
      <label>Votre nom<input name="name" required maxlength="12" value="${esc(md.full_name || '')}"></label>
      <button class="primary" type="submit">Créer l'entreprise</button>
    </form>`, '<a href="#" id="out">Se déconnecter</a>');
  $('#out').onclick = async e => { e.preventDefault(); await sb.auth.signOut(); };
  $('#f').onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    busy(e.submitter, async () => {
      const { error } = await sb.rpc('create_organization', { p_name: d.org, p_full_name: d.name });
      if (error) return toast(errMsg(error), true);
      await loadMember();
      go('');
    });
  };
}

// Lien d'invitation : #/invitation?token=...
export async function invitation(app, { q }) {
  const token = q?.get('token') || sessionStorage.getItem('invite');
  if (!token) return go('');
  sessionStorage.setItem('invite', token);
  const { data } = await sb.rpc('invitation_info', { p_token: token });
  const inv = data?.[0];
  if (!inv) {
    sessionStorage.removeItem('invite');
    app.innerHTML = card('Invitation', '<p>Cette invitation est invalide, expirée ou déjà utilisée.</p>', '<a href="#/connexion">Connexion</a>');
    return;
  }
  const intro = `<p>Vous êtes invité à rejoindre <b>${esc(inv.org_name)}</b> en tant que <b>${ROLES[inv.role]}</b>.</p>`;
  if (!state.user) {
    signup(app, { invite: inv });
    $('.auth h1').insertAdjacentHTML('afterend', intro);
    $('.auth .foot').innerHTML = `Déjà un compte avec ${esc(inv.email)} ? <a href="#/connexion">Se connecter</a> puis rouvrez le lien.`;
    return;
  }
  app.innerHTML = card('Rejoindre l\'équipe', `${intro}
    <form id="f" class="stack">
      <label>Votre nom<input name="name" required maxlength="12" value="${esc(state.user.user_metadata?.full_name || '')}"></label>
      <button class="primary" type="submit">Accepter l'invitation</button>
    </form>`, '<a href="#" id="out">Se déconnecter</a>');
  $('#out').onclick = async e => { e.preventDefault(); await sb.auth.signOut(); };
  $('#f').onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    busy(e.submitter, async () => {
      const { error } = await sb.rpc('accept_invitation', { p_token: token, p_full_name: d.name });
      if (error) return toast(errMsg(error), true);
      sessionStorage.removeItem('invite');
      await loadMember();
      go('');
    });
  };
}
