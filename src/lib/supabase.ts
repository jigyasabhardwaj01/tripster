import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  // Throwing here (rather than silently degrading) surfaces missing env vars
  // immediately instead of as a confusing runtime fetch failure later.
  console.warn(
    "Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
  );
}

// Single client, safe to use in both server and client components: the anon
// key is public by design and RLS policies (supabase/schema.sql) scope access.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
