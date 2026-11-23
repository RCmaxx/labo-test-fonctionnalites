import { sb } from './sb.js';

const ACCOUNTS = ['admin.a', 'resp.a', 'tech.a', 'tech.bis', 'client'];
const ROLES = { admin: 'Admin', directeur: 'Directeur', responsable_tech: 'Responsable tech', technicien: 'Technicien', reception: 'Réception', client: 'Client' };
const PRIORITY = { basse: 'Basse', normale: 'Normale', haute: 'Haute', urgente: 'Urgente' };
const DONE = ['resolue', 'validee'];
const STATUS = { brouillon: 'Brouillon', publiee: 'Nouvelle', prise_en_charge: 'En cours', resolue: 'Terminée', validee: 'Validée' };
const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);
const fmt = d => d ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '';
let me = null; // { id, email, full_name, role }

async function render() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return renderLogin();
  if (!me) {
    const { data: m, error } = await sb.from('members').select('full_name, role, acting_role').eq('user_id', session.user.id).maybeSingle();
    if (error) return renderLogin(error.message);
    me = { id: session.user.id, email: session.user.email, full_name: m?.full_name, role: m?.role === 'admin' && m.acting_role ? m.acting_role : m?.role };
  }
  const [route, id] = location.hash.slice(1).split('/');
  app.innerHTML = `<nav><a href="#">Interventions</a> · <a href="#compte">Mon compte</a></nav><main></main>`;
  const el = app.querySelector('main');
  route === 'compte' ? renderMe(el) : route === 'i' ? renderDetail(el, id) : renderList(el);
}

function renderLogin(error = '') {
  app.innerHTML = `
    <h1>Connexion</h1>
    <form id="login">
      <label>Compte <select name="email">${ACCOUNTS.map(a => `<option value="${a}@test.local">${a}</option>`).join('')}</select></label>
      <label>Mot de passe <input name="password" type="password" required autocomplete="current-password"></label>
      <button>Se connecter</button>
      <p>${esc(error)}</p>
    </form>`;
  app.querySelector('#login').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.auth.signInWithPassword(Object.fromEntries(new FormData(e.target)));
    error ? renderLogin(error.message) : render();
  };
}

function renderMe(el) {
  el.innerHTML = `
    <h1>Mon compte</h1>
    <p>Nom : ${esc(me.full_name) || '—'}</p>
    <p>E-mail : ${esc(me.email)}</p>
    <p>Rôle : ${esc(ROLES[me.role] || me.role || 'aucun')}</p>
    <button>Se déconnecter</button>`;
  el.querySelector('button').onclick = async () => { await sb.auth.signOut(); me = null; location.hash = ''; render(); };
}

async function renderList(el) {
  el.innerHTML = '<h1>Interventions</h1><p>Chargement…</p>';
  const cols = 'id, title, location, status, priority, assignee_id, created_by, created_at, resolved_at, validated_at';
  const scope = q => me.role === 'client' ? q.eq('created_by', me.id) : q;
  const [open, done, names] = await Promise.all([
    scope(sb.from('interventions').select(cols).not('status', 'in', `(${DONE})`)).order('created_at', { ascending: false }),
    scope(sb.from('interventions').select(cols).in('status', DONE)).order('resolved_at', { ascending: false, nullsFirst: false }).limit(50),
    sb.from('members').select('user_id, full_name'),
  ]);
  const err = open.error || done.error;
  if (err) return el.innerHTML = `<h1>Interventions</h1><p>${esc(err.message)}</p>`;
  const who = Object.fromEntries((names.data || []).map(m => [m.user_id, m.full_name]));
  const rows = open.data;
  const groups = [
    ['Brouillons', rows.filter(r => r.status === 'brouillon' && (me.role !== 'technicien' || r.created_by === me.id))],
    ['Mes interventions', rows.filter(r => r.status === 'prise_en_charge' && r.assignee_id === me.id)],
    ['Nouvelles interventions', rows.filter(r => r.status === 'publiee')],
    ['En cours', rows.filter(r => r.status === 'prise_en_charge' && r.assignee_id !== me.id)],
    ['Terminées', done.data],
  ];
  const item = r => `<li>
      <a href="#i/${r.id}"><b>${esc(r.title)}</b></a> · ${esc(r.location) || 'sans lieu'} · ${PRIORITY[r.priority] || ''}
      · ${r.assignee_id ? esc(who[r.assignee_id] || 'Technicien') : 'Non assignée'}
      · ${fmt(DONE.includes(r.status) ? r.resolved_at || r.validated_at : r.created_at)}
    </li>`;
  el.innerHTML = '<h1>Interventions</h1>' + groups.map(([t, list]) =>
    `<h2>${t} (${list.length})</h2>${list.length ? `<ul>${list.map(item).join('')}</ul>` : '<p>Aucune.</p>'}`).join('');
}

async function renderDetail(el, id) {
  el.innerHTML = '<p>Chargement…</p>';
  const [{ data: i, error }, ev, ph] = await Promise.all([
    sb.from('interventions').select('*').eq('id', id).maybeSingle(),
    sb.from('intervention_events').select('type, body, actor_name, created_at').eq('intervention_id', id).order('created_at').order('id'),
    sb.from('intervention_photos').select('path').eq('intervention_id', id).order('created_at'),
  ]);
  if (error || !i) return el.innerHTML = `<p>${esc(error?.message || 'Intervention introuvable.')}</p>`;
  const paths = (ph.data || []).map(p => p.path);
  const urls = paths.length ? (await sb.storage.from('photos').createSignedUrls(paths, 3600)).data || [] : [];
  const events = ev.data || [];
  const line = e => `<li><b>${esc(e.actor_name)}</b> · ${fmt(e.created_at)}<br>${esc(e.body)}</li>`;
  el.innerHTML = `
    <article>
      <h1>${esc(i.title)}</h1>
      <dl>
        <dt>Statut</dt><dd>${STATUS[i.status] || esc(i.status)}</dd>
        <dt>Priorité</dt><dd>${PRIORITY[i.priority] || ''}</dd>
        <dt>Lieu</dt><dd>${esc(i.location) || '—'}</dd>
        <dt>Créée le</dt><dd>${fmt(i.created_at)}</dd>
        ${i.available_from ? `<dt>Créneau</dt><dd>${fmt(i.available_from)} – ${fmt(i.available_until)}</dd>` : ''}
      </dl>
      <p>${esc(i.description) || 'Pas de description.'}</p>
      ${urls.length ? `<section><h2>Photos</h2>${urls.map(u => u.signedUrl ? `<img src="${u.signedUrl}" alt="" width="160">` : '').join('')}</section>` : ''}
      <section>
        <h2>Tchat</h2>
        <ul>${events.filter(e => e.type === 'commentaire').map(line).join('') || '<li>Aucun message.</li>'}</ul>
        <form><textarea name="body" required></textarea><button>Envoyer</button><p></p></form>
      </section>
      <section>
        <h2>Historique</h2>
        <ul>${events.filter(e => e.type !== 'commentaire').map(e => `<li>${fmt(e.created_at)} · ${esc(e.type)} · ${esc(e.actor_name)}</li>`).join('') || '<li>Aucun événement.</li>'}</ul>
      </section>
    </article>`;
  el.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.rpc('add_comment', { p_id: id, p_body: e.target.body.value });
    error ? e.target.querySelector('p').textContent = error.message : renderDetail(el, id);
  };
}

addEventListener('hashchange', render);
render();
