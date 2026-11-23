import { sb } from './sb.js?v=1795462919';

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
    const { data: m, error } = await sb.from('members').select('full_name, role, acting_role, org_id').eq('user_id', session.user.id).maybeSingle();
    if (error) return renderLogin(error.message);
    me = { id: session.user.id, email: session.user.email, full_name: m?.full_name, org_id: m?.org_id, role: m?.role === 'admin' && m.acting_role ? m.acting_role : m?.role };
  }
  const [route, id, sub] = location.hash.slice(1).split('/');
  app.innerHTML = `<nav><a href="#">Interventions</a> · <a href="#nouvelle">Nouvelle intervention</a> · <a href="#compte">Mon compte</a></nav><main></main>`;
  const el = app.querySelector('main');
  route === 'compte' ? renderMe(el) : route === 'nouvelle' ? renderForm(el)
    : route === 'i' ? (sub === 'modifier' ? renderForm(el, id) : renderDetail(el, id)) : renderList(el);
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

// Actions possibles selon le rôle et le statut (mêmes règles que l'app main, lot 408).
function actions(i) {
  const r = me.role, mgr = ['admin', 'directeur', 'responsable_tech'].includes(r), mine = i.assignee_id === me.id, tech = ['technicien', 'responsable_tech'].includes(r);
  const a = [];
  if (i.status === 'brouillon' && (mgr || (['reception', 'technicien'].includes(r) && i.created_by === me.id))) a.push(['publier', 'Publier']);
  if (i.status === 'publiee' && tech && !i.assignee_id && (!i.proposed_to || i.proposed_to === me.id)) a.push(['prendre', "Commencer l'intervention"]);
  if (i.status === 'prise_en_charge' && (mine || ['directeur', 'responsable_tech'].includes(r))) a.push(['resoudre', "Terminer l'intervention"]);
  if (i.status === 'prise_en_charge' && mine) a.push(['liberer', "Ne plus prendre l'intervention"]);
  if (i.status === 'prise_en_charge' && tech && i.assignee_id && !mine) a.push(['demander', "Demander l'intervention"]);
  if (DONE.includes(i.status) && (mgr || mine)) a.push(['renvoyer', 'Renvoyer active']);
  return a;
}

// Modifiable par l'auteur, ou pour une programmée par l'assigné et les managers, tant que personne ne l'a prise.
const canEdit = i => (i.created_by === me.id || (!!i.available_from && (i.proposed_to === me.id || ['admin', 'directeur', 'responsable_tech'].includes(me.role))))
  && ['brouillon', 'publiee'].includes(i.status) && !i.assignee_id;

async function renderForm(el, id) {
  const [cur, places, techs] = await Promise.all([
    id ? sb.from('interventions').select('*').eq('id', id).maybeSingle() : { data: { priority: 'normale' } },
    sb.from('places').select('label').order('num', { nullsFirst: false }).order('label').limit(2000),
    sb.from('members').select('user_id, full_name, role').in('role', me.role === 'directeur' ? ['technicien', 'responsable_tech'] : ['technicien']),
  ]);
  const i = cur.data;
  if (!i) return el.innerHTML = `<p>${esc(cur.error?.message || 'Intervention introuvable.')}</p>`;
  const mgr = ['admin', 'directeur', 'responsable_tech'].includes(me.role);
  const from = i.available_from ? new Date(i.available_from) : null, until = i.available_until ? new Date(i.available_until) : null;
  const day = d => d ? d.toLocaleDateString('sv') : '', hm = d => d ? d.toTimeString().slice(0, 5) : '';
  el.innerHTML = `
    <h1>${id ? "Modifier l'intervention" : 'Nouvelle intervention'}</h1>
    <form>
      <p><label>Titre <input name="title" required maxlength="70" value="${esc(i.title)}"></label></p>
      <p><label>Lieu <input name="location" list="places" value="${esc(i.location)}"></label>
        <datalist id="places">${(places.data || []).map(p => `<option value="${esc(p.label)}">`).join('')}</datalist></p>
      <p><label>Description <textarea name="description">${esc(i.description)}</textarea></label></p>
      <fieldset><legend>Priorité</legend>${Object.entries(PRIORITY).map(([k, v]) =>
        `<label><input type="radio" name="priority" value="${k}" ${k === i.priority ? 'checked' : ''}> ${v}</label>`).join(' ')}</fieldset>
      ${mgr ? `<p><label>Assigner à <select name="assign"><option value="">Personne</option>${(techs.data || []).map(t =>
        `<option value="${t.user_id}" ${t.user_id === i.proposed_to ? 'selected' : ''}>${esc(t.full_name)}</option>`).join('')}</select></label></p>` : ''}
      <fieldset><legend>Passage</legend>
        <label><input type="checkbox" name="presence" ${i.client_presence || from ? 'checked' : ''}> Présence client requise</label>
        <label>Jour <input type="date" name="d" value="${day(from)}"></label>
        <label>De <input type="time" name="a" step="900" value="${hm(from)}"></label>
        <label>À <input type="time" name="b" step="900" value="${hm(until)}"></label>
      </fieldset>
      ${id ? '<button value="save">Enregistrer</button>' : '<button value="draft">Brouillon</button> <button value="publier">Créer et publier</button>'}
      <p id="ferr"></p>
    </form>`;
  el.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target)), err = el.querySelector('#ferr');
    const row = { title: f.title.trim(), location: f.location.trim(), description: f.description.trim(), priority: f.priority,
      client_presence: !!f.presence, available_from: null, available_until: null };
    if (f.presence && f.d && f.a) {
      if (f.b && f.b <= f.a) return err.textContent = "L'heure de fin doit suivre l'heure de début.";
      row.available_from = new Date(`${f.d}T${f.a}`).toISOString();
      if (!id && new Date(row.available_from) < Date.now() - 6e4) return err.textContent = 'Ce créneau est déjà passé.';
      row.available_until = new Date(f.b ? `${f.d}T${f.b}` : new Date(row.available_from).getTime() + 9e5).toISOString(); // fin par défaut : début + 15 min
    }
    const mode = e.submitter?.value, who = f.assign || null;
    const run = async () => {
      if (id) {
        let r = await sb.from('interventions').update(row).eq('id', id);
        if (!r.error && mgr && who !== (i.proposed_to || null)) r = await sb.rpc('assign_tech', { p_id: id, p_tech: who });
        return [r.error, id];
      }
      const { data, error } = await sb.from('interventions').insert({ ...row, org_id: me.org_id }).select('id').single();
      if (error || mode !== 'publier') return [error, data?.id];
      let r = await sb.rpc('transition', { p_id: data.id, p_action: 'publier', p_comment: '' });
      if (!r.error && who) r = await sb.rpc('assign_tech', { p_id: data.id, p_tech: who });
      return [r.error, data.id];
    };
    const [error, iid] = await run();
    error ? err.textContent = error.message : location.hash = `i/${iid}`;
  };
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
  const acts = actions(i);
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
      ${canEdit(i) ? `<p><a href="#i/${i.id}/modifier">Modifier</a></p>` : ''}
      ${acts.length ? `<p>${acts.map(([a, l]) => `<button data-act="${a}">${l}</button>`).join(' ')}</p><p id="acterr"></p>` : ''}
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
  el.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
    const { error } = b.dataset.act === 'demander' ? await sb.rpc('request_transfer', { p_id: id })
      : await sb.rpc('transition', { p_id: id, p_action: b.dataset.act, p_comment: '' });
    error ? el.querySelector('#acterr').textContent = error.message : renderDetail(el, id);
  });
  el.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const { error } = await sb.rpc('add_comment', { p_id: id, p_body: e.target.body.value });
    error ? e.target.querySelector('p').textContent = error.message : renderDetail(el, id);
  };
}

addEventListener('hashchange', render);
render();
