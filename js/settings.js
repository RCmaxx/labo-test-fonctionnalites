import { sb } from './sb.js';
import { S, esc, ROLES, options, fmt, rerender } from './state.js';

const link = t => `${location.origin}${location.pathname}#invitation/${t}`;

export async function renderSettings(el) {
  const [{ data: org }, { data: members }, { data: invs, error: ie }] = await Promise.all([
    sb.from('organizations').select('id, name').eq('id', S.me.org_id).maybeSingle(),
    sb.from('members').select('user_id, full_name, email, role').order('created_at'),
    sb.from('invitations').select('id, email, role, token, expires_at').is('accepted_at', null).order('created_at', { ascending: false }),
  ]);
  const team = members || [];
  const me = S.me.id;
  el.innerHTML = `
    <div class="account setpage">
      <h1>Gestion des profils</h1>
      <section class="panel">
        <h2>Entreprise</h2>
        <form class="stack" id="org">
          <label>Nom <input name="name" required maxlength="120" value="${esc(org?.name || '')}"></label>
          <button class="primary" type="submit">Enregistrer</button>
          <p class="error"></p>
        </form>
      </section>
      <section class="panel">
        <h2>Équipe</h2>
        <table class="tlist">
          <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th></th></tr></thead>
          <tbody>${team.map(m => `<tr>
            <td>${esc(m.full_name) || '—'}</td>
            <td>${esc(m.email)}</td>
            <td>${m.user_id !== me ? `<select data-role="${m.user_id}">${options(ROLES, m.role)}</select>` : esc(ROLES[m.role] || m.role)}</td>
            <td>${m.user_id !== me ? `<button type="button" class="ghost danger" data-del="${m.user_id}">Retirer</button>` : ''}</td>
          </tr>`).join('')}</tbody>
        </table>
        <p class="error" id="terr"></p>
      </section>
      <section class="panel">
        <h2>Inviter un membre</h2>
        <form class="inline" id="inv">
          <label>E-mail <input name="email" type="email" required></label>
          <label>Rôle <select name="role">${options(ROLES, 'technicien')}</select></label>
          <button class="primary" type="submit">Créer l'invitation</button>
          <p class="error"></p>
        </form>
        <ul class="invs">${ie ? `<li>${esc(ie.message)}</li>` : (invs || []).map(i => `<li>${esc(i.email)} · ${ROLES[i.role]} · expire le ${fmt(i.expires_at)}
          <button type="button" class="ghost" data-copy="${i.token}">Copier le lien</button>
          <button type="button" class="ghost danger" data-revoke="${i.id}">Annuler</button></li>`).join('') || '<li>Aucune invitation en attente.</li>'}</ul>
      </section>
      <section class="panel">
        <h2>Mon profil</h2>
        <form class="stack" id="me">
          <label>Nom <input name="full_name" required maxlength="12" value="${esc(S.me.full_name)}"></label>
          <label>E-mail <input value="${esc(S.me.email)}" disabled></label>
          <label>Rôle <input value="${esc(ROLES[S.me.real] || S.me.real)}" disabled></label>
          <button class="primary" type="submit">Enregistrer</button>
          <p class="error"></p>
        </form>
      </section>
      <section class="panel">
        <h2>Mot de passe</h2>
        <form class="stack" id="pw">
          <label>Nouveau mot de passe <input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
          <button class="primary" type="submit">Modifier</button>
          <p class="error"></p>
        </form>
      </section>
    </div>`;

  const err = (form, m) => { const p = form.querySelector('.error'); if (p) p.textContent = m || ''; };
  el.querySelector('#org').onsubmit = async e => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const { error } = await sb.from('organizations').update({ name }).eq('id', S.me.org_id);
    if (error) return err(e.target, error.message);
    S.org = { ...(S.org || {}), name }; err(e.target, ''); rerender();
  };
  el.querySelector('#me').onsubmit = async e => {
    e.preventDefault();
    const full_name = e.target.full_name.value.trim();
    const { error } = await sb.from('members').update({ full_name }).eq('user_id', me);
    if (error) return err(e.target, error.message);
    S.me.full_name = full_name; err(e.target, ''); rerender();
  };
  el.querySelector('#pw').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.updateUser({ password: e.target.password.value });
    e.target.password.value = '';
    err(e.target, error ? error.message : 'Mot de passe modifié.');
  };
  el.querySelectorAll('[data-role]').forEach(s => s.onchange = async () => {
    const { error } = await sb.from('members').update({ role: s.value }).eq('user_id', s.dataset.role);
    const terr = el.querySelector('#terr');
    if (error) return terr.textContent = error.message;
    terr.textContent = 'Rôle modifié.';
    const m = S.team.find(x => x.user_id === s.dataset.role); if (m) m.role = s.value;
  });
  el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Retirer ce membre de l\'entreprise ?')) return;
    const { error } = await sb.from('members').delete().eq('user_id', b.dataset.del);
    if (error) return el.querySelector('#terr').textContent = error.message;
    S.team = S.team.filter(x => x.user_id !== b.dataset.del);
    renderSettings(el);
  });
  el.querySelector('#inv').onsubmit = async e => {
    e.preventDefault();
    const { data, error } = await sb.from('invitations')
      .insert({ org_id: S.me.org_id, email: e.target.email.value.trim().toLowerCase(), role: e.target.role.value, invited_by: me })
      .select('token').single();
    if (error) return err(e.target, error.message);
    try { await navigator.clipboard.writeText(link(data.token)); } catch { prompt('Lien d\'invitation à copier :', link(data.token)); }
    renderSettings(el);
  };
  el.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
    const text = link(b.dataset.copy);
    try { await navigator.clipboard.writeText(text); } catch { prompt('Lien d\'invitation à copier :', text); }
  });
  el.querySelectorAll('[data-revoke]').forEach(b => b.onclick = async () => {
    const { error } = await sb.from('invitations').delete().eq('id', b.dataset.revoke);
    if (error) return b.after(' ' + error.message);
    renderSettings(el);
  });
}
