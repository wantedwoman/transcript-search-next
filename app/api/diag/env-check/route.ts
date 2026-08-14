import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    hasCRON_SECRET: !!process.env.CRON_SECRET,
    cronSecretLength: process.env.CRON_SECRET?.length,
    cronSecretPrefix: process.env.CRON_SECRET?.slice(0, 8),
    hasTELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
    telegramBotTokenLength: process.env.TELEGRAM_BOT_TOKEN?.length,
    telegramBotTokenPrefix: process.env.TELEGRAM_BOT_TOKEN?.slice(0, 10),
    hasSUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasOPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  });
}
