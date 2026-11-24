// Compteurs du feed (total, miens, pastilles Urgentes / Importantes / À faire).
// Calculés ici, à part de la liste : ils sont identiques sur toutes les pages (header et barre du bas).
import { sb } from './sb.js';
import { S } from './state.js';

const LEVELS = [
  ['haute', 'Urgentes'],
  ['normale', 'Importantes'],
  ['basse', 'À faire'],
];
const level = r => (['haute', 'urgente'].includes(r.priority) ? 'haute' : r.priority === 'basse' ? 'basse' : 'normale');
const pills = rows =>
  LEVELS.map(([k, label]) => {
    const n = rows.filter(r => level(r) === k).length;
    return `<span class="pb pb--${k}${n ? '' : ' pb--zero'}" title="${label}" aria-label="${n} ${label.toLowerCase()}">${n}</span>`;
  }).join('');

let last = null; // derniers compteurs connus, repeints à chaque affichage de la barre
const mine = r =>
  r.status === 'prise_en_charge' &&
  r.assignee_id === S.me.id &&
  (S.me.real !== 'admin' || !r.assignee_role || r.assignee_role === S.me.role);

export function paintCounts() {
  if (!last) return;
  const set = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v || '';
  };
  set('tabn', last.total);
  set('tabm', last.mine);
  set('fabm', last.mine);
  document.dispatchEvent(new Event('labo:counts'));
  const head = document.querySelector('.topbar .pcnt');
  if (head) head.innerHTML = `<span class="pbs">${last.pills}</span><span class="pcn">${last.total}</span>`;
}

export async function loadCounts() {
  if (!S.me || S.me.role === 'client') return;
  const { data } = await sb
    .from('interventions')
    .select('id, status, priority, assignee_id, assignee_role')
    .in('status', ['publiee', 'prise_en_charge'])
    .limit(1000);
  if (!data) return;
  last = { total: data.length, mine: data.filter(mine).length, pills: pills(data) };
  paintCounts();
}
