import React from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { AppShell } from './components/layout/AppShell'
import { Loader2 } from 'lucide-react'

const AppContent: React.FC = () => {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-cream flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-lottery-50 text-lottery flex items-center justify-center shadow-sm">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <p className="text-xs font-semibold text-gray-600">Cargando MisDecimos...</p>
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
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
