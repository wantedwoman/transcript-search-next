import { z } from 'zod';

const envSchema = z.object({
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  SUPABASE_ANON_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL: z.string().optional(),
  GHL_API_KEY: z.string().min(1).optional(),
  GHL_LOCATION_ID: z.string().min(1).optional(),
  GHL_WEBHOOK_SECRET: z.string().optional().default(''),
  CRON_SECRET: z.string().optional().default(''),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_CHAT_ID: z.string().min(1).optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

// During build time, some env vars may not be available (they're set in Vercel)
// Don't crash the build — validate at runtime instead
const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';

const parsed = envSchema.safeParse(process.env);

if (!parsed.success && !isBuildTime) {
  console.error('Invalid environment variables', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables');
}

export const env = parsed.success ? parsed.data : ({} as z.infer<typeof envSchema>);
export const isProd = (parsed.success ? parsed.data.NODE_ENV : process.env.NODE_ENV) === 'production';
export const isDev = (parsed.success ? parsed.data.NODE_ENV : process.env.NODE_ENV) === 'development';