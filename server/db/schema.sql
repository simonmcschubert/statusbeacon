-- Create config table
CREATE TABLE IF NOT EXISTS config (
  id SERIAL PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create monitors table
CREATE TABLE IF NOT EXISTS monitors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  "group" VARCHAR(255),
  type VARCHAR(50) NOT NULL,
  url TEXT NOT NULL,
  public BOOLEAN DEFAULT true,
  config JSONB,
  conditions JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create checks table
CREATE TABLE IF NOT EXISTS checks (
  id SERIAL PRIMARY KEY,
  monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL,
  response_time_ms INTEGER,
  checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT,
  condition_results JSONB
);

-- Create incidents table
CREATE TABLE IF NOT EXISTS incidents (
  id SERIAL PRIMARY KEY,
  monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  status VARCHAR(50) NOT NULL,
  severity VARCHAR(20) DEFAULT 'major',
  title VARCHAR(255),
  description TEXT,
  suppressed_by_maintenance BOOLEAN DEFAULT false
);

-- Create maintenance_windows table
CREATE TABLE IF NOT EXISTS maintenance_windows (
  id SERIAL PRIMARY KEY,
  monitor_id INTEGER REFERENCES monitors(id) ON DELETE CASCADE,
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  description TEXT,
  timezone VARCHAR(100) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create status_history table
CREATE TABLE IF NOT EXISTS status_history (
  id SERIAL PRIMARY KEY,
  monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  uptime_percentage DECIMAL(5,2),
  avg_response_time_ms INTEGER,
  total_checks INTEGER,
  successful_checks INTEGER,
  failed_checks INTEGER,
  UNIQUE(monitor_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_checks_monitor_id ON checks(monitor_id);
CREATE INDEX IF NOT EXISTS idx_checks_checked_at ON checks(checked_at);
-- Composite index for frequent queries filtering by monitor_id and time range
CREATE INDEX IF NOT EXISTS idx_checks_monitor_checked_at ON checks(monitor_id, checked_at);
CREATE INDEX IF NOT EXISTS idx_incidents_monitor_id ON incidents(monitor_id);
CREATE INDEX IF NOT EXISTS idx_incidents_started_at ON incidents(started_at);
CREATE INDEX IF NOT EXISTS idx_status_history_monitor_date ON status_history(monitor_id, date);
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_times ON maintenance_windows(start_time, end_time);

-- ============================================
-- Admin UI Tables (added for open source release)
-- ============================================

-- Users table (single admin for now)
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Settings table (single row, org-specific data)
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  app JSONB DEFAULT '{}',           -- title, description, logo_url, timezone, noindex
  notifications JSONB DEFAULT '{}', -- webhook_url, cooldown, template
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Refresh tokens for JWT auth
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Insert default settings row if not exists
INSERT INTO settings (id, app, notifications)
VALUES (1, '{}', '{}')
ON CONFLICT (id) DO NOTHING;
