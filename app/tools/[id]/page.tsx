import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getToolById, getTools, getRelatedTools } from '@/lib/supabase/queries/tools'
import type { ToolWithAnalysis } from '@/lib/supabase/types'
import { HeroSection } from '@/components/tool-details/hero-section'
import { AIScoreCard } from '@/components/tool-details/ai-score-card'
import { MetadataRow } from '@/components/tool-details/metadata-row'
import { ToolScreenshot } from '@/components/tool-details/tool-screenshot'
import { AISummary } from '@/components/tool-details/ai-summary'
import { KeyFeatures } from '@/components/tool-details/key-features'
import { ProsCons } from '@/components/tool-details/pros-cons'
import { BestFor } from '@/components/tool-details/best-for'
import { Integrations } from '@/components/tool-details/integrations'
import { RelatedTools } from '@/components/tool-details/related-tools'
import { ScoreBreakdown } from '@/components/tool-details/score-breakdown'
import { AIConfidence } from '@/components/tool-details/ai-confidence'
import { SourceBreakdown } from '@/components/tool-details/source-breakdown'
import { QuickActions } from '@/components/tool-details/quick-actions'
import { ToolInformation } from '@/components/tool-details/tool-information'
import { NewsletterSection } from '@/components/tool-details/newsletter-section'

interface ToolDetailsPageProps {
  params: Promise<{ id: string }>
}

export default async function ToolDetailsPage({ params }: ToolDetailsPageProps) {
  const { id } = await params

  // Fetch tool from Supabase
  const tool: ToolWithAnalysis | null = await getToolById(id) as unknown as ToolWithAnalysis | null

  if (!tool) {
    notFound()
  }

  // Fetch related tools — try pgvector first, fall back to category-based
  let relatedTools: ToolWithAnalysis[] = []
  const analysis = tool.tool_analyses

  if (analysis?.embedding) {
    try {
      const embedding: number[] = JSON.parse(analysis.embedding)
      const related = await getRelatedTools(tool.id, embedding)

      if (related.length > 0) {
        // Fetch full ToolWithAnalysis data for each related tool
        const fetched = await Promise.all(
          related.map(async (r) => {
            const t = await getToolById(r.tool_id)
            return t
          })
        )
        relatedTools = fetched.filter((t): t is ToolWithAnalysis => t !== null)
      }
    } catch (e) {
      console.warn('Failed to parse embedding or fetch related tools, falling back to category:', e)
    }
  }

  // Fallback to category-based if no embedding or no related results
  if (relatedTools.length === 0 && analysis?.category) {
    relatedTools = await getTools({
      category: analysis.category,
      analyzedOnly: true,
      limit: 5,
    }) as unknown as ToolWithAnalysis[]
    relatedTools = relatedTools.filter(t => t.id !== id)
  }

  return (
    <div className="flex flex-1 flex-col">
      <section className="py-8">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6">
          {/* Breadcrumb */}
          <nav className="mb-6 text-sm text-text-muted">
            <Link href="/" className="hover:text-text-secondary">Home</Link>
            <span className="mx-2">/</span>
            <span>{tool.tool_analyses?.category || 'Tools'}</span>
            <span className="mx-2">/</span>
            <span className="text-text-secondary">{tool.name}</span>
          </nav>

          {/* Hero Section with Score Card */}
          <div className="mb-8 flex flex-col gap-8 lg:flex-row">
            <div className="min-w-0 flex-1">
              <HeroSection tool={tool} />
            </div>
            <div className="shrink-0 lg:w-[320px]">
              <AIScoreCard tool={tool} />
            </div>
          </div>

          {/* Tool Screenshot */}
          <div className="mb-8">
            <ToolScreenshot tool={tool} />
          </div>

          {/* Metadata Row */}
          <div className="mb-8">
            <MetadataRow tool={tool} />
          </div>

          {/* Two Column Layout */}
          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Main Content */}
            <div className="min-w-0 flex-1 space-y-8">
              <AISummary tool={tool} />
              <KeyFeatures tool={tool} />
              <ProsCons tool={tool} />
              <BestFor tool={tool} />
              <Integrations tool={tool} />
              <RelatedTools tools={relatedTools} />
            </div>

            {/* Sidebar */}
            <div className="flex w-full shrink-0 flex-col gap-6 lg:sticky lg:top-24 lg:h-fit lg:w-[320px]">
              <ScoreBreakdown />
              <AIConfidence />
              <SourceBreakdown />
              <QuickActions websiteUrl={tool.website_url || tool.tool_sources.listing_url} />
              <ToolInformation tool={tool} />
            </div>
          </div>

          {/* Newsletter Section */}
          <div className="mt-8">
            <NewsletterSection />
          </div>
        </div>
      </section>
    </div>
  )
}
