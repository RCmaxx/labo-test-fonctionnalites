import { S, PNAME } from './state.js';

// Couleur propre à chaque profil dans le tchat : rang du prénom dans l'équipe, jamais deux fois la même jusqu'à 14 membres.
const PCOL = [
  '#2F7FE0',
  '#E5484D',
  '#2EA44F',
  '#F2802E',
  '#8E4EC6',
  '#E93D82',
  '#12A594',
  '#8D5B3E',
  '#A3D133',
  '#1F3A93',
  '#5BC8E8',
  '#B5179E',
  '#6B7280',
  '#7D7A12',
];
const PLIGHT = ['#A3D133', '#5BC8E8'];
const shade = (h, k) =>
  '#' +
  [1, 3, 5]
    .map(i =>
      Math.round(parseInt(h.slice(i, i + 2), 16) * k)
        .toString(16)
        .padStart(2, '0')
    )
    .join('');
const SIMULATED = ['directeur', 'technicien', 'responsable_tech', 'reception'];

let cache = { team: null, names: [] };
const teamNames = () => {
  if (cache.team === S.team) return cache.names;
  const names = [];
  const add = n => {
    n = String(n || '')
      .trim()
      .toLowerCase();
    if (n && !names.includes(n)) names.push(n);
  };
  (S.team || []).forEach(m => (m.role === 'admin' ? SIMULATED.forEach(k => add(PNAME[k])) : add(m.full_name)));
  cache = { team: S.team, names };
  return names;
};

/** Couleurs { bg, fg } de l'étiquette de prénom d'un profil. */
export function pcolor(name) {
  const k = String(name || '')
    .trim()
    .toLowerCase();
  let i = teamNames().indexOf(k);
  if (i < 0) {
    let h = 0;
    for (const c of k) h = (h * 31 + c.codePointAt(0)) >>> 0;
    i = h;
  }
  const bg = PCOL[(i + PCOL.length - 1) % PCOL.length];
  return { bg, fg: PLIGHT.includes(bg) ? shade(bg, 0.24) : '#fff' };
}
