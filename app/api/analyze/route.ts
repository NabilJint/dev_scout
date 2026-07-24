import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAdminSecret } from '@/lib/scrape/middleware';
import { runAnalysisPipeline, type AnalysisSummary } from '@/lib/analyze';
import { getPostHogClient } from '@/lib/posthog-server';

const RequestSchema = z.object({
  limit: z.number().int().positive().optional(),
  toolIds: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  const auth = verifyAdminSecret(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body. Expected { limit?: number, toolIds?: string[] }' },
      { status: 400 }
    );
  }

  const { limit, toolIds } = parsed.data;

  const posthog = getPostHogClient();
  try {
    const summary: AnalysisSummary = await runAnalysisPipeline({ limit, toolIds });
    posthog.capture({
      distinctId: 'server',
      event: 'analysis_pipeline_completed',
      properties: {
        status: summary.status,
        analyzed: summary.analyzed,
        failed: summary.failed,
        skipped: summary.skipped,
      },
    });
    await posthog.flush();
    return NextResponse.json({ success: true, summary });
  } catch (err) {
    console.error('[Analysis] Pipeline error:', err);
    posthog.capture({
      distinctId: 'server',
      event: 'analysis_pipeline_completed',
      properties: { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' },
    });
    await posthog.flush();
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
