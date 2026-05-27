import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr'

export function createClient(request: Request) {
  const headers = new Headers()
  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY

  const supabase = createServerClient(
    supabaseUrl || "https://missing-supabase-env.supabase.co",
    supabaseKey || "missing-supabase-env",
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('Cookie') ?? '') as {
            name: string
            value: string
          }[]
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            headers.append('Set-Cookie', serializeCookieHeader(name, value, options))
          )
        },
      },
    }
  )

  return { supabase, headers }
}
