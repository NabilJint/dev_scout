import 'server-only';

import { analyzeTool, generateEmbedding } from './analyze-tool';
import { getPendingAnalysisTools, getToolsWithoutEmbeddings } from '@/lib/supabase/queries/tools';
import { upsertAnalysis, getAnalysisByToolId, updateAnalysis } from '@/lib/supabase/queries/analyses';
import { updateToolAnalyzedAt } from '@/lib/supabase/queries/tools';
import { computeComplexityScore } from './schema';
import { logInfo } from '@/lib/supabase/queries/logs';
import type { InsertAnalysisParams } from '@/lib/supabase/types';

export interface AnalysisSummary {
  status: 'completed' | 'partial' | 'failed';
  checked: number;
  analyzed: number;
  skipped: number;
  failed: number;
  totalDuration: number;
  details: Array<{
    toolId: string;
    toolName: string;
    status: 'analyzed' | 'skipped' | 'failed';
    error?: string;
  }>;
}
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function backfillEmbeddings(): Promise<void> {
  console.log(`\n  🔄 [Embedding] Checking for tools needing embedding backfill...`);
  const backfillTools = await getToolsWithoutEmbeddings(50);

  if (backfillTools.length > 0) {
    console.log(`  📊 [Embedding] Found ${backfillTools.length} tools needing embedding backfill`);

    for (const tool of backfillTools) {
      const analysis = await getAnalysisByToolId(tool.id);
      if (!analysis) continue;

      try {
        const textToEmbed = `${analysis.category} ${analysis.summary}`;
        const embedding = await generateEmbedding(textToEmbed);
        await updateAnalysis(tool.id, { embedding });
        console.log(`  ✅ [Embedding] Backfilled embedding for ${tool.name}`);
      } catch (_error) {
        console.warn(`  ⚠️ [Embedding] Backfill failed for ${tool.name}`);
      }

      await sleep(500);
    }
  } else {
    console.log(`  ✅ [Embedding] No tools need embedding backfill`);
  }
}

function getBatchSize(): number {
  const envVal = process.env.ANALYSIS_BATCH_SIZE;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 5;
}

export async function runAnalysisPipeline(options: {
  limit?: number;
  toolIds?: string[];
} = {}): Promise<AnalysisSummary> {
  const startTime = performance.now();
  const batchSize = getBatchSize();

  // Always run embedding backfill first, regardless of pending tools
  await backfillEmbeddings();

  console.log('🤖 [Analysis] Starting analysis pipeline...');

  const pendingLimit = options.limit || 50;
  const pendingTools = await getPendingAnalysisTools(pendingLimit);

  let filteredTools = pendingTools;
  if (options.toolIds && options.toolIds.length > 0) {
    const idSet = new Set(options.toolIds);
    filteredTools = pendingTools.filter(t => idSet.has(t.id));
    console.log(`  🔍 [Analysis] Filtered to ${filteredTools.length} of ${pendingTools.length} pending tools by requested toolIds`);
  }

  if (filteredTools.length === 0) {
    const duration = Math.round(performance.now() - startTime);
    console.log('  ℹ️  [Analysis] No pending tools to analyze');
    return {
      status: 'completed',
      checked: 0,
      analyzed: 0,
      skipped: 0,
      failed: 0,
      totalDuration: duration,
      details: [],
    };
  }

  console.log(`  📊 [Analysis] Found ${filteredTools.length} pending tools to analyze`);

  const total = filteredTools.length;
  const numBatches = Math.ceil(total / batchSize);
  let analyzed = 0;
  let skipped = 0;
  let failed = 0;
  const details: AnalysisSummary['details'] = [];

  for (let batchNum = 0; batchNum < numBatches; batchNum++) {
    const startIdx = batchNum * batchSize;
    const endIdx = Math.min(startIdx + batchSize, total);
    const batch = filteredTools.slice(startIdx, endIdx);

    console.log(`  📊 Processing batch ${batchNum + 1}/${numBatches}: tools ${startIdx + 1}-${endIdx} of ${total}`);

    for (const tool of batch) {
      if (!tool.raw_text || tool.raw_text.trim().length === 0) {
        skipped++;
        details.push({ toolId: tool.id, toolName: tool.name, status: 'skipped', error: 'No raw text available' });
        console.log(`  ⏭️  [Analysis] Skipped: ${tool.name} — no raw text`);
        continue;
      }
      console.log(`  🔍 [Analysis] Analyzing: ${tool.name}...`);
      const result = await analyzeTool(tool.id, tool.name, tool.raw_text);

      if (result.success && result.analysis) {
        try {
          // Generate embedding
          let embedding: number[] | undefined;
          try {
            const textToEmbed = `${result.analysis.category} ${result.analysis.summary}`;
            embedding = await generateEmbedding(textToEmbed);
            console.log(`  ✅ [Embedding] Generated embedding for ${tool.name}`);
          } catch (_embedError) {
            console.warn(`  ⚠️ [Embedding] Failed for ${tool.name}, analysis will save without embedding. Backfill later.`);
            // Non-fatal — analysis still saves, embedding will be backfilled
          }

          const analysisParams: InsertAnalysisParams = {
            tool_id: tool.id,
            subtitle: '',
            summary: result.analysis.summary,
            adoption_score: result.analysis.adoptionScore,
            adoption_label: result.analysis.adoptionLabel,
            tool_rating_label: result.analysis.toolRatingLabel,
            beginner_friendly_percentage: result.analysis.beginnerFriendlyPercentage,
            balanced_percentage: result.analysis.balancedPercentage,
            power_user_percentage: result.analysis.powerUserPercentage,
            complexity_score: computeComplexityScore(result.analysis),
            confidence: result.analysis.confidence,
            main_purpose: result.analysis.mainPurpose,
            category: result.analysis.category,
            target_users: result.analysis.targetUsers,
            key_features: result.analysis.keyFeatures,
            pros: result.analysis.pros,
            cons: result.analysis.cons,
            pricing_model: result.analysis.pricingModel,
            integrations: result.analysis.integrations,
            best_for: result.analysis.bestFor,
            marketing_buzzwords: result.analysis.marketingBuzzwords,
            rating_notes: result.analysis.ratingNotes,
            disclaimer: result.analysis.disclaimer,
            model: 'minimaxai/minimax-m3',
            ...(embedding !== undefined ? { embedding } : {}),
          };

          await upsertAnalysis(analysisParams);
          await updateToolAnalyzedAt({ id: tool.id, analyzed_at: new Date().toISOString() });

          analyzed++;
          details.push({ toolId: tool.id, toolName: tool.name, status: 'analyzed' });
          console.log(`  ✅ [Analysis] Analyzed: ${tool.name} (adoption: ${result.analysis.adoptionLabel}, rating: ${result.analysis.toolRatingLabel})`);
        } catch (dbError) {
          failed++;
          const errorMsg = dbError instanceof Error ? dbError.message : 'DB save error';
          details.push({ toolId: tool.id, toolName: tool.name, status: 'failed', error: errorMsg });
          console.error(`  ❌ [Analysis] Failed to save analysis for ${tool.name}: ${errorMsg}`);
        }
      } else {
        failed++;
        details.push({ toolId: tool.id, toolName: tool.name, status: 'failed', error: result.error || 'Unknown error' });
        console.error(`  ❌ [Analysis] Failed: ${tool.name} — ${result.error}`);
      }

      await sleep(500);
    }
  }

  const totalDuration = Math.round(performance.now() - startTime);

  let status: AnalysisSummary['status'] = 'completed';
  if (failed === total) {
    status = 'failed';
  } else if (failed > 0 || skipped > 0) {
    status = 'partial';
  }

  const summary: AnalysisSummary = { status, checked: total, analyzed, skipped, failed, totalDuration, details };

  console.log(`\n📊 [Analysis] Pipeline complete: ${analyzed} analyzed, ${failed} failed, ${skipped} skipped (${totalDuration}ms)`);
  console.log(`📊 [Analysis] Summary: ${JSON.stringify(summary, null, 2)}`);

  try {
    await logInfo('Analysis pipeline completed', {
      summary: { status, checked: total, analyzed, skipped, failed, totalDuration },
    });
  } catch {
    // non-critical
  }

  return summary;
}
