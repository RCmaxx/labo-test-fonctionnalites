// Appui long sur une carte (mobile), comme l'appli tech : la page se grise, la carte se soulève et ses actions
// s'affichent dessous en pastilles. On touche une pastille, ou on y glisse le doigt sans le lever et on relâche.
import { sb } from './sb.js';
import { S, MGR, DONE, TECH, isMine, canTake } from './state.js';
import { toast, confirmBox } from './alerts.js';
import { lockedByOther } from './lock.js';

const HOLD_MS = 450;
const MSG = {
  prendre: 'Intervention prise en charge.',
  resoudre: 'Intervention terminée.',
  liberer: 'Vous ne prenez plus cette intervention.',
  publier: 'Intervention publiée.',
  renvoyer: 'Intervention renvoyée parmi les actives.',
  demander: 'Demande envoyée.',
};

// Actions possibles sur une intervention, dans l'ordre de l'appli tech : [action, libellé, style].
function menuActs(r) {
  const R = S.me.role,
    me = S.me.id,
    mgr = MGR.includes(R),
    mine = isMine(r),
    author = r.created_by === me,
    a = [];
  if (r.status === 'brouillon' && (mgr || (['reception', 'technicien'].includes(R) && author)))
    a.push(['publier', 'Publier', 'primary']);
  if (canTake(r)) a.push(['prendre', "Prendre l'intervention", 'primary']);
  if (r.status === 'prise_en_charge') {
    if (mine || ['directeur', 'responsable_tech'].includes(R))
      a.push(['resoudre', "Terminer l'intervention", 'primary']);
    if (mine) a.push(['liberer', "Ne plus prendre l'intervention", 'ghost']);
    if (TECH.includes(R) && r.assignee_id && !mine) a.push(['demander', "Demander l'intervention", 'ghost']);
  }
  if (DONE.includes(r.status) && (mgr || mine)) a.push(['renvoyer', 'Renvoyer active', 'ghost']);
  const planned = !!r.available_from && (r.proposed_to === me || mgr || S.me.real === 'admin');
  if ((author || planned) && ['brouillon', 'publiee'].includes(r.status) && !r.assignee_id)
    a.push(['modifier', "Modifier l'intervention", 'ghost']);
  if (mgr) a.push(['supprimer', "Supprimer l'intervention", 'ghost danger']);
  return a;
}

async function run(id, a, done) {
  if (a === 'modifier') {
    if (!lockedByOther(id)) location.hash = `#i/${id}/modifier`;
    return;
  }
  if (a === 'supprimer') {
    if (!(await confirmBox('Voulez-vous vraiment supprimer cette intervention ?', 'Supprimer'))) return;
    const { data: ph } = await sb.from('intervention_photos').select('path').eq('intervention_id', id);
    if (ph?.length) await sb.storage.from('photos').remove(ph.map(p => p.path));
    const { error } = await sb.from('interventions').delete().eq('id', id);
    if (error) return toast(error.message, true);
    toast('Intervention supprimée.');
    return done();
  }
  if (a === 'liberer' && !(await confirmBox("Se retirer de l'intervention ?", 'Oui', { cancel: 'Non' }))) return;
  const { error } =
    a === 'demander'
      ? await sb.rpc('request_transfer', { p_id: id })
      : await sb.rpc('transition', { p_id: id, p_action: a, p_comment: '' });
  if (error) return toast(error.message, true);
  if (a !== 'prendre') toast(MSG[a]); // prise par appui long : sans message, comme l'appli tech
  done();
}

// Voile, copie de la carte et étiquettes d'actions, ajoutés à la page.
function buildMenu(card, r, box) {
  const veil = document.createElement('div');
  veil.className = 'pmenu-veil';
  const clone = card.cloneNode(true);
  clone.classList.add('pmenu-card');
  Object.assign(clone.style, { left: box.left + 'px', top: box.top + 'px', width: box.width + 'px' });
  veil.append(clone);
  const tags = document.createElement('div');
  tags.className = 'pmenu';
  tags.innerHTML = menuActs(r)
    .map(
      ([a, l, k]) =>
        `<button type="button" class="${k}" data-a="${a}"${a === 'modifier' && lockedByOther(r.id) ? ' disabled' : ''}>${l}</button>`
    )
    .join('');
  document.body.append(veil, tags);
  // Sous la carte, ou au-dessus s'il n'y a pas la place.
  const h = tags.offsetHeight,
    gap = 8,
    up = box.bottom + gap + h > innerHeight - gap;
  tags.style.left = Math.max(gap, Math.min(box.left, innerWidth - tags.offsetWidth - gap)) + 'px';
  tags.style.top = (up ? Math.max(gap, box.top - gap - h) : box.bottom + gap) + 'px';
  tags.classList.toggle('pmenu--up', up);
  requestAnimationFrame(() => {
    veil.classList.add('is-in');
    tags.classList.add('is-in');
  });
  return { veil, clone, tags };
}

// Fermeture du menu (défilement, toucher ailleurs) ; `onPick(bouton)` est appelé au clic sur une action.
// Rend `{ close, isShut }`.
function guardMenu({ veil, clone, tags }, onPick) {
  let shut = false;
  // Menu ouvert : le doigt resté posé choisit une action, il ne fait pas défiler la page.
  const still = e => e.cancelable && e.preventDefault();
  document.addEventListener('touchmove', still, { passive: false });
  const swallow = e => {
    e.preventDefault();
    e.stopPropagation();
  };
  const outside = e => {
    if (tags.contains(e.target)) return;
    swallow(e);
    close();
  };
  const close = () => {
    if (shut) return;
    shut = true;
    tags.classList.remove('is-in');
    tags.style.pointerEvents = 'none';
    setTimeout(() => tags.remove(), 160);
    clone.remove();
    veil.classList.remove('is-in');
    removeEventListener('scroll', close, true);
    document.removeEventListener('pointerdown', outside, true);
    document.removeEventListener('touchmove', still);
    // Le voile reste un instant pour absorber la fin du toucher : rien dessous n'est activé.
    const ev = ['click', 'touchend', 'contextmenu'];
    ev.forEach(k => document.addEventListener(k, swallow, { capture: true, passive: false }));
    setTimeout(() => {
      veil.remove();
      ev.forEach(k => document.removeEventListener(k, swallow, true));
    }, 450);
  };
  tags.addEventListener('click', e => onPick(e.target.closest('button')));
  setTimeout(() => {
    if (shut) return;
    addEventListener('scroll', close, true);
    document.addEventListener('pointerdown', outside, true);
  }, 50);
  return { close, isShut: () => shut };
}

// Ouvre le menu sur la carte `card` ; renvoie le suivi du doigt resté posé (glisser puis relâcher sur une action).
function openMenu(card, r, done) {
  navigator.vibrate?.(10);
  const parts = buildMenu(card, r, card.getBoundingClientRect());
  const btns = [...parts.tags.querySelectorAll('button')];
  const at = (x, y) =>
    btns.find(b => {
      const q = b.getBoundingClientRect();
      return x >= q.left - 6 && x <= q.right + 6 && y >= q.top - 4 && y <= q.bottom + 4;
    });
  const pick = b => {
    if (!b || b.disabled || guard.isShut()) return;
    guard.close();
    run(r.id, b.dataset.a, done);
  };
  const guard = guardMenu(parts, pick);

  let start = null,
    moved = false;
  return {
    move(x, y) {
      if (!start) start = [x, y];
      else if (Math.hypot(x - start[0], y - start[1]) > 14) moved = true;
      const hot = moved ? at(x, y) : null;
      btns.forEach(b => b.classList.toggle('is-hot', b === hot));
    },
    // Relâcher sans avoir glissé ne déclenche rien (évite une action involontaire après l'appui long).
    up(x, y) {
      btns.forEach(b => b.classList.remove('is-hot'));
      if (moved) pick(at(x, y));
    },
  };
}

// Branche l'appui long sur les cartes de `rows` ; rowOf(id) donne l'intervention, done() redessine la liste.
export function bindPress(rows, rowOf, done) {
  if (S.me.role === 'client') return;
  rows.querySelectorAll('a.card[data-id]').forEach(card => {
    const r = rowOf(card.dataset.id);
    if (card._press || !r || !menuActs(r).length) return;
    card._press = true;
    let tm = null,
      ctl = null,
      x0 = 0,
      y0 = 0,
      fired = false;
    const stop = () => {
      clearTimeout(tm);
      tm = null;
    };
    card.addEventListener('pointerdown', e => {
      fired = false;
      x0 = e.clientX;
      y0 = e.clientY;
      stop();
      tm = setTimeout(() => {
        tm = null;
        fired = true;
        try {
          card.setPointerCapture(e.pointerId);
        } catch {
          /* pointeur déjà relâché */
        }
        ctl = openMenu(card, r, done);
      }, HOLD_MS);
    });
    card.addEventListener('pointermove', e => {
      if (tm && Math.hypot(e.clientX - x0, e.clientY - y0) > 8) stop();
      ctl?.move(e.clientX, e.clientY);
    });
    card.addEventListener('pointerup', e => {
      stop();
      ctl?.up(e.clientX, e.clientY);
      ctl = null;
    });
    card.addEventListener('pointercancel', () => {
      stop();
      ctl?.up(-1, -1);
      ctl = null;
    });
    card.addEventListener(
      'click',
      e => {
        if (!fired) return;
        fired = false;
        e.preventDefault();
        e.stopImmediatePropagation();
      },
      true
    );
    card.addEventListener('contextmenu', e => e.preventDefault());
  });
}
