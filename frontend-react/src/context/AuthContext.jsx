import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabasePromise } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still resolving, null = resolved (no session), object = signed in
  const [session,    setSession]    = useState(undefined)
  // true once the Supabase client resolves to a non-null value
  const [configured, setConfigured] = useState(false)

  // Store the resolved client so signIn/signUp/signOut can reference it
  // synchronously without the promise chain
  const sbRef = useRef(null)

  useEffect(() => {
    let sub = null

    supabasePromise.then(sb => {
      sbRef.current = sb
      setConfigured(!!sb)

      if (!sb) {
        // Supabase not configured — guest mode
        setSession(null)
        return
      }

      // Hydrate session from existing cookie/token
      sb.auth.getSession().then(({ data }) => {
        setSession(data.session ?? null)
      })

      // Keep session in sync with Supabase auth state changes
      const { data: { subscription } } = sb.auth.onAuthStateChange((_event, s) => {
        setSession(s ?? null)
      })
      sub = subscription
    })

    // Cleanup: unsubscribe when the component unmounts
    return () => sub?.unsubscribe()
  }, [])

  const signIn  = (email, password) =>
    sbRef.current?.auth.signInWithPassword({ email, password })

  const signUp  = (email, password) =>
    sbRef.current?.auth.signUp({ email, password })

  const signOut = () =>
    sbRef.current?.auth.signOut()

  const user = session?.user ?? null

  return (
    <AuthContext.Provider value={{
      session,
      user,
      signIn,
      signUp,
      signOut,
      configured,                      // true = Supabase is live; false = guest mode
      loading: session === undefined,  // true while /api/config is still resolving
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
