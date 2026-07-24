// app/api/enrich/route.ts
// POST /api/enrich — Manual enrichment trigger.
// Requires x-devscout-admin-secret header.
// Fetches tools missing website_url or with null raw_text and runs enrichment.
// Returns a summary of what was enriched.

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminSecret } from '@/lib/scrape/middleware';
import { createServerClient } from '@/lib/supabase/client';
import { enrichTool, sleep } from '@/lib/enrichment';
import type { Tool } from '@/lib/supabase/types';

export async function POST(request: NextRequest) {
  // 1. Verify admin secret
  const auth = verifyAdminSecret(request);
  if (!auth.valid) {
    return NextResponse.json({ success: false, error: auth.error }, { status: 401 });
  }

  try {
    // 2. Fetch tools that need enrichment
    const supabase = await createServerClient();

    const { data: tools, error } = await supabase
      .from('tools')
      .select('*')
      .or('website_url.is.null,raw_text.is.null')
      .order('scraped_at', { ascending: false })
      .limit(50)
      .overrideTypes<Tool[], { merge: false }>();

    if (error) {
      console.error('[Enrich] Error fetching tools for enrichment:', error);
      return NextResponse.json(
        { success: false, error: `Failed to fetch tools: ${error.message}` },
        { status: 500 }
      );
    }

    const pendingTools = (tools as Tool[]) || [];
    if (pendingTools.length === 0) {
      return NextResponse.json({
        success: true,
        summary: {
          checked: 0,
          enriched: 0,
          failed: 0,
          skipped: 0,
          details: [],
          message: 'No tools pending enrichment',
        },
      });
    }

    console.log(`[Enrich] Found ${pendingTools.length} tools pending enrichment`);

    const details: Array<{
      toolId: string;
      toolName: string;
      status: 'enriched' | 'skipped' | 'failed';
      error?: string;
    }> = [];

    let enriched = 0;
    let skipped = 0;
    let failed = 0;

    for (const tool of pendingTools) {
      const websiteUrl = tool.website_url;
      if (!websiteUrl) {
        skipped++;
        details.push({ toolId: tool.id, toolName: tool.name, status: 'skipped', error: 'No website_url' });
        console.log(`  ⏭️  [Enrich] Skipped: ${tool.name} — no website_url`);
        continue;
      }

      console.log(`  🔍 [Enrich] Enriching: ${tool.name} (${websiteUrl})`);

      try {
        const result = await enrichTool({
          name: tool.name,
          websiteUrl,
        });

        if (result.content) {
          // Update the tool record with enriched data
          const updateData: Record<string, string | null> = {};
          if (result.content.rawText.length > 200) {
            updateData.raw_text = result.content.rawText;
          }
          if (result.content.ogImage && !tool.image_url) {
            updateData.image_url = result.content.ogImage;
          }

          if (Object.keys(updateData).length > 0) {
            const { error: updateError } = await supabase
              .from('tools')
              .update(updateData)
              .eq('id', tool.id);

            if (updateError) {
              console.error(`    ❌ [Enrich] Failed to update ${tool.name}: ${updateError.message}`);
              failed++;
              details.push({ toolId: tool.id, toolName: tool.name, status: 'failed', error: updateError.message });
              continue;
            }
          }

          enriched++;
          details.push({ toolId: tool.id, toolName: tool.name, status: 'enriched' });
          console.log(`    ✅ [Enrich] Enriched: ${tool.name} (source: ${result.content.source}, ${result.content.rawText.length} chars)`);
        } else {
          skipped++;
          details.push({ toolId: tool.id, toolName: tool.name, status: 'skipped', error: 'No content fetched' });
          console.log(`    ⏭️  [Enrich] Skipped: ${tool.name} — no content fetched`);
        }
      } catch (err) {
        failed++;
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        details.push({ toolId: tool.id, toolName: tool.name, status: 'failed', error: errorMsg });
        console.error(`    ❌ [Enrich] Error enriching ${tool.name}: ${errorMsg}`);
      }

      // Rate limit between requests
      await sleep(500);
    }

    return NextResponse.json({
      success: true,
      summary: {
        checked: pendingTools.length,
        enriched,
        failed,
        skipped,
        details,
      },
    });
  } catch (err) {
    console.error('[Enrich] Pipeline error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
