import { createClient } from '@supabase/supabase-js';

export function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase server variables are not configured');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Schema is created once in Supabase SQL Editor. This function keeps the route API stable.
export async function ensureSchema() { return true; }
