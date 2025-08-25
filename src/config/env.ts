import { config as loadDotenv } from 'dotenv';

/**
 * Environment configuration utility that works both with and without Docker
 */
class EnvironmentConfig {
  private static instance: EnvironmentConfig;

  private constructor() {
    this.loadEnvironment();
  }

  public static getInstance(): EnvironmentConfig {
    if (!EnvironmentConfig.instance) {
      EnvironmentConfig.instance = new EnvironmentConfig();
    }
    return EnvironmentConfig.instance;
  }

  /**
   * Load environment variables from .env file or use existing process.env
   */
  private loadEnvironment(): void {
    // Load from .env file (dotenv automatically checks if file exists)
    // In Docker, environment variables are passed directly, so this is safe
    loadDotenv();
  }

  /**
   * Get environment variable with optional default value
   */
  public get(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (value === undefined) {
      if (defaultValue !== undefined) {
        return defaultValue;
      }
      throw new Error(`Environment variable ${key} is not defined`);
    }
    return value;
  }

  /**
   * Get environment variable or return undefined if not set
   */
  public getOptional(key: string): string | undefined {
    return process.env[key];
  }

  /**
   * Check if environment variable is set
   */
  public has(key: string): boolean {
    return process.env[key] !== undefined;
  }

  /**
   * Get all environment variables as object
   */
  public getAll(): Record<string, string | undefined> {
    return { ...process.env };
  }
}

// Create singleton instance
const env = EnvironmentConfig.getInstance();

// Export commonly used environment variables
export const config = {
  // Database
  databasePath: env.get('DATABASE_PATH', './data/anime.db'),
  
  // MyAnimeList API
  malClientId: env.getOptional('MAL_CLIENT_ID') || '',
  malClientSecret: env.getOptional('MAL_CLIENT_SECRET') || '',
  
  // Server
  port: parseInt(env.get('PORT', '3001'), 10),
  nodeEnv: env.get('NODE_ENV', 'development'),
  
  // Development flags
  isDevelopment: env.get('NODE_ENV', 'development') === 'development',
  isProduction: env.get('NODE_ENV', 'development') === 'production',
};

export default env;
