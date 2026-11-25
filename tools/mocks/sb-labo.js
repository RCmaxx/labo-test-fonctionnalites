const now = Date.now(), h = n => new Date(now - n * 3600e3).toISOString();
const mk = (id, title, loc, st, pr, ago, extra = {}) => ({ id, title, location: loc, status: st, priority: pr, created_at: h(ago), created_by: 'u1', assignee_id: null, assignee_role: null, description: '', client_presence: false, resolved_at: null, validated_at: null, remind_minutes: null, available_from: null, ...extra });
const rows = [
  mk(1, "Plus d'eau chaude", 'MH 121', 'publiee', 'haute', 40, { client_presence: true }),
  mk(2, 'Ampoule grillée', 'MH 200', 'publiee', 'normale', 20),
  mk(3, "Plus d'elec et porte ne ferme pas bien", 'MH 45', 'publiee', 'basse', 150, { client_presence: true }),
  mk(4, "Plus d'eau chaude dans la cuisine", 'MH 75', 'prise_en_charge', 'haute', 70, { assignee_id: 'u1', assignee_role: 'technicien', description: "Plus d'eau chaude dans toute la cuisine depuis ce matin." }),
  mk(5, 'Test lieu', 'Réception', 'prise_en_charge', 'normale', 90, { assignee_id: 'u1', assignee_role: 'technicien' }),
  mk(6, 'Détecteur de fumée HS', 'MH 34', 'resolue', 'normale', 30, { resolved_at: h(3), assignee_id: 'u1' }),
];
const ev = [
  { id: 1, intervention_id: 4, type: 'creee', body: '', actor_id: 'u1', actor_name: 'Léa', actor_role: 'reception', created_at: h(70) },
  { id: 2, intervention_id: 4, type: 'commentaire', body: 'Je passe voir cet après-midi.', actor_id: 'u1', actor_name: 'Thomas', actor_role: 'technicien', created_at: h(5) },
  { id: 3, intervention_id: 4, type: 'commentaire', body: 'Merci !', actor_id: 'u2', actor_name: 'Léa', actor_role: 'reception', created_at: h(4) },
];
const tables = { interventions: rows, members: [{ user_id: 'u1', full_name: 'Thomas', role: 'technicien', acting_role: null, org_id: 'o1' }], organizations: [{ name: 'Labo test' }], intervention_reads: [], intervention_events: ev, intervention_photos: [] };
const q = t => { let id = null; const o = {};
  const f = () => o; ['select','neq','in','not','order','limit','gte','lte','or','ilike','is','range','filter','match','lt','gt'].forEach(k => o[k] = f);
  o.eq = (c, v) => { if (c === 'id') id = v; return o; };
  const one = () => Promise.resolve({ data: id ? rows.find(r => String(r.id) === String(id)) : tables[t]?.[0] || null, error: null });
  o.maybeSingle = o.single = one;
  o.then = (ok, ko) => Promise.resolve({ data: tables[t] || [], error: null }).then(ok, ko);
  o.insert = o.update = o.delete = o.upsert = f; return o; };
const ch = { on() { return ch; }, subscribe() { return ch; }, unsubscribe() {} };
export const sb = {
  auth: { getSession: async () => ({ data: { session: { user: { id: 'u1', email: 't@x.fr' }, access_token: 'x' } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: async () => ({}), getUser: async () => ({ data: { user: { id: 'u1' } } }) },
  from: q, rpc: async () => ({ data: null, error: null }), channel: () => ch, removeChannel() {}, storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }), createSignedUrl: async () => ({ data: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
};
