import fs from 'fs';
import yaml from 'js-yaml';
import { AppConfigSchema, type AppConfig } from './schemas/app.schema.js';
import { MonitorsConfigSchema, type MonitorsConfig } from './schemas/monitors.schema.js';

export class ConfigLoader {
  private static appConfig: AppConfig | null = null;
  private static monitorsConfig: MonitorsConfig | null = null;

  static loadAppConfig(path: string = process.env.CONFIG_PATH || './config/config.yml'): AppConfig {
    try {
      const fileContents = fs.readFileSync(path, 'utf8');
      const data = yaml.load(fileContents);
      
      const validatedConfig = AppConfigSchema.parse(data);
      this.appConfig = validatedConfig;
      
      console.log('✅ App config loaded and validated');
      return validatedConfig;
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ Failed to load app config:', error.message);
      }
      throw error;
    }
  }

  static loadMonitorsConfig(path: string = process.env.MONITORS_PATH || './config/monitors.yml'): MonitorsConfig {
    try {
      const fileContents = fs.readFileSync(path, 'utf8');
      const data = yaml.load(fileContents);
      
      const validatedConfig = MonitorsConfigSchema.parse(data);
      this.monitorsConfig = validatedConfig;
      
      console.log(`✅ Monitors config loaded: ${validatedConfig.monitors.length} monitors`);
      return validatedConfig;
    } catch (error) {
      if (error instanceof Error) {
        console.error('❌ Failed to load monitors config:', error.message);
      }
      throw error;
    }
  }

  static getAppConfig(): AppConfig {
    if (!this.appConfig) {
      return this.loadAppConfig();
    }
    return this.appConfig;
  }

  static getMonitorsConfig(): MonitorsConfig {
    if (!this.monitorsConfig) {
      return this.loadMonitorsConfig();
    }
    return this.monitorsConfig;
  }

  static reloadConfigs() {
    console.log('🔄 Reloading configurations...');
    this.appConfig = null;
    this.monitorsConfig = null;
    this.loadAppConfig();
    this.loadMonitorsConfig();
  }
}
