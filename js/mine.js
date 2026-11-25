// Bulle « mes interventions » (mobile), comme l'appli tech : panneau du bas avec les interventions que j'ai prises.
import { sb } from './sb.js';
import { S, isMine } from './state.js';
import { cardOf, COLS } from './list.js';

export async function openMine() {
  if (document.getElementById('minesheet')) return;
  const { data } = await sb
    .from('interventions')
    .select(COLS)
    .eq('status', 'prise_en_charge')
    .eq('assignee_id', S.me.id)
    .order('created_at', { ascending: false });
  const rows = (data || []).filter(isMine);
  const sh = document.createElement('div');
  sh.id = 'minesheet';
  sh.innerHTML = `<div class="ms__bk"></div><div class="ms__pn" role="dialog" aria-label="Mes interventions">
    <div class="ms__hd"><b>Mes interventions</b><span class="ms__n">${rows.length}</span><button type="button" class="ms__x" aria-label="Fermer">×</button></div>
    <div class="ms__ls">${rows.length ? `<ul class="cards">${rows.map(cardOf).join('')}</ul>` : '<p class="ms__em">Aucune intervention prise.</p>'}</div></div>`;
  const close = () => {
    sh.classList.remove('is-on');
    setTimeout(() => sh.remove(), 200);
  };
  sh.addEventListener('click', e => {
    if (e.target.closest('a.card')) return close(); // le lien ouvre la fiche
    if (e.target.closest('.ms__x') || e.target.classList.contains('ms__bk')) close();
  });
  document.body.append(sh);
  requestAnimationFrame(() => sh.classList.add('is-on'));
}
