import { sb } from './sb.js';
import { S, esc, REMIND, MGR, TECH } from './state.js';
import { takeLock } from './lock.js';

const PRIO_L = { basse: 'À faire', normale: 'Important', haute: 'Urgent', urgente: 'Urgente' };
const COMMON = [
  'Réception',
  'Camp saisonnier',
  'Sanitaire 1',
  'Sanitaire 2',
  'Scène',
  'Restaurant',
  'Bar',
  'Piscine',
  'Aire de jeux',
  'Parking',
  'Local technique',
  'Laverie',
  'Épicerie',
  'Snack',
  'Spa',
  'Salle de sport',
  'Terrain multisport',
  'Mini-golf',
  'Accueil',
  'Entrée / barrière',
  'Lingerie',
  'Cuisine du restaurant',
  'Salle commune',
];
const WRENCH =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>';
const BRIEFCASE =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>';
const BACK =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
const CLOSE =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
const CLOCK =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
const PIN =
  '<svg class="pin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-4.8 7-11a7 7 0 1 0-14 0c0 6.2 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>';
const DCHEV =
  '<svg class="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5L6 8L9.5 4.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TRASH =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';
const padMH = s => String(s).replace(/^((?:mh|mobil[- ]?home)\s*)(\d)\s*$/i, (_, a, d) => a + '0' + d);
const p2 = n => String(n).padStart(2, '0');
const dIn = v => {
  const x = v ? new Date(v) : new Date();
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`;
};
const tIn = v => {
  if (!v) return '';
  const x = new Date(v);
  return `${p2(x.getHours())}:${p2(x.getMinutes())}`;
};
const TIMES = Array.from({ length: 96 }, (_, i) => `${p2(Math.floor(i / 4))}:${p2((i % 4) * 15)}`);
const DAYS = cur => {
  const out = [],
    t = new Date();
  t.setHours(0, 0, 0, 0);
  const W = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'],
    M = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  const lab = (x, n) =>
    n === 0 ? "Aujourd'hui" : n === 1 ? 'Demain' : `${W[x.getDay()]} ${x.getDate()} ${M[x.getMonth()]}`;
  if (cur && dIn(cur) < dIn()) {
    const x = new Date(cur);
    out.push([dIn(cur), lab(x, -1)]);
  }
  for (let i = 0; i < 60; i++) {
    const x = new Date(t);
    x.setDate(t.getDate() + i);
    out.push([dIn(x), lab(x, i)]);
  }
  return out;
};
const mhN = v =>
  (String(v)
    .trim()
    .match(/^(?:mh|mobil[- ]?home)?\s*(\d+)$/i) || [])[1];
const tagIn = v => {
  const n = mhN(v);
  return n
    ? `<span class="mhpre">MH</span><span class="mhnum">${esc(String(n).padStart(2, '0'))}</span>`
    : `${PIN}<span class="ltx">${esc(v)}</span>`;
};
const canDraft = r => MGR.includes(r) || r === 'technicien' || r === 'client';
const hostModal = () => document.querySelector('.sim #app') || document.body;

// Réduit la photo (1600 px max, JPEG ~0,8) pour un envoi plus léger ; garde l'original si la conversion échoue ou n'apporte rien.
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k);
    c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
    bmp.close?.();
    return b && b.size < file.size ? b : file;
  } catch {
    return file;
  }
}

// Envoie les photos dans le stockage puis les rattache à l'intervention (un message photo s'ajoute au tchat). Renvoie la première erreur.
export async function uploadPhotos(iid, files) {
  for (const file of files) {
    const f = await shrink(file);
    const ext =
      f === file ? (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg' : 'jpg';
    const path = `${S.me.org_id}/${iid}/${crypto.randomUUID()}.${ext}`;
    const { error } = await sb.storage
      .from('photos')
      .upload(path, f, { contentType: f.type || 'image/jpeg' })
      .then(r => (r.error ? r : sb.from('intervention_photos').insert({ intervention_id: iid, path })));
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
    if (!b) {
      if (e.target === o) on(o, null);
      return;
    }
    on(o, b);
  };
  return o;
}

function askReminder() {
  return new Promise(res => {
    modal(
      `<p class="mq">Programmer un rappel ?</p><div class="mbtns"><button type="button" class="ghost" data-r="non">Non</button><button type="button" class="primary" data-r="oui">Oui</button></div>`,
      (o, b) => {
        if (!b || b.dataset.r === 'non') {
          o.remove();
          return res(null);
        }
        if (b.dataset.r === 'oui') {
          o.querySelector('.mbox').innerHTML =
            `<p class="mq">Combien de temps avant l'intervention ?</p><div class="mlist">${Object.entries(REMIND)
              .map(([m, l]) => `<button type="button" class="ghost" data-m="${m}">${l}</button>`)
              .join('')}</div>`;
          return;
        }
        if (b.dataset.m) {
          o.remove();
          res(+b.dataset.m);
        }
      }
    );
  });
}

function quitBox(draft) {
  return new Promise(res => {
    modal(
      `<p class="mq">Voulez-vous quitter la création d'une nouvelle intervention ?</p><div class="mbtns mb3">${draft ? '<button type="button" class="primary" data-r="draft">Enregistrer en brouillon</button>' : ''}<button type="button" class="ghost" data-r="quit">Quitter sans enregistrer</button><button type="button" class="ghost" data-r="">Annuler</button></div>`,
      (o, b) => {
        o.remove();
        res(b?.dataset.r || '');
      }
    );
  });
}

export function photoTray(input, tray, onChange, max = 10) {
  const files = [];
  const cap = typeof max === 'function' ? max : () => max;
  const draw = () => {
    tray.querySelectorAll('[data-new] img').forEach(i => {
      if (i.src.startsWith('blob:')) URL.revokeObjectURL(i.src);
    });
    tray.querySelectorAll('[data-new]').forEach(n => n.remove());
    files.forEach((f, i) => {
      const s = document.createElement('span');
      s.className = 'pt';
      s.dataset.new = '1';
      s.innerHTML = `<img src="${URL.createObjectURL(f)}" alt=""><button type="button" class="pt-x" data-i="${i}" aria-label="Retirer la photo">×</button>`;
      tray.append(s);
    });
    onChange?.(files);
  };
  input.addEventListener('change', () => {
    const room = Math.max(0, cap() - files.length);
    if (input.files.length > room) {
      const fe = tray.closest('form')?.querySelector('#ferr') || document.querySelector('#acterr');
      if (fe) fe.textContent = '10 photos maximum par intervention.';
    }
    files.push(...[...input.files].slice(0, room));
    input.value = '';
    draw();
  });
  tray.addEventListener('click', e => {
    const x = e.target.closest('.pt-x');
    if (x && !x.closest('[data-new]')) return;
    if (x) {
      if (confirm('Supprimer ?')) {
        files.splice(+x.dataset.i, 1);
        draw();
      }
      return;
    }
    const img = e.target.closest('.pt img');
    if (img) zoomImg(img.src);
  });
  return files;
}

export async function renderForm(el, id) {
  // Verrou d'édition : une seule personne modifie à la fois.
  const by = id && (await takeLock(id));
  if (by) return (el.innerHTML = `<p>${esc(by)}</p>`);
  const [cur, placesRes, techs] = await Promise.all([
    id ? sb.from('interventions').select('*').eq('id', id).maybeSingle() : { data: { priority: 'normale' } },
    sb.from('places').select('label, num').order('num', { nullsFirst: false }).order('label').limit(2000),
    sb
      .from('members')
      .select('user_id, full_name, role')
      .in('role', S.me.role === 'directeur' ? TECH : ['technicien']),
  ]);
  const i = cur.data;
  if (!i) return (el.innerHTML = `<p>${esc(cur.error?.message || 'Intervention introuvable.')}</p>`);
  const r = S.me.role,
    mgr = MGR.includes(r);
  const backHref = id ? (i.status === 'brouillon' ? '#' : `#i/${id}`) : '#';
  const canAssign = mgr && (!id || (i.status === 'publiee' && !i.assignee_id));
  const slotOn = !!(i.available_from || i.client_presence);
  const from = i.available_from ? new Date(i.available_from) : null,
    until = i.available_until ? new Date(i.available_until) : null;
  const draftOk = !id && canDraft(r);
  el.innerHTML = `
    <div class="fpage">
      <div class="fhead">${id ? `<a href="${backHref}" class="back" aria-label="Retour">${BACK}</a>` : ''}<h1>${id ? "Modifier l'intervention" : 'Nouvelle intervention'}</h1>${id ? '' : `<button type="button" class="fx" aria-label="Fermer">${CLOSE}</button>`}</div>
      <form id="f" class="nform${id ? '' : ' stp1'}" autocomplete="off" data-prio="${i.priority || 'normale'}">
        <div class="fsum" hidden role="button" tabindex="0"></div>
        <div class="s1"><div class="nf-row">
          <div class="nf"><input name="title" type="text" maxlength="70" required placeholder="${r === 'client' ? "Titre de l'intervention" : 'Titre'}" value="${esc(i.title)}"></div>
          <div class="nf ac"><input name="location" type="text" maxlength="80" placeholder="Lieu" value="${esc(i.location)}" aria-autocomplete="list" aria-expanded="false" autocorrect="off" spellcheck="false"><ul class="ac-list" role="listbox" hidden></ul></div>
        </div>
        <fieldset class="seg"><legend>Priorité</legend>${Object.entries(PRIO_L)
          .map(
            ([k, v]) =>
              `<label class="p-${k}"><input type="radio" name="priority" value="${k}" ${k === i.priority ? 'checked' : ''}><span>${v}</span></label>`
          )
          .join('')}</fieldset></div>
        <div class="s2"><div class="fsum2" hidden role="button" tabindex="0"></div><div class="nf"><textarea name="description" rows="6" placeholder="${r === 'client' ? 'Décrivez votre demande en quelques lignes' : 'Description'}">${esc(i.description)}</textarea></div></div>
        <div class="s3">${
          canAssign
            ? `<fieldset class="assign"><legend>Assigner à un technicien</legend>${(techs.data || [])
                .map(
                  t =>
                    `<label><input type="checkbox" name="assign" value="${t.user_id}" ${i.proposed_to === t.user_id ? 'checked' : ''}><span class="cwho">${t.role === 'technicien' ? WRENCH : BRIEFCASE}<span>${esc(t.full_name)}</span></span></label>`
                )
                .join('')}</fieldset>`
            : ''
        }
        <fieldset id="hp"${slotOn ? ' class="on"' : ''}><legend class="sr">Passage</legend>
          <input type="radio" name="passage" value="now" ${slotOn ? '' : 'checked'}>
          <input type="radio" name="passage" value="slot" ${slotOn ? 'checked' : ''}>
          <span class="hptx">Présence client requise</span>
          <button type="button" class="hpsw2" role="switch" aria-checked="${slotOn}" aria-label="Présence client requise"></button>
          <span class="hpcr"><button type="button" class="hpclk" aria-label="Choisir le créneau" ${slotOn ? '' : 'disabled'}>${CLOCK}</button><span class="hpv"></span></span>
        </fieldset>
        <div class="nf slot" hidden>
          <input type="hidden" name="slot_d" value="${from ? dIn(from) : ''}">
          <input type="hidden" name="slot_a" value="${tIn(from)}">
          <input type="hidden" name="slot_b" value="${tIn(until)}">
          <div class="wsheet" hidden><div class="wbox"><button type="button" class="wx" aria-label="Fermer">×</button><div class="wheels"><div class="wcol w-d"><span class="wh">Jour</span><div class="wheel" data-k="slot_d">${DAYS(
            i.available_from
          )
            .map(([v, l]) => `<div class="wi" data-v="${v}">${l}</div>`)
            .join(
              ''
            )}</div></div><div class="wcol"><span class="wh">De</span><div class="wheel" data-k="slot_a">${TIMES.map(t => `<div class="wi" data-v="${t}">${t}</div>`).join('')}</div></div><div class="wcol"><span class="wh">À</span><div class="wheel" data-k="slot_b">${TIMES.map(t => `<div class="wi" data-v="${t}">${t}</div>`).join('')}</div></div><div class="wband" aria-hidden="true"></div></div><button type="button" class="primary wok">Valider</button><button type="button" class="ghost wrm">Retirer le créneau</button></div></div>
        </div>
        <div class="nph">Photos
          <div class="pstrip"><div class="ptray"></div><label class="padd" aria-label="Ajouter des photos"><input name="photos" type="file" accept="image/*" multiple><span>+</span></label></div>
        </div></div>
        <div class="nactions">
          <button type="submit" class="primary" value="${id ? 'save' : 'publier'}">${id ? 'Enregistrer' : 'Suivant'}</button>
          ${draftOk ? `<span class="bdwrap"><button type="submit" class="ghost" value="brouillon" hidden tabindex="-1"></button><button type="button" class="ghost bdchev" aria-haspopup="menu" aria-expanded="false" aria-label="Brouillons"></button><button type="button" class="ghost bdsave">Brouillon +</button></span>` : ''}
          ${id && i.status === 'brouillon' ? '<button type="button" class="ghost danger bddel-form">Supprimer</button>' : ''}
          <a class="btn ghost" href="${backHref}">Annuler</a>
        </div>
        <p class="error" id="ferr"></p>
      </form>
    </div>`;

  const f = el.querySelector('#f'),
    err = el.querySelector('#ferr');
  const loc = f.location,
    ul = f.querySelector('.ac-list');
  let places = placesRes.data || [];

  f.querySelectorAll('[name=priority]').forEach(p => p.addEventListener('change', () => (f.dataset.prio = p.value)));
  f.querySelectorAll('[name=assign]').forEach(c =>
    c.addEventListener('change', () => {
      if (c.checked)
        f.querySelectorAll('[name=assign]').forEach(o => {
          if (o !== c) o.checked = false;
        });
    })
  );

  const ltag = document.createElement('span');
  ltag.className = 'loc-tag';
  loc.after(ltag);
  const syncTag = () => {
    const v = loc.value.trim(),
      on = !!v && document.activeElement !== loc;
    ltag.innerHTML = `${tagIn(v)}<button type="button" class="lx" aria-label="Retirer le lieu">×</button>`;
    ltag.classList.toggle('stacked', !!mhN(v));
    ltag.classList.toggle('ptag', !mhN(v));
    ltag.hidden = !on;
    loc.classList.toggle('tagged', on);
    if (on) loc.style.setProperty('--tagw', ltag.offsetWidth + 20 + 'px');
    else loc.style.removeProperty('--tagw');
  };
  ltag.addEventListener('click', e => {
    if (!e.target.closest('.lx')) return;
    e.preventDefault();
    loc.value = '';
    ltag.hidden = true;
    loc.classList.remove('tagged');
    loc.focus();
    loc.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const fromTitle = () => {
    const t = f.title.value.toLowerCase();
    if (!t) return [];
    const nums = [...t.matchAll(/(?:mh|mobil[- ]?home)?\s*(\d+)/g)].map(m => m[1]);
    const byNum = places.filter(p => p.num != null && nums.includes(String(p.num))).map(p => p.label);
    const names = [...new Set([...COMMON, ...places.filter(p => p.num == null).map(p => p.label)])];
    const byName = names.filter(
      l =>
        l &&
        (t.includes(l.toLowerCase()) ||
          l
            .toLowerCase()
            .split(/[\s'-]+/)
            .some(
              w =>
                w.length >= 4 &&
                !/^\d+$/.test(w) &&
                t.split(/[\s'-]+/).some(x => x.length >= 4 && (x.startsWith(w) || w.startsWith(x)))
            ))
    );
    return [...new Set([...byNum, ...byName])];
  };
  const closeAc = () => {
    ul.hidden = true;
    loc.setAttribute('aria-expanded', 'false');
  };
  const showHits = hits => {
    ul.innerHTML = hits
      .map(l => `<li role="option" class="${mhN(l) ? 'lmh' : 'lpt'}" data-v="${esc(l)}">${tagIn(l)}</li>`)
      .join('');
    ul.hidden = !hits.length;
    loc.setAttribute('aria-expanded', hits.length ? 'true' : 'false');
  };
  loc.addEventListener('focus', () => {
    if (!loc.value.trim()) {
      const hits = fromTitle().slice(0, 4);
      if (hits.length) showHits(hits);
    }
    syncTag();
  });
  loc.addEventListener('blur', () =>
    setTimeout(() => {
      closeAc();
      syncTag();
    }, 150)
  );
  loc.oninput = () => {
    const v = loc.value.trim().toLowerCase();
    if (!v) return closeAc();
    const m = v.match(/^(?:mh|mobil[- ]?home)?\s*(\d+)$/);
    let hits;
    if (m) {
      const digits = m[1];
      const rank = p => {
        const n = String(p.num ?? '');
        return n === digits ? 0 : n.endsWith(digits) ? 1 : n.startsWith(digits) ? 2 : 3;
      };
      hits = places
        .filter(p => p.num != null && String(p.num).endsWith(digits))
        .sort((x, y) => rank(x) - rank(y) || x.num - y.num)
        .map(p => padMH(p.label));
      hits = hits.slice(0, digits.length < 2 ? 3 : 4);
    } else {
      hits = [...new Set([...COMMON, ...places.filter(p => p.num == null).map(p => p.label)])]
        .filter(
          l =>
            l
              .toLowerCase()
              .split(/[\s'/-]+/)
              .some(w => w.startsWith(v)) || l.toLowerCase().startsWith(v)
        )
        .sort((x, y) => x.toLowerCase().indexOf(v) - y.toLowerCase().indexOf(v))
        .slice(0, v.length < 3 ? 3 : 5);
    }
    showHits(hits);
  };
  ul.addEventListener('mousedown', e => e.preventDefault());
  ul.addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li) return;
    loc.value = li.dataset.v;
    closeAc();
    loc.blur();
    syncTag();
  });
  syncTag();

  const hp = f.querySelector('#hp'),
    clk = f.querySelector('.hpclk'),
    hpv = f.querySelector('.hpv');
  const sheet = f.querySelector('.wsheet');
  document.querySelectorAll('.wsheet').forEach(x => x !== sheet && x.remove());
  hostModal().append(sheet);
  addEventListener('hashchange', () => sheet.remove(), { once: true });
  const wheels = [...sheet.querySelectorAll('.wheel')];
  const IH = () => sheet.querySelector('.wi')?.offsetHeight || 36;
  const vis = w => [...w.children].filter(x => !x.hidden);
  let placing = false,
    npBusy = false,
    lastA = null,
    slotDone = !!i.available_from,
    saved = null;
  const T0 = () => (id && i.created_at ? new Date(i.created_at) : new Date());
  const isPast = (d, t) => !!(d && t) && new Date(`${d}T${t}`) < T0();
  const noPast = src => {
    if (npBusy) return;
    npBusy = true;
    try {
      const d = f.slot_d.value;
      wheels
        .filter(w => w.dataset.k !== 'slot_d')
        .forEach(w =>
          [...w.children].forEach(x => x.classList.toggle('past', !!x.dataset.v && isPast(d, x.dataset.v)))
        );
      const wa = wheels.find(w => w.dataset.k === 'slot_a'),
        wd = wheels.find(w => w.dataset.k === 'slot_d');
      if (wa && isPast(d, f.slot_a.value)) {
        const k = [...wa.children].findIndex(x => !x.classList.contains('past'));
        if (k >= 0) {
          wa.scrollTo({ top: k * IH(), behavior: 'smooth' });
          [...wa.children].forEach((x, j) => x.classList.toggle('sel', j === k));
          f.slot_a.value = wa.children[k].dataset.v;
        } else if (wd) {
          const j = [...wd.children].findIndex(x => x.dataset.v > d);
          if (j >= 0) {
            wd.scrollTo({ top: j * IH(), behavior: 'smooth' });
            [...wd.children].forEach((x, q) => x.classList.toggle('sel', q === j));
            f.slot_d.value = wd.children[j].dataset.v;
          }
        }
      }
      const wb = wheels.find(w => w.dataset.k === 'slot_b'),
        a0 = f.slot_a.value;
      if (wb) {
        [...wb.children].forEach(x => {
          x.hidden = !!x.dataset.v && !!a0 && x.dataset.v <= a0;
        });
        const nx = () => TIMES.find(t => t > a0) || '';
        if (f.slot_b.value && a0 && f.slot_b.value <= a0) f.slot_b.value = nx();
        if (src?.dataset?.k === 'slot_a' && !placing && lastA !== null && a0 !== lastA) f.slot_b.value = nx();
        if (!f.slot_b.value && a0) f.slot_b.value = nx();
        if (src?.dataset?.k === 'slot_a') lastA = a0;
        const k = Math.max(
          0,
          vis(wb).findIndex(x => x.dataset.v === f.slot_b.value)
        );
        vis(wb).forEach((x, j) => x.classList.toggle('sel', j === k));
        if (Math.abs(wb.scrollTop - k * IH()) > 2) wb.scrollTop = k * IH();
      }
    } finally {
      npBusy = false;
    }
  };
  const pick = w => {
    const items = vis(w),
      idx = Math.max(0, Math.min(items.length - 1, Math.round(w.scrollTop / IH())));
    const prev = f[w.dataset.k].value,
      next = items[idx]?.dataset.v || '';
    items.forEach((x, k) => x.classList.toggle('sel', k === idx));
    f[w.dataset.k].value = next;
    if (w.dataset.k === 'slot_d' && !placing && prev && next && prev !== next) {
      f.slot_a.value = '08:00';
      const wa = wheels.find(x => x.dataset.k === 'slot_a'),
        k = wa ? [...wa.children].findIndex(x => x.dataset.v === '08:00') : -1;
      if (wa && k >= 0) {
        wa.scrollTo({ top: k * IH() });
        [...wa.children].forEach((x, j) => x.classList.toggle('sel', j === k));
      }
      f.slot_b.value = TIMES.find(tm => tm > '08:00') || '';
    }
    noPast(w);
  };
  const place = () => {
    placing = true;
    try {
      wheels.forEach(w => {
        if (w.dataset.k === 'slot_a' && !f.slot_a.value) {
          const n = new Date(),
            q = `${p2(n.getHours())}:${p2((Math.ceil(n.getMinutes() / 15) * 15) % 60)}`;
          f.slot_a.value = TIMES.find(t => t >= q) || '09:00';
        }
        const idx = Math.max(
          0,
          vis(w).findIndex(x => x.dataset.v === f[w.dataset.k].value)
        );
        w.scrollTop = idx * IH();
        pick(w);
      });
    } finally {
      placing = false;
    }
  };
  wheels.forEach(w => {
    let tm;
    w.addEventListener(
      'scroll',
      () => {
        clearTimeout(tm);
        tm = setTimeout(() => {
          if (w.offsetParent) pick(w);
        }, 60);
      },
      { passive: true }
    );
    w.onclick = e => {
      const it = e.target.closest('.wi');
      if (it) w.scrollTo({ top: vis(w).indexOf(it) * IH(), behavior: 'smooth' });
    };
  });
  const setPassage = on => {
    hp.classList.toggle('on', on);
    f.querySelector('[name=passage][value=slot]').checked = on;
    f.querySelector('[name=passage][value=now]').checked = !on;
    hp.querySelector('.hpsw2').setAttribute('aria-checked', on);
    clk.disabled = !on;
    if (on && !f.slot_d.value) f.slot_d.value = dIn();
    paintSlot();
  };
  const paintSlot = () => {
    if (!hp.classList.contains('on') || !slotDone || !f.slot_d.value || !f.slot_a.value) {
      hpv.textContent = '';
      return;
    }
    const lab = sheet.querySelector('.wheel[data-k=slot_d] .wi.sel')?.textContent;
    const d = new Date(f.slot_d.value + 'T00:00'),
      t = new Date();
    t.setHours(0, 0, 0, 0);
    const n = Math.round((d - t) / 864e5);
    const day =
      lab ||
      (n === 0
        ? "Aujourd'hui"
        : n === 1
          ? 'Demain'
          : d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }));
    hpv.textContent = `${day} ${f.slot_a.value}${f.slot_b.value ? '–' + f.slot_b.value : ''}`;
  };
  const KS = ['slot_d', 'slot_a', 'slot_b'];
  const pos = () => {
    const bx = sheet.querySelector('.wbox');
    sheet.classList.add('pop');
    if (!bx) return;
    const r = hp.getBoundingClientRect(),
      sr = sheet.getBoundingClientRect(),
      w = bx.offsetWidth,
      h = bx.offsetHeight;
    let l = r.right + 8 - sr.left,
      t = r.bottom - h - sr.top;
    if (l + w > sr.width - 8) {
      l = r.right - w - sr.left;
      t = r.bottom + 8 - sr.top;
    }
    bx.style.left = Math.max(8, Math.min(l, sr.width - w - 8)) + 'px';
    bx.style.top = Math.max(8, Math.min(t, sr.height - h - 8)) + 'px';
  };
  const openSheet = () => {
    saved = KS.map(k => f[k].value);
    sheet.hidden = false;
    pos();
    requestAnimationFrame(place);
  };
  const closeSheet = () => {
    sheet.hidden = true;
    if (saved)
      KS.forEach((k, i) => {
        f[k].value = saved[i];
      });
    if (!slotDone) setPassage(false);
    paintSlot();
  };
  sheet.querySelector('.wx').onclick = closeSheet;
  sheet.onclick = e => {
    if (e.target === sheet) closeSheet();
  };
  sheet.querySelector('.wok').onclick = () => {
    if (f.slot_b.value && f.slot_b.value <= f.slot_a.value)
      return (err.textContent = "L'heure de fin doit suivre l'heure de début.");
    if (isPast(f.slot_d.value, f.slot_a.value)) return (err.textContent = 'Ce créneau est déjà passé.');
    err.textContent = '';
    slotDone = true;
    saved = null;
    sheet.hidden = true;
    paintSlot();
  };
  sheet.querySelector('.wrm').onclick = () => {
    KS.forEach(k => {
      f[k].value = '';
    });
    slotDone = false;
    saved = null;
    sheet.hidden = true;
    setPassage(false);
  };
  hp.querySelector('.hpsw2').onclick = () => {
    const on = !hp.classList.contains('on');
    setPassage(on);
    if (on) openSheet();
  };
  clk.onclick = () => {
    if (!clk.disabled) openSheet();
  };
  if (slotOn && i.available_from) {
    requestAnimationFrame(() => {
      sheet.hidden = false;
      place();
      sheet.hidden = true;
      paintSlot();
    });
  } else paintSlot();

  const tray = f.querySelector('.ptray');
  let exN = 0;
  const picked = photoTray(
    f.photos,
    tray,
    files => {
      f.querySelector('.padd').hidden = files.length + exN >= 10;
    },
    () => 10 - exN
  );
  if (id)
    (async () => {
      const { data } = await sb
        .from('intervention_photos')
        .select('id, path')
        .eq('intervention_id', id)
        .order('created_at');
      const rows = data || [];
      if (!rows.length || !tray.isConnected) return;
      const { data: urls } = await sb.storage.from('photos').createSignedUrls(
        rows.map(p => p.path),
        3600
      );
      const map = Object.fromEntries((urls || []).map(d => [d.path, d.signedUrl]));
      for (const row of rows) {
        const s = document.createElement('span');
        s.className = 'pt';
        s.dataset.ex = row.id;
        s.innerHTML = `<img src="${esc(map[row.path] || '')}" alt=""><button type="button" class="pt-x" data-ex="${row.id}" aria-label="Retirer la photo">×</button>`;
        tray.append(s);
      }
      exN = tray.querySelectorAll('[data-ex]').length;
      f.querySelector('.padd').hidden = picked.length + exN >= 10;
      tray.addEventListener('click', async e => {
        const x = e.target.closest('.pt-x[data-ex]');
        if (!x) return;
        if (!confirm('Supprimer ?')) return;
        const row = rows.find(r => r.id === x.dataset.ex);
        const { error } = await sb.from('intervention_photos').delete().eq('id', row.id);
        if (error) return (err.textContent = error.message);
        await sb.storage.from('photos').remove([row.path]);
        x.closest('.pt').remove();
        exN = tray.querySelectorAll('[data-ex]').length;
        f.querySelector('.padd').hidden = picked.length + exN >= 10;
      });
    })();

  const wrap = f.querySelector('.bdwrap'),
    chev = wrap?.querySelector('.bdchev'),
    save = wrap?.querySelector('.bdsave'),
    db = wrap?.querySelector('[value=brouillon]');
  if (wrap && chev) {
    let rows = [];
    const paint = () => {
      chev.setAttribute('aria-label', 'Brouillons, ' + rows.length);
      chev.innerHTML = '<span class="bdcount">' + rows.length + '</span>' + DCHEV;
    };
    paint();
    const openDraftsMenu = () => {
      document.querySelector('.xmenu')?.remove();
      const m = document.createElement('div');
      m.className = 'xmenu bdmenu';
      m.innerHTML =
        rows
          .map(
            x =>
              `<div class="bdrow"><button type="button" data-id="${esc(x.id)}">${esc((x.title || '').trim().slice(0, 70) || 'Sans titre')}</button><button type="button" class="bddel" data-del="${esc(x.id)}" aria-label="Supprimer">${TRASH}</button></div>`
          )
          .join('') || '<button type="button" disabled>Aucun brouillon</button>';
      hostModal().append(m);
      const r = chev.getBoundingClientRect(),
        box = m.offsetParent?.getBoundingClientRect() || { left: 0, top: 0, width: innerWidth, height: innerHeight };
      const h = m.offsetHeight,
        w = m.offsetWidth;
      m.style.left = Math.max(8, Math.min(r.right - box.left - w, box.width - w - 8)) + 'px';
      m.style.top =
        (r.bottom - box.top + 2 + h > box.height - 8 ? Math.max(8, r.top - box.top - 2 - h) : r.bottom - box.top + 2) +
        'px';
      chev.setAttribute('aria-expanded', 'true');
      const close = () => {
        chev.setAttribute('aria-expanded', 'false');
        m.remove();
        document.removeEventListener('pointerdown', out, true);
        removeEventListener('scroll', close, true);
      };
      const out = e => {
        if (!m.contains(e.target) && e.target !== chev && !chev.contains(e.target) && !e.target.closest('.modal'))
          close();
      };
      setTimeout(() => {
        document.addEventListener('pointerdown', out, true);
        addEventListener('scroll', close, true);
      }, 0);
      m.onclick = async e => {
        const del = e.target.closest('.bddel');
        if (del) {
          e.preventDefault();
          close();
          if (!confirm('Voulez-vous vraiment supprimer ce brouillon ?')) return;
          const { error } = await sb.from('interventions').delete().eq('id', del.dataset.del);
          if (error) return (err.textContent = error.message);
          rows = rows.filter(x => x.id !== del.dataset.del);
          paint();
          return;
        }
        const t = e.target.closest('button');
        if (!t || t.disabled) return;
        close();
        if (t.dataset.id) location.hash = `i/${t.dataset.id}/modifier`;
      };
    };
    chev.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      openDraftsMenu();
    });
    if (save)
      save.addEventListener('click', e => {
        e.preventDefault();
        if (db && !db.disabled) f.requestSubmit(db);
      });
    (async () => {
      let q = sb.from('interventions').select('id, title').eq('status', 'brouillon');
      if (!mgr) q = q.eq('created_by', S.me.id);
      const { data } = await q.order('created_at', { ascending: false }).limit(300);
      if (!chev.isConnected) return;
      rows = data || [];
      paint();
    })();
  }

  const DK = id ? null : 'lab:dr:new';
  const clearDraft = () => {
    if (DK) localStorage.removeItem(DK);
  };
  const snapDraft = () => {
    if (!DK) return;
    const o = {
      title: f.title.value,
      location: f.location.value,
      description: f.description.value,
      priority: f.querySelector('[name=priority]:checked')?.value,
      passage: hp.classList.contains('on') ? 'slot' : 'now',
      slot_d: f.slot_d.value,
      slot_a: f.slot_a.value,
      slot_b: f.slot_b.value,
      slotDone,
      assign: f.querySelector('[name=assign]:checked')?.value || '',
    };
    if (!o.title && !o.location && !o.description && o.passage !== 'slot' && !o.assign) localStorage.removeItem(DK);
    else localStorage.setItem(DK, JSON.stringify(o));
  };
  if (DK) {
    try {
      const o = JSON.parse(localStorage.getItem(DK) || 'null');
      if (o) {
        if (o.title) f.title.value = o.title;
        if (o.location) {
          f.location.value = o.location;
          syncTag();
        }
        if (o.description) f.description.value = o.description;
        const pr = o.priority && f.querySelector(`[name=priority][value="${o.priority}"]`);
        if (pr) {
          pr.checked = true;
          f.dataset.prio = o.priority;
        }
        if (o.assign) {
          const c = f.querySelector(`[name=assign][value="${CSS.escape(o.assign)}"]`);
          if (c) c.checked = true;
        }
        if (o.slot_d) f.slot_d.value = o.slot_d;
        if (o.slot_a) f.slot_a.value = o.slot_a;
        if (o.slot_b) f.slot_b.value = o.slot_b;
        if (o.passage === 'slot') {
          slotDone = !!(o.slotDone && o.slot_d && o.slot_a);
          setPassage(true);
          requestAnimationFrame(() => {
            sheet.hidden = false;
            place();
            sheet.hidden = true;
            paintSlot();
          });
        }
      }
    } catch {}
    f.addEventListener('input', snapDraft);
    f.addEventListener('change', snapDraft);
  }

  const dirty = () =>
    !!(f.title.value.trim() || f.location.value.trim() || f.description.value.trim() || picked.length);
  let s0 = null;
  const snap = () => JSON.stringify([...new FormData(f)].filter(([k]) => k !== 'photos'));
  if (id)
    setTimeout(() => {
      s0 = snap();
    }, 400);
  const canLeave = async () => {
    if (id) return s0 === null || snap() === s0 || confirm('Attention, votre modification ne sera pas enregistrée.');
    if (!dirty()) {
      clearDraft();
      return true;
    }
    const a = await quitBox(draftOk);
    if (a === 'draft' && db) {
      f.requestSubmit(db);
      return false;
    }
    if (a === 'quit') {
      clearDraft();
      return true;
    }
    return false;
  };
  el.querySelectorAll('a.back, .nactions a.btn').forEach(a =>
    a.addEventListener('click', async e => {
      if (!(await canLeave())) e.preventDefault();
    })
  );
  const fx = el.querySelector('.fx');
  if (fx)
    fx.onclick = async () => {
      if (await canLeave()) location.hash = backHref;
    };

  const delBtn = f.querySelector('.bddel-form');
  if (delBtn)
    delBtn.onclick = async () => {
      if (!confirm('Voulez-vous vraiment supprimer ce brouillon ?')) return;
      const { error } = await sb.from('interventions').delete().eq('id', id);
      if (error) return (err.textContent = error.message);
      location.hash = '#';
    };

  let st = 1;
  const pb = f.querySelector('[value=publier]');
  const sum = f.querySelector('.fsum'),
    sum2 = f.querySelector('.fsum2');
  const paintSum = () => {
    if (!sum) return;
    const locv = f.location.value.trim();
    sum.innerHTML = `<b>${esc(f.title.value.trim()) || 'Sans titre'}</b>${locv ? `<span class="card__meta">${/* reuse tag */ ''}${tagIn(locv)}</span>` : ''}`;
    if (sum2) sum2.textContent = f.description.value.trim() || 'Aucune description';
  };
  const goStep = n => {
    st = n;
    f.classList.remove('stp1', 'stp2', 'stp3');
    f.classList.add('stp' + n);
    if (pb) pb.textContent = n < 3 ? 'Suivant' : 'Créer et publier';
    paintSum();
    chk();
  };
  const ok1 = () => !!(f.title.value.trim() && f.location.value.trim());
  const chk = () => {
    if (pb && !id) pb.disabled = st === 1 && !ok1();
  };
  if (!id && pb) {
    chk();
    f.addEventListener('input', chk);
    f.addEventListener('change', chk);
    sum.onclick = () => goStep(1);
    if (sum2) sum2.onclick = () => goStep(2);
  }

  f.onsubmit = async e => {
    e.preventDefault();
    const fd = new FormData(f),
      mode = e.submitter?.value;
    if (!id && mode === 'publier' && st < 3) {
      if (st === 1 && !ok1()) {
        err.textContent = 'Le titre et le lieu sont obligatoires.';
        return f.title.focus();
      }
      err.textContent = '';
      goStep(st + 1);
      return;
    }
    const title = String(fd.get('title') || '').trim();
    if (!title) {
      err.textContent = 'Le titre est obligatoire.';
      return f.title.focus();
    }
    const row = {
      title: title.slice(0, 70),
      location: String(fd.get('location') || '').trim(),
      description: String(fd.get('description') || '').trim(),
      priority: fd.get('priority') || 'normale',
      available_from: null,
      available_until: null,
      remind_minutes: null,
      client_presence: fd.get('passage') === 'slot',
    };
    if (row.client_presence) {
      const day = f.slot_d.value,
        a = f.slot_a.value,
        b = f.slot_b.value;
      if (day && a) {
        if (b && b <= a) return (err.textContent = "L'heure de fin doit suivre l'heure de début.");
        const start = new Date(`${day}T${a}`);
        if (start < (id && i.created_at ? new Date(i.created_at) : new Date(Date.now() - 6e4)))
          return (err.textContent = 'Ce créneau est déjà passé.');
        row.available_from = start.toISOString();
        row.available_until = new Date(b ? `${day}T${b}` : start.getTime() + 9e5).toISOString();
      }
    }
    const files = [...picked];
    const who = f.querySelector('[name=assign]:checked')?.value || null;
    const run = async () => {
      if (id) {
        let res = await sb.from('interventions').update(row).eq('id', id);
        if (!res.error && canAssign && who !== (i.proposed_to || null))
          res = await sb.rpc('assign_tech', { p_id: id, p_tech: who });
        return [res.error, id];
      }
      const { data, error } = await sb
        .from('interventions')
        .insert({ ...row, org_id: S.me.org_id })
        .select('id')
        .single();
      if (error || mode !== 'publier') return [error, data?.id];
      let res = await sb.rpc('transition', { p_id: data.id, p_action: 'publier', p_comment: '' });
      if (!res.error && who) res = await sb.rpc('assign_tech', { p_id: data.id, p_tech: who });
      return [res.error, data.id];
    };
    const btn = e.submitter;
    if (btn) btn.disabled = true;
    let [error, iid] = await run();
    if (!error && files.length) error = await uploadPhotos(iid, files);
    if (!error && !id && row.available_from) {
      const m = await askReminder();
      if (m) {
        const u = await sb.from('interventions').update({ remind_minutes: m }).eq('id', iid);
        if (u.error) error = u.error;
      }
    }
    if (btn) btn.disabled = false;
    if (error) err.textContent = error.message;
    else {
      clearDraft();
      location.hash = `i/${iid}`;
    }
  };
}
