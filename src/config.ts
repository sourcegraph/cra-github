import { readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { config } from 'dotenv';
import { z } from 'zod';

// Load environment variables
config();

// Single source of truth: Zod schema for config validation
const ConfigSchema = z.object({
  github: z.object({
    base_url: z.string(),
    token: z.string().optional(),
    check_name: z.string(),
    webhook_secret: z.string().optional(),
  }),
  queue: z.object({
    max_workers: z.coerce.number(),
    max_queue_size: z.coerce.number(),
    retry_after_seconds: z.coerce.number(),
  }),
  reviewer: z.object({
    ignore: z.array(z.string()),
  }).optional(),

  server: z.object({
    port: z.string(),
    debug: z.string(),
  }),
  amp: z.object({
    command: z.string(),
    server_url: z.string(),
    settings: z.record(z.any()).optional(),
    prompt_template: z.string(),
  }),
});

// Export the inferred type as the single source of truth
export type Config = z.infer<typeof ConfigSchema>;

class ConfigLoader {
  private static instance: ConfigLoader;
  private config: Config;

  private constructor() {
    const configFile = readFileSync('config.yml', 'utf8');
    const rawConfig = yaml.load(configFile);
    const processedConfig = this.processEnvVars(rawConfig);
    this.config = ConfigSchema.parse(processedConfig);
  }

  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader();
    }
    return ConfigLoader.instance;
  }

  getConfig(): Config {
    return this.config;
  }

  private processEnvVars(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return obj.replace(/\$\{([^}]+)\}/g, (_, envVarExpr) => {
        const [envVar, defaultValue] = envVarExpr.split(':-');
        const value = process.env[envVar];
        if (value) {
          return value;
        } else if (defaultValue !== undefined) {
          return defaultValue;
        } else {
          console.warn(`Environment variable ${envVar} not found, keeping placeholder`);
          return `\${${envVar}}`;
        }
      });
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.processEnvVars(item));
    }
    if (obj && typeof obj === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.processEnvVars(value);
      }
      return result;
    }
    return obj;
  }
}

export const getConfig = () => ConfigLoader.getInstance().getConfig();
