import { NextRequest } from 'next/server';
import { getAudit } from '@/lib/db';
import { progressMap } from '@/lib/progress';

/**
 * GET /api/audits/:id/stream — SSE progress stream
 * Sends progress events while the audit is running.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auditId = parseInt(id, 10);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(data: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      // Check every 500ms for progress updates
      let lastTimestamp = 0;
      const interval = setInterval(() => {
        const progress = progressMap.get(auditId);

        if (progress && progress.timestamp > lastTimestamp) {
          lastTimestamp = progress.timestamp;
          send({ step: progress.step, detail: progress.detail });

          // If complete or error, send final update and close
          if (progress.step === 'complete' || progress.step === 'error') {
            const audit = getAudit(auditId);
            if (audit) {
              send({
                step: progress.step,
                detail: progress.detail,
                overallScore: audit.overall_score,
                status: audit.status,
              });
            }
            clearInterval(interval);
            progressMap.delete(auditId);
            controller.close();
          }
        }
      }, 500);

      // Safety timeout — close after 5 minutes
      setTimeout(() => {
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      }, 300000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
