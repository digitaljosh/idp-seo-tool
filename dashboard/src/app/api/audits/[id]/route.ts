import { NextRequest, NextResponse } from 'next/server';
import { getAudit, deleteAudit } from '@/lib/db';

/**
 * GET /api/audits/:id — Get audit details
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const audit = getAudit(parseInt(id, 10));
  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  // Parse JSON report if available
  const result: any = { ...audit };
  if (audit.report_json) {
    result.report = JSON.parse(audit.report_json);
    delete result.report_json;
  }
  // Don't send full HTML in JSON response (too large)
  delete result.html_report;

  return NextResponse.json(result);
}

/**
 * DELETE /api/audits/:id — Delete an audit
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteAudit(parseInt(id, 10));
  return NextResponse.json({ ok: true });
}
