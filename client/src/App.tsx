import { Routes, Route, Link } from 'react-router-dom'
import { useEffect } from 'react'
import StatusPage from './pages/StatusPage'
import { MonitorDetailPage } from './pages/MonitorDetailPage'
import './styles/App.css'

function App() {
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

  return (
    <div className="app">
      <header className="app-header">
        <div className="container">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            <h1>Status Page</h1>
          </Link>
        </div>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<StatusPage />} />
          <Route path="/monitor/:id" element={<MonitorDetailPage />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <div className="container">
          <p>Powered by Status Page</p>
        </div>
      </footer>
    </div>
  )
}

export default App
