import { NextRequest, NextResponse } from 'next/server';
import { getAudit } from '@/lib/db';

/**
 * GET /api/audits/:id/report — Serve the HTML report
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const audit = getAudit(parseInt(id, 10));

  if (!audit || !audit.html_report) {
    return NextResponse.json({ error: 'Report not found' }, { status: 404 });
  }

  return new Response(audit.html_report, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
