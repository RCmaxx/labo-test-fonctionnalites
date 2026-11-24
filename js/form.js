import { sb } from './sb.js';
import { S, esc, REMIND, MGR, TECH } from './state.js';
import { takeLock } from './lock.js';

const PRIO_L = { basse: 'À faire', normale: 'Important', haute: 'Urgent', urgente: 'Urgente' };
const COMMON = ['Réception', 'Camp saisonnier', 'Sanitaire 1', 'Sanitaire 2', 'Scène', 'Restaurant', 'Bar', 'Piscine', 'Aire de jeux', 'Parking', 'Local technique', 'Laverie', 'Épicerie', 'Snack', 'Spa', 'Salle de sport', 'Terrain multisport', 'Mini-golf', 'Accueil', 'Entrée / barrière', 'Lingerie', 'Cuisine du restaurant', 'Salle commune'];
const WRENCH = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
const BRIEFCASE = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>';
const BACK = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
const CLOSE = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
const CLOCK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
const PIN = '<svg class="pin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-4.8 7-11a7 7 0 1 0-14 0c0 6.2 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>';
const DCHEV = '<svg class="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5L6 8L9.5 4.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
const padMH = s => String(s).replace(/^((?:mh|mobil[- ]?home)\s*)(\d)\s*$/i, (_, a, d) => a + '0' + d);
const p2 = n => String(n).padStart(2, '0');
const dIn = v => { const x = v ? new Date(v) : new Date(); return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`; };
const tIn = v => { if (!v) return ''; const x = new Date(v); return `${p2(x.getHours())}:${p2(x.getMinutes())}`; };
const mhN = v => (String(v).trim().match(/^(?:mh|mobil[- ]?home)?\s*(\d+)$/i) || [])[1];
const tagIn = v => { const n = mhN(v); return n ? `<span class="mhpre">MH</span><span class="mhnum">${esc(String(n).padStart(2, '0'))}</span>` : `${PIN}<span class="ltx">${esc(v)}</span>`; };
const canDraft = r => MGR.includes(r) || r === 'technicien' || r === 'client';
const hostModal = () => document.querySelector('.sim #app') || document.body;

// Réduit la photo (1600 px max, JPEG ~0,8) pour un envoi plus léger ; garde l'original si la conversion échoue ou n'apporte rien.
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
    bmp.close?.();
    return b && b.size < file.size ? b : file;
  } catch { return file; }
}

// Envoie les photos dans le stockage puis les rattache à l'intervention (un message photo s'ajoute au tchat). Renvoie la première erreur.
export async function uploadPhotos(iid, files) {
  for (const file of files) {
    const f = await shrink(file);
    const ext = f === file ? ((file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg') : 'jpg';
    const path = `${S.me.org_id}/${iid}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage.from('photos').upload(path, f, { contentType: f.type || 'image/jpeg' })
      .then(r => r.error ? r : sb.from('intervention_photos').insert({ intervention_id: iid, path }));
    if (error) return error;
  }
}

function zoomImg(src) {
  const o = document.createElement('div');
  o.className = 'phbig';
  o.innerHTML = `<img src="${src}" alt="Photo">`;
  o.onclick = () => o.remove();
  hostModal().append(o);
}

function modal(html, on) {
  const o = document.createElement('div');
  o.className = 'modal';
  o.innerHTML = `<div class="mbox">${html}</div>`;
  hostModal().append(o);
  o.onclick = e => {
    const b = e.target.closest('button');
    if (!b) { if (e.target === o) on(o, null); return; }
    on(o, b);
  };
  return o;
}

function askReminder() {
  return new Promise(res => {
    modal(`<p class="mq">Programmer un rappel ?</p><div class="mbtns"><button type="button" class="ghost" data-r="non">Non</button><button type="button" class="primary" data-r="oui">Oui</button></div>`, (o, b) => {
      if (!b || b.dataset.r === 'non') { o.remove(); return res(null); }
      if (b.dataset.r === 'oui') {
        o.querySelector('.mbox').innerHTML = `<p class="mq">Combien de temps avant l'intervention ?</p><div class="mlist">${Object.entries(REMIND).map(([m, l]) => `<button type="button" class="ghost" data-m="${m}">${l}</button>`).join('')}</div>`;
        return;
      }
      if (b.dataset.m) { o.remove(); res(+b.dataset.m); }
    });
  });
}

function quitBox(draft) {
  return new Promise(res => {
    modal(`<p class="mq">Voulez-vous quitter la création d'une nouvelle intervention ?</p><div class="mbtns mb3">${draft ? '<button type="button" class="primary" data-r="draft">Enregistrer en brouillon</button>' : ''}<button type="button" class="ghost" data-r="quit">Quitter sans enregistrer</button><button type="button" class="ghost" data-r="">Annuler</button></div>`, (o, b) => {
      o.remove();
      res(b?.dataset.r || '');
    });
  });
}

export function photoTray(input, tray, onChange, max = 10) {
  const files = [];
  const draw = () => {
    tray.querySelectorAll('img').forEach(i => URL.revokeObjectURL(i.src));
    tray.innerHTML = files.map((f, i) => `<span class="pt"><img src="${URL.createObjectURL(f)}" alt=""><button type="button" class="pt-x" data-i="${i}" aria-label="Retirer la photo">×</button></span>`).join('');
    onChange(files);
  };
  input.addEventListener('change', () => {
    const room = Math.max(0, max - files.length);
    if (input.files.length > room) { const fe = tray.closest('form')?.querySelector('#ferr') || document.querySelector('#acterr'); if (fe) fe.textContent = '10 photos maximum par intervention.'; }
    files.push(...[...input.files].slice(0, room));
    input.value = '';
    draw();
  });
  tray.addEventListener('click', e => {
    const x = e.target.closest('.pt-x');
    if (x) { if (confirm('Supprimer ?')) { files.splice(+x.dataset.i, 1); draw(); } return; }
    const img = e.target.closest('.pt img');
    if (img) zoomImg(img.src);
  });
  return files;
}

export async function renderForm(el, id) {
  // Verrou d'édition : une seule personne modifie à la fois.
  const by = id && await takeLock(id);
  if (by) return el.innerHTML = `<p>${esc(by)}</p>`;
  const [cur, placesRes, techs] = await Promise.all([
    id ? sb.from('interventions').select('*').eq('id', id).maybeSingle() : { data: { priority: 'normale' } },
    sb.from('places').select('label, num').order('num', { nullsFirst: false }).order('label').limit(2000),
    sb.from('members').select('user_id, full_name, role').in('role', S.me.role === 'directeur' ? TECH : ['technicien']),
  ]);
  const i = cur.data;
  if (!i) return el.innerHTML = `<p>${esc(cur.error?.message || 'Intervention introuvable.')}</p>`;
  const r = S.me.role, mgr = MGR.includes(r);
  const backHref = id ? (i.status === 'brouillon' ? '#' : `#i/${id}`) : '#';
  const canAssign = mgr && (!id || (i.status === 'publiee' && !i.assignee_id));
  const slotOn = !!(i.available_from || i.client_presence);
  const from = i.available_from ? new Date(i.available_from) : null, until = i.available_until ? new Date(i.available_until) : null;
  const draftOk = !id && canDraft(r);
  el.innerHTML = `
    <div class="fpage">
      <div class="fhead">${id ? `<a href="${backHref}" class="back" aria-label="Retour">${BACK}</a>` : ''}<h1>${id ? "Modifier l'intervention" : 'Nouvelle intervention'}</h1>${id ? '' : `<button type="button" class="fx" aria-label="Fermer">${CLOSE}</button>`}</div>
      <form id="f" class="nform" autocomplete="off" data-prio="${i.priority || 'normale'}">
        <div class="nf-row">
          <div class="nf"><input name="title" type="text" maxlength="70" required placeholder="${r === 'client' ? "Titre de l'intervention" : 'Titre'}" value="${esc(i.title)}"></div>
          <div class="nf ac"><input name="location" type="text" maxlength="80" placeholder="Lieu" value="${esc(i.location)}" aria-autocomplete="list" aria-expanded="false" autocorrect="off" spellcheck="false"><ul class="ac-list" role="listbox" hidden></ul></div>
        </div>
        <fieldset class="seg"><legend>Priorité</legend>${Object.entries(PRIO_L).map(([k, v]) =>
          `<label class="p-${k}"><input type="radio" name="priority" value="${k}" ${k === i.priority ? 'checked' : ''}><span>${v}</span></label>`).join('')}</fieldset>
        ${canAssign ? `<fieldset class="assign"><legend>Assigner à un technicien</legend>${(techs.data || []).map(t =>
          `<label><input type="checkbox" name="assign" value="${t.user_id}" ${i.proposed_to === t.user_id ? 'checked' : ''}><span class="cwho">${t.role === 'technicien' ? WRENCH : BRIEFCASE}<span>${esc(t.full_name)}</span></span></label>`).join('')}</fieldset>` : ''}
        <fieldset id="hp"${slotOn ? ' class="on"' : ''}><legend class="sr">Passage</legend>
          <input type="radio" name="passage" value="now" ${slotOn ? '' : 'checked'}>
          <input type="radio" name="passage" value="slot" ${slotOn ? 'checked' : ''}>
          <span class="hptx">Présence client requise</span>
          <button type="button" class="hpsw2" role="switch" aria-checked="${slotOn}" aria-label="Présence client requise"></button>
          <span class="hpcr"><button type="button" class="hpclk" aria-label="Choisir le créneau" ${slotOn ? '' : 'disabled'}>${CLOCK}</button><span class="hpv"></span></span>
        </fieldset>
        <div class="nf slot" ${slotOn ? '' : 'hidden'}>
          <label>Jour <input type="date" name="slot_d" value="${from ? dIn(from) : dIn()}"></label>
          <label>De <input type="time" name="slot_a" step="900" value="${tIn(from)}"></label>
          <label>À <input type="time" name="slot_b" step="900" value="${tIn(until)}"></label>
        </div>
        <div class="nf"><textarea name="description" rows="6" placeholder="${r === 'client' ? 'Décrivez votre demande en quelques lignes' : 'Description'}">${esc(i.description)}</textarea></div>
        <div class="nph">Photos
          <div class="pstrip"><div class="ptray"></div><label class="padd" aria-label="Ajouter des photos"><input name="photos" type="file" accept="image/*" multiple><span>+</span></label></div>
        </div>
        <div class="nactions">
          <button type="submit" class="primary" value="${id ? 'save' : 'publier'}">${id ? 'Enregistrer' : 'Créer et publier'}</button>
          ${draftOk ? `<span class="bdwrap"><button type="submit" class="ghost" value="brouillon" hidden tabindex="-1"></button><button type="button" class="ghost bdchev" aria-haspopup="menu" aria-expanded="false" aria-label="Brouillons"></button><button type="button" class="ghost bdsave">Brouillon +</button></span>` : ''}
          ${id && i.status === 'brouillon' ? '<button type="button" class="ghost danger bddel-form">Supprimer</button>' : ''}
          <a class="btn ghost" href="${backHref}">Annuler</a>
        </div>
        <p class="error" id="ferr"></p>
      </form>
    </div>`;

  const f = el.querySelector('#f'), err = el.querySelector('#ferr');
  const loc = f.location, ul = f.querySelector('.ac-list');
  let places = placesRes.data || [];

  f.querySelectorAll('[name=priority]').forEach(p => p.addEventListener('change', () => f.dataset.prio = p.value));
  f.querySelectorAll('[name=assign]').forEach(c => c.addEventListener('change', () => { if (c.checked) f.querySelectorAll('[name=assign]').forEach(o => { if (o !== c) o.checked = false; }); }));

  const ltag = document.createElement('span'); ltag.className = 'loc-tag'; loc.after(ltag);
  const syncTag = () => {
    const v = loc.value.trim(), on = !!v && document.activeElement !== loc;
    ltag.innerHTML = `${tagIn(v)}<button type="button" class="lx" aria-label="Retirer le lieu">×</button>`;
    ltag.classList.toggle('stacked', !!mhN(v));
    ltag.classList.toggle('ptag', !mhN(v));
    ltag.hidden = !on;
    loc.classList.toggle('tagged', on);
    if (on) loc.style.setProperty('--tagw', (ltag.offsetWidth + 20) + 'px');
    else loc.style.removeProperty('--tagw');
  };
  ltag.addEventListener('click', e => {
    if (!e.target.closest('.lx')) return;
    e.preventDefault(); loc.value = ''; ltag.hidden = true; loc.classList.remove('tagged'); loc.focus(); loc.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const fromTitle = () => {
    const t = f.title.value.toLowerCase();
    if (!t) return [];
    const nums = [...t.matchAll(/(?:mh|mobil[- ]?home)?\s*(\d+)/g)].map(m => m[1]);
    const byNum = places.filter(p => p.num != null && nums.includes(String(p.num))).map(p => p.label);
    const names = [...new Set([...COMMON, ...places.filter(p => p.num == null).map(p => p.label)])];
    const byName = names.filter(l => l && (t.includes(l.toLowerCase()) || l.toLowerCase().split(/[\s'-]+/).some(w => w.length >= 4 && !/^\d+$/.test(w) && t.split(/[\s'-]+/).some(x => x.length >= 4 && (x.startsWith(w) || w.startsWith(x))))));
    return [...new Set([...byNum, ...byName])];
  };
  const closeAc = () => { ul.hidden = true; loc.setAttribute('aria-expanded', 'false'); };
  const showHits = hits => {
    ul.innerHTML = hits.map(l => `<li role="option" class="${mhN(l) ? 'lmh' : 'lpt'}" data-v="${esc(l)}">${tagIn(l)}</li>`).join('');
    ul.hidden = !hits.length;
    loc.setAttribute('aria-expanded', hits.length ? 'true' : 'false');
  };
  loc.addEventListener('focus', () => {
    if (!loc.value.trim()) { const hits = fromTitle().slice(0, 4); if (hits.length) showHits(hits); }
    syncTag();
  });
  loc.addEventListener('blur', () => setTimeout(() => { closeAc(); syncTag(); }, 150));
  loc.oninput = () => {
    const v = loc.value.trim().toLowerCase();
    if (!v) return closeAc();
    const m = v.match(/^(?:mh|mobil[- ]?home)?\s*(\d+)$/);
    let hits;
    if (m) {
      const digits = m[1];
      const rank = p => { const n = String(p.num ?? ''); return n === digits ? 0 : n.endsWith(digits) ? 1 : n.startsWith(digits) ? 2 : 3; };
      hits = places.filter(p => p.num != null && String(p.num).endsWith(digits)).sort((x, y) => rank(x) - rank(y) || x.num - y.num).map(p => padMH(p.label));
      hits = hits.slice(0, digits.length < 2 ? 3 : 4);
    } else {
      hits = [...new Set([...COMMON, ...places.filter(p => p.num == null).map(p => p.label)])]
        .filter(l => l.toLowerCase().split(/[\s'/-]+/).some(w => w.startsWith(v)) || l.toLowerCase().startsWith(v))
        .sort((x, y) => x.toLowerCase().indexOf(v) - y.toLowerCase().indexOf(v))
        .slice(0, v.length < 3 ? 3 : 5);
    }
    showHits(hits);
  };
  ul.addEventListener('mousedown', e => e.preventDefault());
  ul.addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    loc.value = li.dataset.v; closeAc(); loc.blur(); syncTag();
  });
  syncTag();

  const hp = f.querySelector('#hp'), slot = f.querySelector('.slot'), clk = f.querySelector('.hpclk'), hpv = f.querySelector('.hpv');
  const setPassage = on => {
    hp.classList.toggle('on', on);
    f.querySelector('[name=passage][value=slot]').checked = on;
    f.querySelector('[name=passage][value=now]').checked = !on;
    hp.querySelector('.hpsw2').setAttribute('aria-checked', on);
    slot.hidden = !on;
    clk.disabled = !on;
    if (on && !f.slot_d.value) f.slot_d.value = dIn();
    paintSlot();
  };
  const paintSlot = () => {
    if (!hp.classList.contains('on') || !f.slot_d.value || !f.slot_a.value) { hpv.textContent = ''; return; }
    const d = new Date(f.slot_d.value + 'T00:00'), t = new Date(); t.setHours(0, 0, 0, 0);
    const n = Math.round((d - t) / 864e5);
    const day = n === 0 ? "Aujourd'hui" : n === 1 ? 'Demain' : d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
    hpv.textContent = `${day} ${f.slot_a.value}${f.slot_b.value ? '–' + f.slot_b.value : ''}`;
  };
  hp.querySelector('.hpsw2').onclick = () => setPassage(!hp.classList.contains('on'));
  clk.onclick = () => { if (clk.disabled) return; slot.hidden = false; f.slot_d.focus(); };
  ['slot_d', 'slot_a', 'slot_b'].forEach(n => f[n].addEventListener('change', paintSlot));
  paintSlot();

  const picked = photoTray(f.photos, f.querySelector('.ptray'), files => { f.querySelector('.padd').hidden = files.length >= 10; });

  const wrap = f.querySelector('.bdwrap'), chev = wrap?.querySelector('.bdchev'), save = wrap?.querySelector('.bdsave'), db = wrap?.querySelector('[value=brouillon]');
  if (wrap && chev) {
    let rows = [];
    const paint = () => { chev.setAttribute('aria-label', 'Brouillons, ' + rows.length); chev.innerHTML = '<span class="bdcount">' + rows.length + '</span>' + DCHEV; };
    paint();
    const openDraftsMenu = () => {
      document.querySelector('.xmenu')?.remove();
      const m = document.createElement('div'); m.className = 'xmenu bdmenu';
      m.innerHTML = rows.map(x => `<div class="bdrow"><button type="button" data-id="${esc(x.id)}">${esc((x.title || '').trim().slice(0, 70) || 'Sans titre')}</button><button type="button" class="bddel" data-del="${esc(x.id)}" aria-label="Supprimer">${TRASH}</button></div>`).join('') || '<button type="button" disabled>Aucun brouillon</button>';
      hostModal().append(m);
      const r = chev.getBoundingClientRect(), box = m.offsetParent?.getBoundingClientRect() || { left: 0, top: 0, width: innerWidth, height: innerHeight };
      const h = m.offsetHeight, w = m.offsetWidth;
      m.style.left = Math.max(8, Math.min(r.right - box.left - w, box.width - w - 8)) + 'px';
      m.style.top = (r.bottom - box.top + 2 + h > box.height - 8 ? Math.max(8, r.top - box.top - 2 - h) : r.bottom - box.top + 2) + 'px';
      chev.setAttribute('aria-expanded', 'true');
      const close = () => { chev.setAttribute('aria-expanded', 'false'); m.remove(); document.removeEventListener('pointerdown', out, true); removeEventListener('scroll', close, true); };
      const out = e => { if (!m.contains(e.target) && e.target !== chev && !chev.contains(e.target) && !e.target.closest('.modal')) close(); };
      setTimeout(() => { document.addEventListener('pointerdown', out, true); addEventListener('scroll', close, true); }, 0);
      m.onclick = async e => {
        const del = e.target.closest('.bddel');
        if (del) {
          e.preventDefault(); close();
          if (!confirm('Voulez-vous vraiment supprimer ce brouillon ?')) return;
          const { error } = await sb.from('interventions').delete().eq('id', del.dataset.del);
          if (error) return err.textContent = error.message;
          rows = rows.filter(x => x.id !== del.dataset.del); paint();
          return;
        }
        const t = e.target.closest('button'); if (!t || t.disabled) return;
        close();
        if (t.dataset.id) location.hash = `i/${t.dataset.id}/modifier`;
      };
    };
    chev.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openDraftsMenu(); });
    if (save) save.addEventListener('click', e => { e.preventDefault(); if (db && !db.disabled) f.requestSubmit(db); });
    (async () => {
      let q = sb.from('interventions').select('id, title').eq('status', 'brouillon');
      if (!mgr) q = q.eq('created_by', S.me.id);
      const { data } = await q.order('created_at', { ascending: false }).limit(300);
      if (!chev.isConnected) return;
      rows = data || []; paint();
    })();
  }

  const dirty = () => !!(f.title.value.trim() || f.location.value.trim() || f.description.value.trim() || picked.length);
  let s0 = null;
  const snap = () => JSON.stringify([...new FormData(f)].filter(([k]) => k !== 'photos'));
  if (id) setTimeout(() => { s0 = snap(); }, 400);
  const canLeave = async () => {
    if (id) return s0 === null || snap() === s0 || confirm('Attention, votre modification ne sera pas enregistrée.');
    if (!dirty()) return true;
    const a = await quitBox(draftOk);
    if (a === 'draft' && db) { f.requestSubmit(db); return false; }
    return a === 'quit';
  };
  el.querySelectorAll('a.back, .nactions a.btn').forEach(a => a.addEventListener('click', async e => { if (!await canLeave()) e.preventDefault(); }));
  const fx = el.querySelector('.fx');
  if (fx) fx.onclick = async () => { if (await canLeave()) location.hash = backHref; };

  const delBtn = f.querySelector('.bddel-form');
  if (delBtn) delBtn.onclick = async () => {
    if (!confirm('Voulez-vous vraiment supprimer ce brouillon ?')) return;
    const { error } = await sb.from('interventions').delete().eq('id', id);
    if (error) return err.textContent = error.message;
    location.hash = '#';
  };

  f.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(f), mode = e.submitter?.value;
    const title = String(fd.get('title') || '').trim();
    if (!title) { err.textContent = 'Le titre est obligatoire.'; return f.title.focus(); }
    const row = {
      title: title.slice(0, 70), location: String(fd.get('location') || '').trim(), description: String(fd.get('description') || '').trim(),
      priority: fd.get('priority') || 'normale', available_from: null, available_until: null, remind_minutes: null,
      client_presence: fd.get('passage') === 'slot',
    };
    if (row.client_presence) {
      const day = f.slot_d.value, a = f.slot_a.value, b = f.slot_b.value;
      if (day && a) {
        if (b && b <= a) return err.textContent = "L'heure de fin doit suivre l'heure de début.";
        const start = new Date(`${day}T${a}`);
        if (start < (id && i.created_at ? new Date(i.created_at) : new Date(Date.now() - 6e4))) return err.textContent = 'Ce créneau est déjà passé.';
        row.available_from = start.toISOString();
        row.available_until = new Date(b ? `${day}T${b}` : start.getTime() + 9e5).toISOString();
      }
    }
    const files = [...picked];
    const who = f.querySelector('[name=assign]:checked')?.value || null;
    const run = async () => {
      if (id) {
        let res = await sb.from('interventions').update(row).eq('id', id);
        if (!res.error && canAssign && who !== (i.proposed_to || null)) res = await sb.rpc('assign_tech', { p_id: id, p_tech: who });
        return [res.error, id];
      }
      const { data, error } = await sb.from('interventions').insert({ ...row, org_id: S.me.org_id }).select('id').single();
      if (error || mode !== 'publier') return [error, data?.id];
      let res = await sb.rpc('transition', { p_id: data.id, p_action: 'publier', p_comment: '' });
      if (!res.error && who) res = await sb.rpc('assign_tech', { p_id: data.id, p_tech: who });
      return [res.error, data.id];
    };
    const btn = e.submitter; if (btn) btn.disabled = true;
    let [error, iid] = await run();
    if (!error && files.length) error = await uploadPhotos(iid, files);
    if (!error && !id && row.available_from) {
      const m = await askReminder();
      if (m) { const u = await sb.from('interventions').update({ remind_minutes: m }).eq('id', iid); if (u.error) error = u.error; }
    }
    if (btn) btn.disabled = false;
    error ? err.textContent = error.message : location.hash = `i/${iid}`;
  };
}
