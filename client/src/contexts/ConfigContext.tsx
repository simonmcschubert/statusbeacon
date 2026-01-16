import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

// UI configuration from config.yml
export interface UIConfig {
  theme?: {
    default_mode?: 'dark' | 'light' | 'auto'
  }
  charts?: {
    show_response_time?: boolean
    show_uptime_bars?: boolean
    default_timeframe?: string
  }
}

export interface AppConfig {
  title?: string
  description?: string
  logo_url?: string
  timezone?: string
  noindex?: boolean
}

export interface FooterLink {
  label: string
  url: string
}

export interface FooterConfig {
  text?: string
  links?: FooterLink[]
}

export interface Config {
  app?: AppConfig
  ui?: UIConfig
  footer?: FooterConfig
}

interface ConfigContextType {
  config: Config | null
  loading: boolean
  error: string | null
}

const ConfigContext = createContext<ConfigContextType>({
  config: null,
  loading: true,
  error: null,
})

export function useConfig() {
  return useContext(ConfigContext)
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchConfig() {
      try {
        const response = await fetch('/api/config')
        if (!response.ok) {
          throw new Error('Failed to fetch config')
        }
        const data = await response.json()
        setConfig(data)
        
        // Update page title if configured
        if (data.app?.title) {
          document.title = data.app.title
        }
      } catch (err) {
        console.error('Failed to load config:', err)
        setError(err instanceof Error ? err.message : 'Failed to load config')
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [])

  return (
    <ConfigContext.Provider value={{ config, loading, error }}>
      {children}
    </ConfigContext.Provider>
  )
}
