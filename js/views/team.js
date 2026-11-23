import { sb, APP_URL } from '../sb.js?v=20261123193833';
import { state, isAdmin, loadMember } from '../state.js?v=20261123193833';
import { $, $$, esc, toast, errMsg, busy, formData, fmtDate, ROLES, avatar } from '../ui.js?v=20261123193833';
import { render } from '../app.js?v=20261123193833';

const link = token => `${APP_URL}#/invitation?token=${token}`;
const roleOpts = sel => Object.entries(ROLES).map(([k, v]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${v}</option>`).join('');

export async function view(app, emb = false) {
  await loadMember();
  const admin = isAdmin();
  const invs = admin ? (await sb.from('invitations').select('*').is('accepted_at', null).order('created_at', { ascending: false })).data || [] : [];
  const me = state.user.id;

  app.innerHTML = `
    <div class="${emb ? 'team' : 'page'}">
      ${emb ? '' : '<div class="head"><h1>Équipe</h1></div>'}
      <section class="panel">
        ${emb ? '<h2>Équipe</h2>' : ''}
        <table class="list plain">
          <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th>${admin ? '<th></th>' : ''}</tr></thead>
          <tbody>${state.members.map(m => `<tr>
            <td>${avatar(m.role === 'admin' ? 'Admin' : (m.full_name || m.email), m.role === 'admin' ? undefined : state.members.indexOf(m)).html} ${esc(m.full_name) || '—'}</td><td>${esc(m.email)}</td>
            <td>${admin && m.user_id !== me ? `<select data-role="${m.user_id}">${roleOpts(m.role)}</select>` : ROLES[m.role]}</td>
            ${admin ? `<td class="r">${m.user_id !== me ? `<button class="ghost danger" data-del="${m.user_id}">Retirer</button>` : ''}</td>` : ''}
          </tr>`).join('')}</tbody>
        </table>
      </section>
      ${admin ? `
      <section class="panel">
        <h2>Inviter un membre</h2>
        <form id="inv" class="inline">
          <input name="email" type="email" required placeholder="E-mail">
          <select name="role">${roleOpts('technicien')}</select>
          <button class="primary" type="submit">Créer l'invitation</button>
        </form>
        <p class="muted small">Copiez le lien d'invitation et envoyez-le à la personne. Elle crée son compte avec cette adresse e-mail.</p>
        ${invs.length ? `<table class="list plain">
          <thead><tr><th>E-mail</th><th>Rôle</th><th>Expire le</th><th></th></tr></thead>
          <tbody>${invs.map(i => `<tr><td>${esc(i.email)}</td><td>${ROLES[i.role]}</td><td>${fmtDate(i.expires_at)}</td>
            <td class="r"><button class="ghost" data-copy="${i.token}">Copier le lien</button> <button class="ghost danger" data-revoke="${i.id}">Annuler</button></td></tr>`).join('')}</tbody>
        </table>` : ''}
      </section>` : ''}
    </div>`;

  if (!admin) return;
  $('#inv').onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    busy(e.submitter, async () => {
      const { data, error } = await sb.from('invitations')
        .insert({ org_id: state.member.org_id, email: d.email.trim().toLowerCase(), role: d.role, invited_by: me })
        .select('token').single();
      if (error) return toast(errMsg(error), true);
      await copy(link(data.token));
      render();
    });
  };
  $$('[data-copy]').forEach(b => (b.onclick = () => copy(link(b.dataset.copy))));
  $$('[data-revoke]').forEach(b => (b.onclick = () => busy(b, async () => {
    const { error } = await sb.from('invitations').delete().eq('id', b.dataset.revoke);
    if (error) return toast(errMsg(error), true);
    render();
  })));
  $$('[data-role]').forEach(s => (s.onchange = async () => {
    const { error } = await sb.from('members').update({ role: s.value }).eq('user_id', s.dataset.role);
    if (error) return toast(errMsg(error), true);
    toast('Rôle modifié.');
  }));
  $$('[data-del]').forEach(b => (b.onclick = () => busy(b, async () => {
    if (!confirm('Retirer ce membre de l\'entreprise ?')) return;
    const { error } = await sb.from('members').delete().eq('user_id', b.dataset.del);
    if (error) return toast(errMsg(error), true);
    render();
  })));
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Lien d\'invitation copié.'); }
  catch { prompt('Lien d\'invitation à copier :', text); }
}
