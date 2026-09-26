import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely. This is the ONLY way sessions/
// submissions/results get read or written (those tables have RLS enabled
// with zero anon policies — see supabase/migrations/002_ai_matching_schema.sql).
// Never import this file from a "use client" component; `server-only`
// throws at build time if that happens.
//
// Built lazily (on first real call) rather than at module load: Next.js
// evaluates route modules during its build-time "collect page data" step
// even when no request is ever made, so an eager createClient() call here
// would hard-fail the production build the moment SUPABASE_SERVICE_ROLE_KEY
// is unset — including in environments that never hit these routes yet.
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase admin client is missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set."
    );
  }

  cached = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
