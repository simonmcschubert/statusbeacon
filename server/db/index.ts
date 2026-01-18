import pkg from 'pg';
import { ConfigLoader } from '../config/loader.js';

const { Pool } = pkg;

// Get database URL from config (YAML) or fall back to environment variable
function getDatabaseUrl(): string {
  try {
    const config = ConfigLoader.getAppConfig();
    if (config.database?.url) {
      return config.database.url;
    }
  } catch {
    // Config not loaded yet, use env var
  }
  return process.env.DATABASE_URL || 'postgresql://localhost:5432/statuspage';
}

const pool = new Pool({
  connectionString: getDatabaseUrl(),
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  console.log('Executed query', { text, duration, rows: res.rowCount });
  return res;
};

export const getClient = async () => {
  const client = await pool.connect();
  return client;
};

export default pool;
