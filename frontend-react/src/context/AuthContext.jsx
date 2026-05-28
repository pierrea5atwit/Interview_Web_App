import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabasePromise } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // undefined = still loading, null = no session, object = signed in
  const [session, setSession] = useState(undefined)
  const sbRef = useRef(null)  // resolved Supabase client

  useEffect(() => {
    let unsub = null

    supabasePromise.then(sb => {
      sbRef.current = sb

      if (!sb) {
        // Supabase not configured — guest mode, treat as unauthenticated
        setSession(null)
        return
      }

      sb.auth.getSession().then(({ data }) => {
        setSession(data.session ?? null)
      })

      const { data: { subscription } } = sb.auth.onAuthStateChange((_event, s) => {
        setSession(s ?? null)
      })
      unsub = subscription
    })

    return () => { unsub?.unsubscribe() }
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
