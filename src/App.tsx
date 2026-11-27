import React, { useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { LoginPage } from './pages/LoginPage'
import { AppShell } from './components/layout/AppShell'
import { registerVisibilitySessionRefresh } from './lib/sessionManager'
import { Loader2 } from 'lucide-react'

const AppContent: React.FC = () => {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F7] dark:bg-[#000000] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-[#3A5245]/10 dark:bg-[#3A5245]/25 text-[#3A5245] dark:text-[#F5F5F7] flex items-center justify-center shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <p className="text-xs font-semibold text-[#1D1D1F]/60 dark:text-[#F5F5F7]/60">
            Cargando Mis Décimos...
          </p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <LoginPage />
  }

  return <AppShell />
}

export const App: React.FC = () => {
  useEffect(() => {
    return registerVisibilitySessionRefresh()
  }, [])

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  )
}
