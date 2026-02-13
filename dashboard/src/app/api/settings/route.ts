import { NextRequest, NextResponse } from 'next/server';
import { getSettings, setSetting } from '@/lib/db';

/**
 * GET /api/settings — Get all settings
 */
export async function GET() {
  const settings = getSettings();
  // Mask sensitive values
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (key.includes('password') || key.includes('apiKey') || key.includes('Key')) {
      masked[key] = value ? '••••••••' + value.slice(-4) : '';
    } else {
      masked[key] = value;
    }
  }
  return NextResponse.json(masked);
}

/**
 * POST /api/settings — Update settings
 * Body: { key: string, value: string }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { key, value } = body;

  if (!key) {
    return NextResponse.json({ error: 'Key is required' }, { status: 400 });
  }

  const allowedKeys = [
    'pageSpeedApiKey',
    'gscKeyFile',
    'dataforseoLogin',
    'dataforseoPassword',
    'keApiKey',
  ];

  if (!allowedKeys.includes(key)) {
    return NextResponse.json({ error: `Invalid setting key: ${key}` }, { status: 400 });
  }

  setSetting(key, value);
  return NextResponse.json({ ok: true });
}
