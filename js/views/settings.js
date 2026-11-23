import { sb } from '../sb.js?v=20261123193833';
import { state, isRealAdmin, loadMember, role } from '../state.js?v=20261123193833';
import { $, esc, toast, errMsg, busy, formData, ROLES } from '../ui.js?v=20261123193833';
import { render } from '../app.js?v=20261123193833';
import * as team from './team.js?v=20261123193833';

export async function view(app) {
  // Paramètres réservés à l'admin ; page vide pour les autres rôles.
  if (!isRealAdmin()) { app.innerHTML = ''; return; }
  const admin = true;
  app.innerHTML = `
    <div class="page narrow">
      <div class="head"><h1>Gestion des profils</h1></div>
      ${role() === 'technicien' ? '' : `<section class="panel">
        <h2>Entreprise</h2>
        <form id="org" class="stack">
          <label>Nom<input name="name" required maxlength="120" value="${esc(state.org.name)}" ${admin ? '' : 'disabled'}></label>
          ${admin ? '<div class="actions"><button class="primary" type="submit">Enregistrer</button></div>' : ''}
        </form>
      </section>
      <div id="team"></div>`}
      <section class="panel">
        <h2>Mon profil</h2>
        <form id="me" class="stack">
          <label>Nom<input name="full_name" required maxlength="12" value="${esc(state.member.full_name)}"></label>
          <label>E-mail<input value="${esc(state.member.email)}" disabled></label>
          <label>Rôle<input value="${ROLES[state.member.role]}" disabled></label>
          <div class="actions"><button class="primary" type="submit">Enregistrer</button></div>
        </form>
      </section>
      <section class="panel">
        <h2>Mot de passe</h2>
        <form id="pw" class="stack">
          <label>Nouveau mot de passe<input name="password" type="password" required minlength="8" autocomplete="new-password"></label>
          <div class="actions"><button class="primary" type="submit">Modifier</button></div>
        </form>
      </section>
    </div>`;

  const save = (sel, fn) => ($(sel).onsubmit = e => {
    e.preventDefault();
    const d = formData(e.target);
    busy(e.submitter, async () => {
      const { error } = await fn(d);
      if (error) return toast(errMsg(error), true);
      toast('Enregistré.');
      await loadMember();
      render();
    });
  });
  if (admin) save('#org', d => sb.from('organizations').update({ name: d.name.trim() }).eq('id', state.org.id));
  save('#me', d => sb.from('members').update({ full_name: d.full_name.trim() }).eq('user_id', state.user.id));
  save('#pw', d => sb.auth.updateUser({ password: d.password }));
  const tm = $('#team');
  if (tm) await team.view(tm, true);
}
