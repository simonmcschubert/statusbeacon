import { Routes, Route, Link } from 'react-router-dom'
import { useEffect } from 'react'
import { Activity } from 'lucide-react'
import StatusPage from './pages/StatusPage'
import { MonitorDetailPage } from './pages/MonitorDetailPage'
import { AuthProvider } from './contexts/AuthContext'
import { ConfigProvider, useConfig } from './contexts/ConfigContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/admin/LoginPage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminStatusPage } from './pages/admin/AdminStatusPage'
import { AdminMonitorDetailPage } from './pages/admin/AdminMonitorDetailPage'

function AppContent() {
  const { config } = useConfig()
  
  useEffect(() => {
    // Always follow system preference
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    
    const updateTheme = (e: MediaQueryListEvent | MediaQueryList) => {
      const newTheme = e.matches ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', newTheme)
    }
    
    // Set initial theme
    updateTheme(mediaQuery)
    
    // Listen for system theme changes
    mediaQuery.addEventListener('change', updateTheme)
    
    return () => mediaQuery.removeEventListener('change', updateTheme)
  }, [])
  
  // Get app title from config or use default
  const appTitle = config?.app?.title || 'Status Page'

  return (
    <Routes>
      {/* Public status page */}
      <Route
        path="/"
        element={
          <div className="min-h-screen bg-background flex flex-col">
            <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
              <div className="max-w-4xl mx-auto px-6 py-4">
                <Link 
                  to="/" 
                  className="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors"
                >
                  <Activity className="h-6 w-6" />
                  <h1 className="text-xl font-semibold">{appTitle}</h1>
                </Link>
              </div>
            </header>

            <main className="flex-1">
              <StatusPage />
            </main>

            <footer className="border-t border-border bg-card">
              <div className="max-w-4xl mx-auto px-6 py-4">
                <p className="text-sm text-muted-foreground text-center">
                  Powered by Status Page
                </p>
              </div>
            </footer>
          </div>
        }
      />
      <Route
        path="/monitor/:id"
        element={
          <div className="min-h-screen bg-background flex flex-col">
            <header className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-sm">
              <div className="max-w-4xl mx-auto px-6 py-4">
                <Link 
                  to="/" 
                  className="inline-flex items-center gap-2 text-foreground hover:text-primary transition-colors"
                >
                  <Activity className="h-6 w-6" />
                  <h1 className="text-xl font-semibold">{appTitle}</h1>
                </Link>
              </div>
            </header>

            <main className="flex-1">
              <MonitorDetailPage />
            </main>

            <footer className="border-t border-border bg-card">
              <div className="max-w-4xl mx-auto px-6 py-4">
                <p className="text-sm text-muted-foreground text-center">
                  Powered by Status Page
                </p>
              </div>
            </footer>
          </div>
        }
      />

      {/* Admin routes */}
      <Route path="/admin/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminStatusPage />} />
        <Route path="status/:id" element={<AdminMonitorDetailPage />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <ConfigProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ConfigProvider>
  )
}

export default App
