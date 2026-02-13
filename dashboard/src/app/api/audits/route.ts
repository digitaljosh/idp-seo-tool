import { NextRequest, NextResponse } from 'next/server';
import { createAudit, completeAudit, failAudit, listAudits } from '@/lib/db';
import { runDashboardAudit } from '@/lib/audit-runner';
import { getSettings } from '@/lib/db';
import { progressMap } from '@/lib/progress';

/**
 * GET /api/audits — List recent audits
 */
export async function GET() {
  const audits = listAudits(50);
  return NextResponse.json(audits);
}

/**
 * POST /api/audits — Start a new audit
 * Body: { url: string, competitors?: string[], skipPerformance?: boolean, skipGsc?: boolean, skipBacklinks?: boolean, skipKeywords?: boolean }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { url, competitors, skipPerformance, skipGsc, skipBacklinks, skipKeywords } = body;

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  // Create audit record
  const auditId = createAudit(url);

  // Get stored API credentials
  const settings = getSettings();

  // Run audit in background (non-blocking)
  runDashboardAudit({
    url,
    competitors,
    skipPerformance,
    skipGsc: skipGsc || !settings.gscKeyFile,
    gscKeyFile: settings.gscKeyFile,
    pageSpeedApiKey: settings.pageSpeedApiKey,
    dataforseoLogin: settings.dataforseoLogin,
    dataforseoPassword: settings.dataforseoPassword,
    skipBacklinks: skipBacklinks || !settings.dataforseoLogin,
    keApiKey: settings.keApiKey,
    skipKeywords: skipKeywords || !settings.keApiKey,
    onProgress: (step, detail) => {
      progressMap.set(auditId, { step, detail: detail || step, timestamp: Date.now() });
    },
  })
    .then((result) => {
      completeAudit(
        auditId,
        result.report.finalUrl,
        result.report.overallScore,
        JSON.stringify(result.report),
        result.html
      );
      progressMap.set(auditId, { step: 'complete', detail: 'Audit complete', timestamp: Date.now() });
    })
    .catch((err) => {
      failAudit(auditId, err.message || 'Unknown error');
      progressMap.set(auditId, { step: 'error', detail: err.message || 'Unknown error', timestamp: Date.now() });
    });

  return NextResponse.json({ id: auditId, status: 'running' }, { status: 201 });
}
