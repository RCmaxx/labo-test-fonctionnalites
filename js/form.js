import { initDrafts } from './drafts.js';
import { initPlaceField, tagIn } from './place.js';
import { initSlotPicker, dIn, TIMES } from './slot.js';
import { sb } from './sb.js';
import { S, esc, REMIND, MGR, TECH, MONTHS, p2, hostModal, WRENCH, BRIEFCASE } from './state.js';
import { takeLock } from './lock.js';

const PRIO_L = { basse: 'À faire', normale: 'Important', haute: 'Urgent', urgente: 'Urgente' };
const BACK =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>';
const CLOSE =
  '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6L6 18M6 6l12 12"/></svg>';
const CLOCK =
  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
const tIn = v => {
  if (!v) return '';
  const x = new Date(v);
  return `${p2(x.getHours())}:${p2(x.getMinutes())}`;
};
const DAYS = cur => {
  const out = [],
    t = new Date();
  t.setHours(0, 0, 0, 0);
  const W = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  const lab = (x, n) =>
    n === 0 ? "Aujourd'hui" : n === 1 ? 'Demain' : `${W[x.getDay()]} ${x.getDate()} ${MONTHS[x.getMonth()]}`;
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
const canDraft = r => MGR.includes(r) || r === 'technicien' || r === 'client';

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

/** Gabarit HTML du formulaire (création ou modification d'une intervention). */
function formHtml({ backHref, canAssign, draftOk, from, i, id, r, slotOn, techs, until }) {
  return `
    <div class="fpage">
      <div class="fhead">${id ? `<a href="${backHref}" class="back" aria-label="Retour">${BACK}</a>` : ''}<h1>${id ? "Modifier l'intervention" : 'Nouvelle intervention'}</h1>${id ? '' : `<button type="button" class="fx" aria-label="Fermer">${CLOSE}</button>`}</div>
      <form id="f" class="nform${id ? '' : ' stp1'}" autocomplete="off" data-prio="${i.priority || 'normale'}">
        <div class="fsum" hidden role="button" tabindex="0"></div>
        <div class="s1"><div class="nf-row">
          <div class="nf"><input name="title" type="text" maxlength="70" required placeholder="${r === 'client' ? "Titre de l'intervention" : 'Titre'}" value="${esc(i.title)}"></div>
          <div class="nf ac"><input name="location" type="text" maxlength="80" placeholder="Lieu" value="${esc(i.location)}" aria-autocomplete="list" aria-expanded="false" autocorrect="off" spellcheck="false"><ul class="ac-list" role="listbox" hidden></ul></div>
          <div class="pbw"><button type="button" class="pbtn" aria-expanded="false">Priorité</button></div>
          <span class="ndate">${esc(new Date().toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).replace(' à', ''))}</span>
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
}

export async function renderForm(el, id) {
  // Verrou d'édition : une seule personne modifie à la fois.
  const by = id && (await takeLock(id));
  if (by) return (el.innerHTML = `<p>${esc(by)}</p>`);
  const [cur, placesRes, techs] = await Promise.all([
    id ? sb.from('interventions').select('*').eq('id', id).maybeSingle() : { data: {} },
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
  el.innerHTML = formHtml({ backHref, canAssign, draftOk, from, i, id, r, slotOn, techs, until });

  const f = el.querySelector('#f'),
    err = el.querySelector('#ferr');
  // Mobile : la priorité se choisit depuis un bouton (les pastilles s'ouvrent dessous), comme l'appli tech.
  const pbtn = f.querySelector('.pbtn');
  const syncPrio = () => {
    const v = f.priority?.value;
    pbtn.textContent = v ? PRIO_L[v] : 'Priorité';
  };
  pbtn.addEventListener('click', () => pbtn.setAttribute('aria-expanded', String(f.classList.toggle('pop'))));
  f.addEventListener('change', e => {
    if (e.target.name !== 'priority') return;
    syncPrio();
    f.classList.remove('pop');
    pbtn.setAttribute('aria-expanded', 'false');
  });
  syncPrio();
  const { syncTag } = initPlaceField(f, placesRes);
  const slot = initSlotPicker(f, { id, i, r, slotOn, err });
  const { hp, sheet, paintSlot, place, setPassage } = slot;
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

  const { clearDraft, db } = initDrafts(f, { id, mgr, err, slot, syncTag, paintSlot, place, setPassage, hp, sheet });
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
  const sv = f.querySelector('.bdsave');
  const chk = () => {
    if (pb && !id) pb.disabled = st === 1 && !ok1();
    if (sv) sv.disabled = !f.title.value.trim(); // brouillon : il faut au moins un titre, comme l'appli tech
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
