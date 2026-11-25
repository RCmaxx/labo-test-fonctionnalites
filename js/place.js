import { esc } from './state.js';

export const PIN =
  '<svg class="pin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-4.8 7-11a7 7 0 1 0-14 0c0 6.2 7 11 7 11z"/><circle cx="12" cy="10" r="2.4"/></svg>';
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
const padMH = s => String(s).replace(/^((?:mh|mobil[- ]?home)\s*)(\d)\s*$/i, (_, a, d) => a + '0' + d);
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

const nameList = places => [...new Set([...COMMON, ...places.filter(p => p.num == null).map(p => p.label)])];
const words = (s, sep) => s.toLowerCase().split(sep);

// Lieux proposés d'après le titre (numéro de mobil-home ou nom de lieu).
function fromTitle(title, places) {
  const t = title.toLowerCase();
  if (!t) return [];
  const nums = [...t.matchAll(/(?:mh|mobil[- ]?home)?\s*(\d+)/g)].map(m => m[1]);
  const byNum = places.filter(p => p.num != null && nums.includes(String(p.num))).map(p => p.label);
  const tw = t.split(/[\s'-]+/);
  const close = w =>
    w.length >= 4 && !/^\d+$/.test(w) && tw.some(x => x.length >= 4 && (x.startsWith(w) || w.startsWith(x)));
  const byName = nameList(places).filter(l => l && (t.includes(l.toLowerCase()) || words(l, /[\s'-]+/).some(close)));
  return [...new Set([...byNum, ...byName])];
}

// Lieux proposés pendant la saisie de `v` (déjà en minuscules).
function suggest(v, places) {
  const m = v.match(/^(?:mh|mobil[- ]?home)?\s*(\d+)$/);
  if (m) {
    const digits = m[1];
    const rank = p => {
      const n = String(p.num ?? '');
      return n === digits ? 0 : n.endsWith(digits) ? 1 : n.startsWith(digits) ? 2 : 3;
    };
    return places
      .filter(p => p.num != null && String(p.num).endsWith(digits))
      .sort((x, y) => rank(x) - rank(y) || x.num - y.num)
      .map(p => padMH(p.label))
      .slice(0, digits.length < 2 ? 3 : 4);
  }
  return nameList(places)
    .filter(l => words(l, /[\s'/-]+/).some(w => w.startsWith(v)) || l.toLowerCase().startsWith(v))
    .sort((x, y) => x.toLowerCase().indexOf(v) - y.toLowerCase().indexOf(v))
    .slice(0, v.length < 3 ? 3 : 5);
}

// Étiquette de lieu affichée sur le champ quand il n'est pas en cours de saisie. Rend `syncTag`.
function initTag(loc) {
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
  return syncTag;
}

// Liste de suggestions sous le champ.
function initSuggestions(f, places, syncTag) {
  const loc = f.location,
    ul = f.querySelector('.ac-list');
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
      const hits = fromTitle(f.title.value, places).slice(0, 4);
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
    showHits(suggest(v, places));
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
}

// Champ « Lieu » : saisie assistée (liste de lieux connus), étiquette de lieu et suggestion depuis le titre.
/** Branche le champ Lieu du formulaire `f` ; rend `syncTag` pour rafraîchir l'étiquette après une restauration de brouillon. */
export function initPlaceField(f, placesRes) {
  f.querySelectorAll('[name=priority]').forEach(p => p.addEventListener('change', () => (f.dataset.prio = p.value)));
  f.querySelectorAll('[name=assign]').forEach(c =>
    c.addEventListener('change', () => {
      if (c.checked)
        f.querySelectorAll('[name=assign]').forEach(o => {
          if (o !== c) o.checked = false;
        });
    })
  );
  const syncTag = initTag(f.location);
  initSuggestions(f, placesRes.data || [], syncTag);
  syncTag();
  return { syncTag };
}
