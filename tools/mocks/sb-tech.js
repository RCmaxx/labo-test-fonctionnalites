const now = Date.now(), h = n => new Date(now - n * 3600e3).toISOString();
const mk = (id, title, loc, st, pr, ago, x = {}) => ({ id, title, location: loc, status: st, priority: pr, created_at: h(ago), created_by: 'u1', assignee_id: null, assignee_role: null, description: '', client_presence: false, resolved_at: null, validated_at: null, remind_minutes: null, available_from: null, available_until: null, proposed_to: null, assigned_by: null, org_id: 'o1', ...x });
const rows = [
  mk(1, "Plus d'eau chaude", 'MH 121', 'publiee', 'haute', 40, { client_presence: true }),
  mk(2, 'Ampoule grillée', 'MH 200', 'publiee', 'normale', 20),
  mk(3, "Plus d'elec et porte ne ferme pas bien", 'MH 45', 'publiee', 'basse', 150, { client_presence: true }),
  mk(4, "Plus d'eau chaude dans la cuisine", 'MH 75', 'prise_en_charge', 'haute', 70, { assignee_id: 'u1', assignee_role: 'technicien' }),
  mk(5, 'Test lieu', 'Réception', 'prise_en_charge', 'normale', 90, { assignee_id: 'u1', assignee_role: 'technicien' }),
  mk(6, 'Détecteur de fumée HS', 'MH 34', 'resolue', 'normale', 30, { resolved_at: h(3), assignee_id: 'u1', assignee_role: 'technicien' }),
];
const ev = [
 { id: 1, intervention_id: 4, type: 'creee', body: '', actor_id: 'u1', actor_name: 'Léa', actor_role: 'reception', created_at: h(70) },
 { id: 2, intervention_id: 4, type: 'commentaire', body: 'Je passe voir cet après-midi.', actor_id: 'u1', actor_name: 'Thomas', actor_role: 'technicien', created_at: h(5) },
 { id: 3, intervention_id: 4, type: 'commentaire', body: 'Merci !', actor_id: 'u2', actor_name: 'Léa', actor_role: 'reception', created_at: h(4) },
];
const tables = { intervention_events: ev, intervention_photos: [], intervention_reads: [], interventions: rows, members: [{ user_id: 'u1', full_name: 'Thomas', email: 't@x.fr', role: 'technicien', acting_role: null, org_id: 'o1', created_at: h(500) }], organizations: [{ id: 'o1', name: 'Labo test' }] };
const q = t => { const F = []; const o = {};
  ['select','not','order','limit','gte','lte','or','ilike','range','filter','match','lt','gt','insert','update','delete','upsert','contains','textSearch'].forEach(k => o[k] = () => o);
  o.eq = (c, v) => { F.push(r => String(r[c]) === String(v)); return o; };
  o.neq = (c, v) => { F.push(r => String(r[c]) !== String(v)); return o; };
  o.in = (c, v) => { F.push(r => v.map(String).includes(String(r[c]))); return o; };
  o.is = (c, v) => { F.push(r => (r[c] ?? null) === v); return o; };
  const get = () => (tables[t] || []).filter(r => F.every(f => f(r)));
  o.maybeSingle = o.single = () => Promise.resolve({ data: get()[0] || null, error: null });
  o.then = (ok, ko) => Promise.resolve({ data: get(), error: null }).then(ok, ko); return o; };
const ch = { on() { return ch; }, subscribe() { return ch; }, unsubscribe() {} };
const user = { id: 'u1', email: 't@x.fr' };
export const sb = {
  auth: { getSession: async () => ({ data: { session: { user, access_token: 'x' } } }), getUser: async () => ({ data: { user } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}) },
  from: q, rpc: async () => ({ data: null, error: null }), channel: () => ch, removeChannel() {}, storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }), createSignedUrl: async () => ({ data: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
};
export const APP_URL = location.origin + location.pathname;
