import { sb } from './sb.js?v=20261123221841';
import { S, app, route, VERSION } from './state.js?v=20261123221841';
import { renderLogin, renderOrg, renderInvitation, renderMe } from './auth.js?v=20261123221841';
import { renderList } from './list.js?v=20261123221841';
import { renderDetail } from './detail.js?v=20261123221841';
import { renderForm } from './form.js?v=20261123221841';
import { startLive } from './live.js?v=20261123221841';
import { drawAlerts } from './alerts.js?v=20261123221841';

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
  app.innerHTML = `<nav class="topbar"><a href="#">Interventions</a><a href="#compte">Mon compte</a><button class="sim-toggle" id="sim">Mobile</button><small>${VERSION}</small></nav><aside class="alerts" id="alerts"></aside><main></main><a class="fab" href="#nouvelle" aria-label="Nouvelle intervention">+</a><nav class="tabbar"><a href="#" aria-label="Interventions"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></a><a href="#nouvelles" aria-label="Nouvelles interventions"><span class="tabbar__n" id="tabn"></span></a></nav>`;
  drawAlerts();
  app.querySelector('#sim').onclick = () => localStorage.labosim = document.documentElement.classList.toggle('sim') ? '1' : '';
  show();
}

// Affiche la page demandée dans <main> (aussi rappelée par le temps réel).
function show() {
  const el = app.querySelector('main'), [page, id, sub] = route();
  if (!el) return;
  const cur = page === 'compte' || page === 'nouvelles' ? '#' + page : '';
  app.querySelectorAll('.topbar a, .tabbar a').forEach(a => a.classList.toggle('on', a.hash === cur));
  page === 'compte' ? renderMe(el) : page === 'nouvelle' ? renderForm(el)
    : page === 'i' ? (sub === 'modifier' ? renderForm(el, id) : renderDetail(el, id)) : renderList(el);
}

addEventListener('hashchange', render);
addEventListener('labo:render', render);
render();
