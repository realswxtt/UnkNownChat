import { isConfigured } from './supabase/client'
import { AuthProvider, useAuth } from './contexts/AuthContext'

import SetupPage from './pages/SetupPage'
import AuthPage from './pages/AuthPage'
import ChatPage from './pages/ChatPage'

import './index.css'

function AppRouter() {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="center-page">
        <div className="spinner" />
      </div>
    )
  }

  if (!session) return <AuthPage />
  return <ChatPage />
}

export default function App() {
  if (!isConfigured) return <SetupPage />

  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}
