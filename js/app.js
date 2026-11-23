import { sb } from './sb.js?v=20261123214910';
import { S, app, route, VERSION } from './state.js?v=20261123214910';
import { renderLogin, renderOrg, renderInvitation, renderMe } from './auth.js?v=20261123214910';
import { renderList } from './list.js?v=20261123214910';
import { renderDetail } from './detail.js?v=20261123214910';
import { renderForm } from './form.js?v=20261123214910';
import { startLive } from './live.js?v=20261123214910';
import { drawAlerts } from './alerts.js?v=20261123214910';

async function render() {
  const [page, id] = route();
  const { data: { session } } = await sb.auth.getSession();
  if (page === 'invitation') return renderInvitation(id, session);
  if (!session) return renderLogin();
  if (!S.me) {
    const uid = session.user.id;
    const [{ data: m, error }, t] = await Promise.all([
      sb.from('members').select('full_name, role, acting_role, org_id').eq('user_id', uid).maybeSingle(),
      sb.from('members').select('user_id, full_name, role'),
    ]);
    if (error) return renderLogin(error.message);
    if (!m) return renderOrg(session.user);
    S.me = { id: uid, email: session.user.email, full_name: m.full_name, org_id: m.org_id, real: m.role, role: m.role === 'admin' && m.acting_role || m.role };
    S.team = t.data || [];
    startLive(show);
  }
  app.innerHTML = `<nav><a href="#">Interventions</a> · <a href="#nouvelle">Nouvelle intervention</a> · <a href="#compte">Mon compte</a> · ${VERSION}</nav><aside id="alerts"></aside><main></main>`;
  drawAlerts();
  show();
}

// Affiche la page demandée dans <main> (aussi rappelée par le temps réel).
function show() {
  const el = app.querySelector('main'), [page, id, sub] = route();
  if (!el) return;
  page === 'compte' ? renderMe(el) : page === 'nouvelle' ? renderForm(el)
    : page === 'i' ? (sub === 'modifier' ? renderForm(el, id) : renderDetail(el, id)) : renderList(el);
}

addEventListener('hashchange', render);
addEventListener('labo:render', render);
render();
