import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    import.meta.env.VITE_SUPABASE_ANON_KEY

  return createBrowserClient(
    supabaseUrl || "https://missing-supabase-env.supabase.co",
    supabaseKey || "missing-supabase-env"
  )
}
