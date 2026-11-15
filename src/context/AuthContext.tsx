import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database.types'

export type Profile = Database['public']['Tables']['profiles']['Row']

interface AuthContextType {
  session: Session | null
  user: User | null
  profile: Profile | null
  isLoading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Captura y persistencia de deep-links de invitación pendientes
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const searchInvite = url.searchParams.get('invite')
      if (searchInvite) {
        sessionStorage.setItem('pending_invite_token', searchInvite)
      } else {
        // Soporte para rutas tipo /invite/:token o #/invite/:token
        const pathname = window.location.pathname
        const hash = window.location.hash
        const matchPath = pathname.match(/\/invite\/([a-zA-Z0-9_-]+)/)
        const matchHash = hash.match(/invite\/([a-zA-Z0-9_-]+)/)
        const token = matchPath?.[1] || matchHash?.[1]
        if (token) {
          sessionStorage.setItem('pending_invite_token', token)
        }
      }
    } catch (e) {
      console.warn('No se pudo verificar el deep-link de invitación:', e)
    }
  }, [])

  // Cargar perfil desde public.profiles
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error al recuperar perfil de usuario:', error)
      } else if (data) {
        setProfile(data)
      }
    } catch (err) {
      console.error('Excepción al recuperar perfil:', err)
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user?.id) {
      await fetchProfile(user.id)
    }
  }, [user?.id, fetchProfile])

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut()
      setSession(null)
      setUser(null)
      setProfile(null)
    } catch (err) {
      console.error('Error al cerrar sesión:', err)
    }
  }, [])

  useEffect(() => {
    // 1. Obtener sesión activa al cargar
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession)
      setUser(initialSession?.user ?? null)
      if (initialSession?.user?.id) {
        fetchProfile(initialSession.user.id).finally(() => setIsLoading(false))
      } else {
        setIsLoading(false)
      }
    })

    // 2. Suscribirse a cambios de estado de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        setSession(currentSession)
        setUser(currentSession?.user ?? null)

        if (currentSession?.user?.id) {
          await fetchProfile(currentSession.user.id)
        } else {
          setProfile(null)
        }
        setIsLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const value = {
    session,
    user,
    profile,
    isLoading,
    refreshProfile,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider')
  }
  return context
}
