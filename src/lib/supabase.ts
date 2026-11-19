import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.types'

const env = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' ? process.env : {})
const supabaseUrl = env.VITE_SUPABASE_URL || 'https://xmdghpyfrblmtjtevtru.supabase.co'
const supabaseAnonKey =
  env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtZGdocHlmcmJsbXRqdGV2dHJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NjU2NzIsImV4cCI6MjExMDM0MTY3Mn0.W8VjcQB4nV8IPZGCKsAiZEF-xIza_CZMRdw8LY3f-QM'

if (!supabaseAnonKey) {
  console.warn('⚠️ VITE_SUPABASE_ANON_KEY no está configurada en las variables de entorno.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'misdecimos_auth_token'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})
