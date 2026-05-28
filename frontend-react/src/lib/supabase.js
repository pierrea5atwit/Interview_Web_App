import { createClient } from '@supabase/supabase-js'

// On HuggingFace Spaces, Vite runs during the Docker build stage —
// Space secrets aren't available then, so import.meta.env vars are empty.
// Instead we fetch the public credentials from the FastAPI backend at runtime,
// where env vars ARE available.
//
// Returns a Promise<SupabaseClient | null>.
// null means Supabase isn't configured (guest mode — app still works, no auth).

let _cached = null

export const supabasePromise = (async () => {
  if (_cached !== undefined) return _cached

  // Try VITE_ vars first (works in local dev where you have .env.local)
  const viteUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
  const viteKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

  if (viteUrl && viteKey) {
    _cached = createClient(viteUrl, viteKey)
    return _cached
  }

  // Fall back to runtime fetch (HF Spaces / production)
  try {
    const res = await fetch('/api/config')
    if (!res.ok) throw new Error('config fetch failed')
    const { supabase_url, supabase_anon_key } = await res.json()
    if (supabase_url && supabase_anon_key) {
      _cached = createClient(supabase_url, supabase_anon_key)
      return _cached
    }
  } catch {
    // Silently fall through to guest mode
  }

  _cached = null
  return null
})()

// Synchronous accessor — null until the promise resolves.
// Use supabasePromise.then() in effects, or await it in async contexts.
export let supabase = null
supabasePromise.then(sb => { supabase = sb })
