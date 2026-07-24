import { Suspense } from 'react'
import Link from 'next/link'
import { getTools } from '@/lib/supabase/queries/tools'
import type { ToolWithAnalysis } from '@/lib/supabase/types'
import { CategoryFilter } from '@/components/category-filter'
import { ToolGrid } from '@/components/tool-grid'
import { EmptyState } from '@/components/empty-state'

interface HomePageProps {
  searchParams: Promise<{ category?: string }>
}

const categories = ['All', 'AI Tools', 'Developer Tools', 'Backend', 'Frontend', 'Database', 'DevOps', 'Productivity', 'Security', 'Cloud']

// Filter pill → analysis category mapping (in-memory, supports multi-category pills)
const pillToAnalysisCategories: Record<string, string[] | undefined> = {
  'All': undefined,
  'AI Tools': ['AI Coding'],
  'Developer Tools': ['Email', 'ORM'],
  'Backend': ['Backend'],
  'Frontend': ['Deployment'],
  'Database': ['Database'],
  'DevOps': ['DevOps'],
  'Productivity': ['Monitoring'],
  'Security': ['Authentication'],
  'Cloud': ['Cloud'],
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams
  const category = params.category || 'All'

  // Fetch all analyzed tools, then filter in-memory for multi-category pill support
  let tools: ToolWithAnalysis[] = []
  try {
    tools = await getTools({
      analyzedOnly: true,
      limit: 50,
      curationStatus: ['curated', 'reviewed', 'auto-suggested'],
    }) as unknown as ToolWithAnalysis[]

    console.log('🟢 [HomePage] Supabase getTools returned:', tools.length, 'tools')
    if (tools.length > 0) {
      console.log('📊 [HomePage] First tool:', JSON.stringify(tools[0], null, 2))
    } else {
      console.log('⚠️ [HomePage] Supabase returned 0 tools — EmptyState will render')
    }
  } catch (err) {
    console.error('🔴 [HomePage] Supabase getTools ERROR:', err)
  }

  // Apply category filter in-memory (supports multi-category filter pills)
  if (category !== 'All' && tools.length > 0) {
    const allowedCategories = pillToAnalysisCategories[category]
    if (allowedCategories) {
      tools = tools.filter(t => allowedCategories.includes(t.tool_analyses?.category ?? ''))
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Category Filter — directly below header */}
      <div className="border-b border-[#1f2937] bg-[#111827] py-3">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6 lg:px-8">
          <Suspense fallback={<div className="h-9" />}>
            <CategoryFilter categories={categories} activeCategory={category} />
          </Suspense>
        </div>
      </div>

      {/* Main Content */}
      <section className="flex-1 py-6">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6">
          {/* Section Header */}
          <div className="mb-5 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-[#f9fafb]">
              {category === 'All' ? 'Top Developer Tools' : category}
            </h1>
            <Link
              href="/tools"
              className="text-sm font-medium text-[#6366f1] hover:text-[#818cf8]"
            >
              View All Tools &rarr;
            </Link>
          </div>

          {/* Tool Grid or Empty State */}
          {tools.length > 0 ? (
            <ToolGrid tools={tools} />
          ) : (
            <EmptyState />
          )}
        </div>
      </section>
    </div>
  )
}
