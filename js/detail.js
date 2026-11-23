import { sb } from './sb.js?v=20261123215029';
import { S, esc, fmt, DONE, STATUS, PRIORITY, REMIND, MGR, TECH } from './state.js?v=20261123215029';
import { uploadPhotos } from './form.js?v=20261123215029';
import { drawEdit } from './lock.js?v=20261123215029';

// Actions possibles selon le rôle et le statut (mêmes règles que l'app main, lot 408).
function actions(i) {
  const r = S.me.role, mgr = MGR.includes(r), mine = i.assignee_id === S.me.id, tech = TECH.includes(r);
  const a = [];
  if (i.status === 'brouillon' && (mgr || (['reception', 'technicien'].includes(r) && i.created_by === S.me.id))) a.push(['publier', 'Publier']);
  if (i.status === 'publiee' && tech && !i.assignee_id && (!i.proposed_to || i.proposed_to === S.me.id)) a.push(['prendre', "Commencer l'intervention"]);
  if (i.status === 'prise_en_charge' && (mine || ['directeur', 'responsable_tech'].includes(r))) a.push(['resoudre', "Terminer l'intervention"]);
  if (i.status === 'prise_en_charge' && mine) a.push(['liberer', "Ne plus prendre l'intervention"]);
  if (i.status === 'prise_en_charge' && tech && i.assignee_id && !mine) a.push(['demander', "Demander l'intervention"]);
  if (DONE.includes(i.status) && (mgr || mine)) a.push(['renvoyer', 'Renvoyer active']);
  return a;
}

// Modifiable par l'auteur, ou pour une programmée par l'assigné et les managers, tant que personne ne l'a prise.
const canEdit = i => (i.created_by === S.me.id || (!!i.available_from && (i.proposed_to === S.me.id || MGR.includes(S.me.role))))
  && ['brouillon', 'publiee'].includes(i.status) && !i.assignee_id;
// Clôture pour quelqu'un d'autre : directeur et responsable tech, sur une nouvelle non prise.
const canClose = i => ['directeur', 'responsable_tech'].includes(S.me.role) && i.status === 'publiee' && !i.assignee_id;

// Liens signés des photos : chemin → URL.
async function signedUrls(paths) {
  if (!paths.length) return {};
  const { data } = await sb.storage.from('photos').createSignedUrls(paths, 3600);
  return Object.fromEntries((data || []).map(d => [d.path, d.signedUrl]));
}

export async function renderDetail(el, id) {
  el.innerHTML = '<p>Chargement…</p>';
  const [{ data: i, error }, ev, ph] = await Promise.all([
    sb.from('interventions').select('*').eq('id', id).maybeSingle(),
    sb.from('intervention_events').select('type, body, actor_name, created_at').eq('intervention_id', id).order('created_at').order('id'),
    sb.from('intervention_photos').select('path, uploaded_by').eq('intervention_id', id).order('created_at'),
  ]);
  if (error || !i) return el.innerHTML = `<p>${esc(error?.message || 'Intervention introuvable.')}</p>`;
  const photos = ph.data || [], urls = await signedUrls(photos.map(p => p.path));
  const img = path => urls[path] ? `<a class="photo" href="${urls[path]}"><img src="${urls[path]}" alt="Photo"></a>` : '';
  const events = ev.data || [], chat = S.me.role !== 'client'; // le client n'a pas de tchat : ses photos s'affichent à part
  const acts = actions(i), mgr = MGR.includes(S.me.role);
  const line = e => `<li class="msg"><span class="msg__who"><b>${esc(e.actor_name)}</b><time>${fmt(e.created_at)}</time></span>${e.type === 'photo' ? img(e.body) : `<p>${esc(e.body)}</p>`}</li>`;
  const closers = S.team.filter(m => TECH.includes(m.role));
  el.innerHTML = `
    <article class="detail">
      <header class="detail__head"><h1>${esc(i.title)}</h1><span class="tag tag--${i.priority}">${PRIORITY[i.priority] || ''}</span><span class="tag">${STATUS[i.status] || esc(i.status)}</span></header>
      <section class="panel"><dl class="facts">
        <dt>Lieu</dt><dd>${esc(i.location) || '—'}</dd>
        <dt>Créée le</dt><dd>${fmt(i.created_at)}</dd>
        ${i.available_from ? `<dt>Créneau</dt><dd>${fmt(i.available_from)} – ${fmt(i.available_until)}</dd>` : ''}
        ${i.remind_minutes ? `<dt>Rappel</dt><dd>${REMIND[i.remind_minutes] || `${i.remind_minutes} min avant`}</dd>` : ''}
      </dl>
      <p class="desc">${esc(i.description) || 'Pas de description.'}</p></section>
      ${canEdit(i) ? `<p id="edit" data-id="${i.id}"></p>` : ''}
      ${acts.length || mgr ? `<p class="actions">${acts.map(([a, l]) => `<button class="primary" data-act="${a}">${l}</button>`).join(' ')} ${mgr ? '<button class="danger" id="del">Supprimer</button>' : ''}</p>` : ''}
      ${canClose(i) ? `<details class="panel"><summary>Clôturer</summary><form id="close">
        <label>Qui a fait l'intervention ? <select name="tech">${closers.map(m => `<option value="${m.user_id}">${esc(m.full_name)}</option>`).join('')}<option value="">Quelqu'un d'autre</option></select></label>
        <label>Nom de la personne <input name="other"></label> <button>Clôturer</button></form></details>` : ''}
      <p class="error" id="acterr"></p>
      ${!chat && photos.length ? `<section class="panel"><h2>Photos</h2><div class="photos">${photos.map(p => img(p.path)).join('')}</div></section>` : ''}
      ${chat ? `<section class="panel chat">
        <h2>Tchat</h2>
        <ul class="msgs">${events.filter(e => ['commentaire', 'photo'].includes(e.type)).map(line).join('') || '<li class="empty">Aucun message.</li>'}</ul>
        <form class="chat__form" id="chat"><textarea name="body" maxlength="2000"></textarea>
          <label>Photos <input type="file" name="photos" accept="image/*" multiple></label> <button class="primary">Envoyer</button><p class="error"></p></form>
      </section>` : ''}
      <section class="panel">
        <h2>Historique</h2>
        <ul class="history">${events.filter(e => !['commentaire', 'photo'].includes(e.type)).map(e => `<li>${fmt(e.created_at)} · ${esc(e.type)} · ${esc(e.actor_name)}${e.body ? ` · ${esc(e.body)}` : ''}</li>`).join('') || '<li class="empty">Aucun événement.</li>'}</ul>
      </section>
    </article>`;
  drawEdit();
  const fail = error => error && (el.querySelector('#acterr').textContent = error.message);
  el.querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
    const { error } = b.dataset.act === 'demander' ? await sb.rpc('request_transfer', { p_id: id })
      : await sb.rpc('transition', { p_id: id, p_action: b.dataset.act, p_comment: '' });
    fail(error) || renderDetail(el, id);
  });
  const del = el.querySelector('#del');
  if (del) del.onclick = async () => {
    if (!confirm('Supprimer cette intervention ?')) return;
    // Photos du stockage d'abord, puis la ligne (qui emporte photos, tchat et historique).
    const r = photos.length ? await sb.storage.from('photos').remove(photos.map(p => p.path)) : {};
    const { error } = r.error ? r : await sb.from('interventions').delete().eq('id', id);
    fail(error) || (location.hash = '');
  };
  const close = el.querySelector('#close');
  if (close) close.onsubmit = async e => {
    e.preventDefault();
    const tech = e.target.tech.value || null;
    const { error } = await sb.rpc('close_for', { p_id: id, p_tech: tech, p_other: tech ? null : e.target.other.value.trim() });
    fail(error) || renderDetail(el, id);
  };
  if (!chat) return;
  // Tchat ouvert = lu (sans message d'erreur : le labo refuse l'écriture).
  sb.from('intervention_reads').upsert({ user_id: S.me.id, intervention_id: id, last_read_at: new Date().toISOString() }).then(() => {});
  el.querySelector('#chat').onsubmit = async e => {
    e.preventDefault();
    const body = e.target.body.value.trim(), files = [...e.target.photos.files], out = e.target.querySelector('p');
    if (!body && !files.length) return out.textContent = 'Le message est vide.';
    if (files.length > 10 - photos.filter(p => p.uploaded_by === S.me.id).length) return out.textContent = '10 photos maximum par intervention.';
    let error = body && (await sb.rpc('add_comment', { p_id: id, p_body: body })).error;
    if (!error && files.length) error = await uploadPhotos(id, files);
    error ? out.textContent = error.message : renderDetail(el, id);
  };
}
