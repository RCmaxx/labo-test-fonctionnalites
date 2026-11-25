import { confirmBox } from './alerts.js';
import { sb } from './sb.js';
import { S, esc, hostModal } from './state.js';

const DCHEV =
  '<svg class="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5L6 8L9.5 4.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TRASH =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>';

// Brouillons du formulaire : menu « Brouillon + », enregistrement local, restauration et suppression.
/** Branche la gestion des brouillons sur le formulaire `f` ; rend `clearDraft` (à appeler après un envoi réussi). */
export function initDrafts(f, ctx) {
  const { id, mgr, err, slot, syncTag, paintSlot, place, setPassage, hp, sheet } = ctx;
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
          if (!(await confirmBox('Voulez-vous vraiment supprimer ce brouillon ?', 'Supprimer'))) return;
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
      slotDone: slot.done,
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
          slot.done = !!(o.slotDone && o.slot_d && o.slot_a);
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

  return { clearDraft, db };
}
