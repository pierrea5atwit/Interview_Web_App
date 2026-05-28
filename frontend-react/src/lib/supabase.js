import { createClient } from '@supabase/supabase-js'

/**
 * Fetch Supabase public credentials from the FastAPI backend at runtime.
 *
 * Why not import.meta.env?
 *   Vite bakes VITE_* vars into the bundle at build time. On HuggingFace Spaces
 *   the Docker build stage doesn't have access to Space secrets, so the vars
 *   would always be empty. Fetching from /api/config at runtime reads the
 *   actual secrets injected into the running container.
 *
 * Security: /api/config only returns the *public* anon key, which is safe to
 * expose in the browser — Supabase's Row-Level Security policies enforce
 * actual access control. HF_TOKEN and other sensitive vars are never returned.
 *
 * Resolves to a Supabase client, or null when not configured (guest mode).
 */
export const supabasePromise = fetch('/api/config')
  .then(r => r.ok ? r.json() : {})
  .then(({ supabase_url, supabase_anon_key }) =>
    supabase_url && supabase_anon_key
      ? createClient(supabase_url, supabase_anon_key)
      : null
  )
  .catch(() => null)
