import { Routes, Route, Link } from 'react-router-dom'
import { useEffect, lazy, Suspense } from 'react'
import { Activity } from 'lucide-react'
import StatusPage from './pages/StatusPage'
import { MonitorDetailPage } from './pages/MonitorDetailPage'
import { AuthProvider } from './contexts/AuthContext'
import { ConfigProvider, useConfig } from './contexts/ConfigContext'
import { ProtectedRoute } from './components/ProtectedRoute'

// Lazy load admin pages to reduce initial bundle size
const LoginPage = lazy(() => import('./pages/admin/LoginPage').then(m => ({ default: m.LoginPage })))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout').then(m => ({ default: m.AdminLayout })))
const AdminStatusPage = lazy(() => import('./pages/admin/AdminStatusPage').then(m => ({ default: m.AdminStatusPage })))
const AdminMonitorDetailPage = lazy(() => import('./pages/admin/AdminMonitorDetailPage').then(m => ({ default: m.AdminMonitorDetailPage })))

// Loading fallback for lazy-loaded components
function AdminLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-muted-foreground">Loading...</div>
    </div>
  )
}

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
  const appTitle = config?.app?.title || 'StatusBeacon'
  const footerText = config?.footer?.text || 'Powered by StatusBeacon'
  const footerLinks = config?.footer?.links || []

  return (
    <Routes>
      {/* Public status page */}
      <Route
        path="/"
        element={
          <div className="min-h-screen bg-background flex flex-col">
            <header className="bg-card/80 backdrop-blur-sm">
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

            <footer className="bg-card">
              <div className="max-w-4xl mx-auto px-6 py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    {footerText}
                  </p>
                  {footerLinks.length > 0 && (
                    <nav className="flex items-center gap-4">
                      {footerLinks.map((link, index) => (
                        <a
                          key={index}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </a>
                      ))}
                    </nav>
                  )}
                </div>
              </div>
            </footer>
          </div>
        }
      />
      <Route
        path="/monitor/:id"
        element={
          <div className="min-h-screen bg-background flex flex-col">
            <header className="bg-card/80 backdrop-blur-sm">
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

            <footer className="bg-card">
              <div className="max-w-4xl mx-auto px-6 py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    {footerText}
                  </p>
                  {footerLinks.length > 0 && (
                    <nav className="flex items-center gap-4">
                      {footerLinks.map((link, index) => (
                        <a
                          key={index}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {link.label}
                        </a>
                      ))}
                    </nav>
                  )}
                </div>
              </div>
            </footer>
          </div>
        }
      />

      {/* Admin routes - lazy loaded */}
      <Route path="/admin/login" element={
        <Suspense fallback={<AdminLoading />}>
          <LoginPage />
        </Suspense>
      } />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <Suspense fallback={<AdminLoading />}>
              <AdminLayout />
            </Suspense>
          </ProtectedRoute>
        }
      >
        <Route index element={
          <Suspense fallback={<AdminLoading />}>
            <AdminStatusPage />
          </Suspense>
        } />
        <Route path="status/:id" element={
          <Suspense fallback={<AdminLoading />}>
            <AdminMonitorDetailPage />
          </Suspense>
        } />
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
