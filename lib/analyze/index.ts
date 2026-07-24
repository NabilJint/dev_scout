import 'server-only';
import crypto from 'crypto';

import { analyzeTool, generateEmbedding } from './analyze-tool';
import { buildResearchDoc } from './research-doc';
import { getPendingAnalysisTools, getToolsWithoutEmbeddings } from '@/lib/supabase/queries/tools';
import { upsertAnalysis, getAnalysisByToolId, updateAnalysis } from '@/lib/supabase/queries/analyses';
import { updateToolAnalyzedAt } from '@/lib/supabase/queries/tools';
import { computeComplexityScore } from './schema';
import { logInfo, logStageStart, logStageEnd } from '@/lib/supabase/queries/logs';
import { createPipelineRun, completePipelineRun, failPipelineRun } from '@/lib/supabase/queries/pipeline-runs';
import type { InsertAnalysisParams } from '@/lib/supabase/types';
import type { StageLogEntry } from '@/lib/scrape/types';

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
  stages?: StageLogEntry[];
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
  pipelineRunId?: string;
  trigger?: 'manual' | 'cron' | 'scheduler' | 'analysis';
} = {}): Promise<AnalysisSummary> {
  const pipelineRunId = options.pipelineRunId ?? crypto.randomUUID();
  const trigger = options.trigger ?? 'analysis';
  const startTime = performance.now();

  // Create pipeline run tracking entry
  try {
    await createPipelineRun({
      run_id: pipelineRunId,
      trigger,
      status: 'started',
    });
    console.log(`📊 [Analysis] Pipeline run created: ${pipelineRunId} (trigger: ${trigger})`);
  } catch (err) {
    console.warn(`  ⚠️  [Analysis] Failed to create pipeline run entry: ${err}`);
    // Non-fatal — analysis still runs
  }
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
  const stages: StageLogEntry[] = [];

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

      // -- RESEARCH DOC stage (enriches analysis with website, docs, pricing, and GitHub README) --
      let researchDoc: string | null = null;
      if (tool.website_url) {
        researchDoc = await buildResearchDoc({
          toolId: tool.id,
          toolName: tool.name,
          websiteUrl: tool.website_url,
        });
        if (researchDoc) {
          console.log(`  ✅ [ResearchDoc] Research document ready for "${tool.name}"`);
        }
      }

      // -- AI_ANALYSIS stage --
      const analysisStageStart = await logStageStart('AI_ANALYSIS', { toolId: tool.id, toolName: tool.name }, pipelineRunId);
      const result = await analyzeTool(tool.id, tool.name, tool.raw_text, researchDoc);

      if (result.success && result.analysis) {
        const analysisEnd = performance.now();
        await logStageEnd(analysisStageStart, { status: 'completed', metadata: { rating: result.analysis.toolRatingLabel, adoption: result.analysis.adoptionLabel }, pipelineRunId });
        stages.push({
          ...analysisStageStart.entry,
          status: 'completed',
          endTime: analysisEnd,
          durationMs: Math.round(analysisEnd - analysisStageStart.entry.startTime),
        });

        // -- SAVE stage --
        const saveStageStart = await logStageStart('SAVE', { toolId: tool.id, toolName: tool.name }, pipelineRunId);
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

          const saveEnd = performance.now();
          await logStageEnd(saveStageStart, { status: 'completed', pipelineRunId });
          stages.push({
            ...saveStageStart.entry,
            status: 'completed',
            endTime: saveEnd,
            durationMs: Math.round(saveEnd - saveStageStart.entry.startTime),
          });

          analyzed++;
          details.push({ toolId: tool.id, toolName: tool.name, status: 'analyzed' });
          console.log(`  ✅ [Analysis] Analyzed: ${tool.name} (adoption: ${result.analysis.adoptionLabel}, rating: ${result.analysis.toolRatingLabel})`);
        } catch (dbError) {
          const saveEnd = performance.now();
          const errorMsg = dbError instanceof Error ? dbError.message : 'DB save error';
          await logStageEnd(saveStageStart, { status: 'failed', error: errorMsg, pipelineRunId });
          stages.push({
            ...saveStageStart.entry,
            status: 'failed',
            endTime: saveEnd,
            durationMs: Math.round(saveEnd - saveStageStart.entry.startTime),
            error: errorMsg,
          });
          failed++;
          details.push({ toolId: tool.id, toolName: tool.name, status: 'failed', error: errorMsg });
          console.error(`  ❌ [Analysis] Failed to save analysis for ${tool.name}: ${errorMsg}`);
        }
      } else {
        const analysisEnd = performance.now();
        const errorMsg = result.error || 'Unknown error';
        await logStageEnd(analysisStageStart, { status: 'failed', error: errorMsg, pipelineRunId });
        stages.push({
          ...analysisStageStart.entry,
          status: 'failed',
          endTime: analysisEnd,
          durationMs: Math.round(analysisEnd - analysisStageStart.entry.startTime),
          error: errorMsg,
        });
        failed++;
        details.push({ toolId: tool.id, toolName: tool.name, status: 'failed', error: errorMsg });
        console.error(`  ❌ [Analysis] Failed: ${tool.name} — ${errorMsg}`);
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

  const summary: AnalysisSummary = { status, checked: total, analyzed, skipped, failed, totalDuration, details, stages };

  console.log(`\n📊 [Analysis] Pipeline complete: ${analyzed} analyzed, ${failed} failed, ${skipped} skipped (${totalDuration}ms)`);
  console.log(`📊 [Analysis] Summary: ${JSON.stringify(summary, null, 2)}`);

  // Update pipeline run with completion status
  try {
    if (status === 'failed') {
      await failPipelineRun(pipelineRunId, 'Analysis pipeline failed', { status, checked: total, analyzed, skipped, failed, totalDuration } as unknown as Record<string, unknown>);
    } else {
      await completePipelineRun(pipelineRunId, { status, checked: total, analyzed, skipped, failed, totalDuration } as unknown as Record<string, unknown>);
    }
  } catch (err) {
    console.warn(`  ⚠️  [Analysis] Failed to update pipeline run: ${err}`);
    // Non-fatal
  }

  try {
    await logInfo('Analysis pipeline completed', {
      summary: { status, checked: total, analyzed, skipped, failed, totalDuration },
      pipelineRunId,
    }, pipelineRunId);
  } catch {
    // non-critical
  }

  return summary;
}
