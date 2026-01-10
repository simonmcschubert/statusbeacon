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
  details TEXT,
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
  total_checks INTEGER,
  failed_checks INTEGER,
  UNIQUE(monitor_id, date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_checks_monitor_id ON checks(monitor_id);
CREATE INDEX IF NOT EXISTS idx_checks_checked_at ON checks(checked_at);
CREATE INDEX IF NOT EXISTS idx_incidents_monitor_id ON incidents(monitor_id);
CREATE INDEX IF NOT EXISTS idx_incidents_started_at ON incidents(started_at);
CREATE INDEX IF NOT EXISTS idx_status_history_monitor_date ON status_history(monitor_id, date);
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_times ON maintenance_windows(start_time, end_time);
