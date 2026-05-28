import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabasePromise } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still loading, null = no session, object = signed in
  const [session, setSession] = useState(undefined)
  const sbRef = useRef(null)  // resolved Supabase client

  const unsubRef = useRef(null)  // survives async gap; cleanup can always call it

  useEffect(() => {
    let cancelled = false

    supabasePromise.then(sb => {
      sbRef.current = sb

      if (!sb) {
        if (!cancelled) setSession(null)
        return
      }

      sb.auth.getSession().then(({ data }) => {
        if (!cancelled) setSession(data.session ?? null)
      })

      const { data: { subscription } } = sb.auth.onAuthStateChange((_event, s) => {
        if (!cancelled) setSession(s ?? null)
      })
      unsubRef.current = subscription

      // If the component already unmounted before the promise resolved, clean up now
      if (cancelled) { subscription.unsubscribe(); unsubRef.current = null }
    })

    return () => {
      cancelled = true
      unsubRef.current?.unsubscribe()
      unsubRef.current = null
    }
  }, [])

  const signIn  = (email, password) => sbRef.current?.auth.signInWithPassword({ email, password })
  const signUp  = (email, password) => sbRef.current?.auth.signUp({ email, password })
  const signOut = () => sbRef.current?.auth.signOut()

  const user = session?.user ?? null

  return (
    <AuthContext.Provider value={{
      session,
      user,
      signIn,
      signUp,
      signOut,
      loading: session === undefined,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
