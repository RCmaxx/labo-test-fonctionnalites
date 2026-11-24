// Page « Mes interventions » (mobile) : un cercle par intervention prise (MH + numéro, couleur de priorité).
// Un appui ouvre la carte de l'intervention en fenêtre ; un appui sur la carte ouvre la fiche.
import { esc } from './state.js';

const LEVEL = { haute: 'haute', urgente: 'haute', basse: 'basse' };
const label = r => {
  const v = String(r.location || '').trim(),
    m = v.match(/^(?:mobil[- ]?home|mh)?\s*(\d+)$/i);
  return m
    ? `<small>MH</small><b>${esc(String(+m[1]).padStart(2, '0'))}</b>`
    : `<span>${esc(v.length > 9 ? v.slice(0, 8) + '…' : v || '—')}</span>`;
};
const circle = r =>
  `<button type="button" class="circle circle--${LEVEL[r.priority] || 'normale'}" data-id="${esc(r.id)}" aria-label="${esc((r.location || '') + ' — ' + (r.title || ''))}">${label(r)}</button>`;

// cardOf(r) : HTML de la carte, fourni par la liste (même rendu que partout).
export function renderCircles(box, rows, cardOf) {
  box.innerHTML = rows.length
    ? `<div class="circles">${rows.map(circle).join('')}</div>`
    : '<p class="empty">Aucune intervention prise.</p>';
  box.onclick = e => {
    const b = e.target.closest('.circle'),
      r = b && rows.find(x => x.id === b.dataset.id);
    if (!r) return;
    document.querySelector('.cardpop')?.remove();
    const pop = document.createElement('div');
    pop.className = 'cardpop';
    pop.innerHTML = `<div class="cardpop__body"><ul class="cards">${cardOf(r)}</ul></div>`;
    pop.onclick = ev => {
      if (!ev.target.closest('.cardpop__body') || ev.target.closest('a.card')) pop.remove();
    };
    (document.querySelector('.sim #app') || document.body).append(pop);
  };
}
