import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Labo : base de test séparée (projet labo-test), jamais la production.
const URL = 'https://saucnzxaispxcvupqzwf.supabase.co';
const KEY = 'sb_publishable_rdI5v5nUwLc_JYbhCVILUg__Xa6uK_s'; // clé publique, protégée par la RLS

export const sb = createClient(URL, KEY);
