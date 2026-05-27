import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase env eksik: VITE_SUPABASE_URL ve VITE_SUPABASE_PUBLISHABLE_KEY gerekli.")
  }

  return createBrowserClient(supabaseUrl, supabaseKey)
}
