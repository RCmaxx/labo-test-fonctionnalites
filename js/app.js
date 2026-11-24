import { sb } from './sb.js';
import { S, app, route, isMob, VERSION, esc, ROLES, PNAME } from './state.js';
import { renderLogin, renderOrg, renderInvitation, renderMe, signOut } from './auth.js';
import { renderSettings } from './settings.js';
import { renderList } from './list.js';
import { renderDetail } from './detail.js';
import { renderForm } from './form.js';
import { startLive, stopLive } from './live.js';
import { drawAlerts } from './alerts.js';
import { loadCounts, paintCounts } from './counts.js';
import { initTabs } from './tabs.js';

const SEARCH =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>';
const LIST =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>';
const GEAR =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
const USERS =
  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6M21 20c0-2.6-1.6-4.8-4-5.6"/></svg>';
const ADM = 'lab-admin-sess';
const REAL = { bis: ['tech.bis@test.local', 'Antoine'], cli: ['client@test.local', 'Client'] };
// Mobile tech : la racine (#) est la page Terminées.
const titleOf = pg => TITLES[pg || (isMob() && S.me?.role !== 'client' ? 'terminees' : '')] || 'Interventions';
const TITLES = {
  nouvelles: 'Interventions',
  mes: 'Mes interventions',
  encours: 'En cours',
  terminees: 'Terminées',
  recherche: 'Recherche',
  parametres: 'Profils',
  equipe: 'Profils',
  compte: 'Mon compte',
  nouvelle: 'Nouvelle intervention',
  i: 'Intervention',
};
const AV = ['var(--av-1)', 'var(--av-2)', 'var(--av-3)', 'var(--av-4)', 'var(--av-5)', 'var(--av-6)'];
const avatar = name => {
  const s = String(name || '?').trim() || '?';
  const i = [...s].reduce((a, c) => a + c.charCodeAt(0), 0);
  return { bg: AV[i % 6], e: s[0].toUpperCase() };
};

async function render() {
  const [page, id] = route();
  const {
    data: { session },
  } = await sb.auth.getSession();
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
    const { data: org } = await sb.from('organizations').select('name').eq('id', m.org_id).maybeSingle();
    S.me = {
      id: uid,
      email: session.user.email,
      full_name: m.full_name,
      org_id: m.org_id,
      real: m.role,
      role: (m.role === 'admin' && m.acting_role) || m.role,
    };
    S.org = org;
    S.team = t.data || [];
    startLive(show);
  }
  const r = S.me.role,
    admin = S.me.real === 'admin',
    cli = r === 'client';
  // Comme l'appli tech : un technicien a toujours la vue mobile (cadre téléphone sur grand écran).
  document.documentElement.classList.toggle('sim', r === 'technicien' || !!localStorage.labosim);
  const disp = admin ? PNAME[r] || S.me.full_name : S.me.full_name || S.me.email;
  const av = avatar(admin && r === 'client' ? 'Client' : disp);
  const pick = admin;
  const roles = Object.entries(ROLES).filter(([k]) => k !== 'client');
  const sel = pick
    ? `<select id="asrole" aria-label="Voir en tant que">
    ${roles.map(([k, v]) => `<option value="${k}" ${k === r && !document.documentElement.classList.contains('sim') ? 'selected' : ''}>${esc(PNAME[k] || v)} · ${esc(v)}</option>`).join('')}
    <option value="responsable_tech|m" ${document.documentElement.classList.contains('sim') && r === 'responsable_tech' ? 'selected' : ''}>${esc(PNAME.responsable_tech)} · RT mobile</option>
    <option value="directeur|m" ${document.documentElement.classList.contains('sim') && r === 'directeur' ? 'selected' : ''}>${esc(PNAME.directeur)} · Directeur mobile</option>
    <option value="bis"${S.me.email === REAL.bis[0] ? ' selected' : ''}>${esc(REAL.bis[1])} · Tech bis</option>
    <option value="cli"${S.me.email === REAL.cli[0] && !document.documentElement.classList.contains('sim') ? ' selected' : ''}>Client</option>
    <option value="cli|m"${S.me.email === REAL.cli[0] && document.documentElement.classList.contains('sim') ? ' selected' : ''}>Client mobile</option>
  </select>`
    : '';
  const [pg] = route();
  const ptit = titleOf(pg);
  app.innerHTML = `<nav class="topbar">
    <span class="ptit">${esc(ptit)}</span>
    <span class="pcnt"></span>
    <span class="brand">${esc(S.org?.name || '')}</span>
    <nav class="tnav">
      <a href="#">Interventions</a>
      ${cli ? '' : '<a href="#terminees">Terminées</a>'}
      ${admin ? '<a href="#parametres">Profils</a>' : ''}
      ${cli ? '' : `<a href="#recherche" class="ico-search" aria-label="Rechercher">${SEARCH}</a>`}
    </nav>
    <div class="who">
      <button type="button" class="acct" id="acct" aria-expanded="false" aria-label="Compte">
        <span class="av" style="background:${av.bg}">${esc(av.e)}</span>
        <span class="acc-t"><b>${esc(disp)}</b>${pick ? '' : `<i>${esc(ROLES[r] || r)}</i>`}</span>
      </button>
      ${sel}
      ${S.me.role === 'admin' ? '<a href="#compte">Mon compte</a>' : ''}
      <button type="button" class="ghost" id="logout">Déconnexion</button>
      <button type="button" class="sim-toggle" id="sim">Mobile</button>
      <small>${VERSION}</small>
    </div>
  </nav>
  <aside class="alerts" id="alerts"></aside>
  <main></main>
  ${cli ? '' : '<a class="fabm" href="#mes" id="fabm" aria-label="Mes interventions"></a>'}
  <a class="fab" href="#nouvelle" aria-label="Nouvelle intervention">+</a>
  <nav class="tabbar">
    <i class="tabbar__ind" aria-hidden="true"></i>
    <a href="#" aria-label="Terminées">${LIST}</a>
    ${cli ? '' : '<a href="#nouvelles" aria-label="Nouvelles interventions"><span class="tabbar__n" id="tabn"></span></a><a href="#mes" aria-label="Mes interventions"><span class="tabbar__m" id="tabm"></span></a>'}
    ${admin ? `<a href="#parametres" aria-label="Profils">${USERS}</a>` : ''}
    <button type="button" class="tabbar__gear" id="gear" aria-label="Compte et profil" aria-expanded="false">${GEAR}</button>
  </nav>`;
  drawAlerts();
  paintCounts();
  loadCounts();
  app.querySelector('#sim').onclick = () => {
    localStorage.labosim = document.documentElement.classList.toggle('sim') ? '1' : '';
    render();
  };
  app.querySelector('#logout').onclick = () => signOut();
  const acct = app.querySelector('#acct');
  acct.onclick = e => {
    e.stopPropagation();
    const on = app.querySelector('.topbar').classList.toggle('open');
    acct.setAttribute('aria-expanded', String(on));
  };
  app.querySelector('#gear').onclick = e => {
    e.stopPropagation();
    const on = app.querySelector('.topbar').classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(on));
  };
  const asr = app.querySelector('#asrole');
  if (asr) asr.onchange = () => pickRole(asr);
  show();
}

async function backToAdmin() {
  const raw = localStorage.getItem(ADM);
  if (!raw) return false;
  const { data, error } = await sb.auth.setSession(JSON.parse(raw));
  localStorage.removeItem(ADM);
  if (error) {
    localStorage.labosim = '';
    document.documentElement.classList.remove('sim');
    await sb.auth.signOut();
    stopLive();
    S.me = null;
    return false;
  }
  stopLive();
  S.me = null;
  S.org = null;
  return !!data.session;
}

async function pickRole(sel) {
  sel.disabled = true;
  const [rk, mob] = sel.value.split('|');
  const setMob = on => {
    document.documentElement.classList.toggle('sim', on);
    localStorage.labosim = on ? '1' : '';
  };
  if (REAL[rk]) {
    const [em] = REAL[rk];
    if (S.me.email !== em) {
      if (localStorage.getItem(ADM) && !(await backToAdmin())) {
        location.hash = '';
        return render();
      }
      const cur = (await sb.auth.getSession()).data.session;
      if (cur && S.me.real === 'admin')
        localStorage.setItem(ADM, JSON.stringify({ access_token: cur.access_token, refresh_token: cur.refresh_token }));
      if (!cur || S.me.real !== 'admin') {
        sel.disabled = false;
        return;
      }
      const { data: fx, error: fe } = await sb.functions.invoke('as-test-user', { body: { email: em } });
      if (fe || !fx?.token_hash) {
        localStorage.removeItem(ADM);
        sel.disabled = false;
        return;
      }
      const { data: vo, error: ve } = await sb.auth.verifyOtp({ token_hash: fx.token_hash, type: 'magiclink' });
      if (ve || !vo?.session) {
        localStorage.removeItem(ADM);
        sel.disabled = false;
        return render();
      }
      stopLive();
      S.me = null;
      S.org = null;
    }
    setMob(!!mob);
    location.hash = '';
    return render();
  }
  if (localStorage.getItem(ADM) && S.me.email !== (await sb.auth.getSession()).data.session?.user?.email) {
    if (!(await backToAdmin())) return render();
  }
  const { error } = await sb.rpc('set_acting_role', { p_role: rk });
  if (error) {
    sel.disabled = false;
    return;
  }
  setMob(!!mob);
  S.me = null;
  S.org = null;
  render();
}

// Indicateur qui glisse vers l'onglet actif de la barre du bas (la position précédente est gardée d'un rendu à l'autre).
let indPos = null;
function moveIndicator() {
  const bar = app.querySelector('.tabbar'),
    ind = bar?.querySelector('.tabbar__ind'),
    on = bar?.querySelector('a.on');
  if (!ind) return;
  ind.hidden = !on;
  if (!on) return;
  const set = p => {
    ind.style.left = p.left + 'px';
    ind.style.width = p.width + 'px';
  };
  const now = { left: on.offsetLeft, width: on.offsetWidth };
  if (indPos && !ind.dataset.ready) {
    set(indPos); // nouvelle barre : on repart de l'ancienne position pour glisser
    ind.getBoundingClientRect();
  }
  ind.style.transition =
    indPos && ind.dataset.ready
      ? 'left 0.28s cubic-bezier(0.3, 0.8, 0.3, 1), width 0.28s cubic-bezier(0.3, 0.8, 0.3, 1)'
      : 'none';
  ind.dataset.ready = '1';
  if (indPos && ind.style.transition === 'none') {
    requestAnimationFrame(() => {
      ind.style.transition = 'left 0.28s cubic-bezier(0.3, 0.8, 0.3, 1), width 0.28s cubic-bezier(0.3, 0.8, 0.3, 1)';
      set(now);
    });
  } else set(now);
  indPos = now;
}
// Les pastilles de la barre du bas changent de largeur quand les compteurs arrivent : on recale l'indicateur.
document.addEventListener('labo:counts', moveIndicator);

function show() {
  loadCounts();
  const el = app.querySelector('main'),
    [page, id, sub] = route();
  if (!el) return;
  app.dataset.page = page || '';
  const live = tabs.consumeSkip(); // onglet remis vivant par le balayage : rien à redessiner
  const cur = ['compte', 'nouvelles', 'mes', 'terminees', 'recherche', 'parametres'].includes(page) ? '#' + page : '';
  app.querySelectorAll('.tnav a, .tabbar a, .who a').forEach(a => a.classList.toggle('on', a.hash === cur));
  moveIndicator();
  const pt = app.querySelector('.ptit');
  if (pt) pt.textContent = titleOf(page);
  if (live) return;
  if (['terminees', 'recherche', 'parametres'].includes(page) && S.me.role === 'client') {
    location.hash = '';
    return;
  }
  if (page === 'parametres') {
    if (S.me.real !== 'admin') {
      location.hash = '';
      return;
    }
    return renderSettings(el);
  }
  if (page === 'compte') return renderMe(el);
  if (page === 'nouvelle') return renderForm(el);
  if (page === 'i') {
    if (S.me.role === 'client') {
      location.hash = '';
      return;
    }
    return sub === 'modifier' ? renderForm(el, id) : renderDetail(el, id);
  }
  renderList(el);
}

const tabs = initTabs({ app }); // doit être enregistré AVANT l'écouteur ci-dessous
const LISTS = ['', 'nouvelles', 'mes'];
// Entre deux onglets de liste, seul le contenu change (pas de reconstruction de l'en-tête ni de la barre du bas).
addEventListener('hashchange', e => {
  const from = (e.oldURL.split('#')[1] || '').split('/')[0];
  if (S.me && app.querySelector('main') && LISTS.includes(from) && LISTS.includes(route()[0])) return show();
  render();
});
addEventListener('labo:render', () => {
  tabs.reset();
  render();
});
render();
