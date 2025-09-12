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
    settings: z.object({
      'amp.url': z.string(),
    }),
    prompt_template: z.string(),
  }),
});

// Export the inferred type as the single source of truth
export type Config = z.infer<typeof ConfigSchema>;

class ConfigLoader {
  private static instance: ConfigLoader;
  private config: Config;

  private constructor(configPath = 'config.yml') {
    const configFile = readFileSync(configPath, 'utf8');
    const rawConfig = yaml.load(configFile);
    const processedConfig = this.processEnvVars(rawConfig);
    this.config = ConfigSchema.parse(processedConfig);
  }

  static getInstance(configPath?: string): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader(configPath);
    }
    return ConfigLoader.instance;
  }

  getConfig(): Config {
    return this.config;
  }

  private processEnvVars(obj: unknown): unknown {
    if (typeof obj === 'string') {
      return obj.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
        const value = process.env[envVar];
        if (value) {
          return value;
        } else {
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

export const getConfig = (configPath?: string) => ConfigLoader.getInstance(configPath).getConfig();
