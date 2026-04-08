import { z } from 'zod';

const envSchema = z.object({
  OPENROUTER_API_KEY: z.string(),
  OPENAI_API_KEY: z.string(),
  GITHUB_TOKEN: z.string().optional(),
  VERCEL_TOKEN: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse(process.env);

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';