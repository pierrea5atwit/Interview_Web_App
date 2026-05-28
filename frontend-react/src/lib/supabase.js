import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const key = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

// Returns a real client when credentials are configured, null otherwise.
// The rest of the app checks for null and degrades gracefully.
export const supabase = url && key ? createClient(url, key) : null
