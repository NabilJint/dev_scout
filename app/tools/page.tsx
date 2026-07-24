import { getTools } from '@/lib/supabase/queries/tools'
import type { ToolWithAnalysis } from '@/lib/supabase/types'
import { ToolGrid } from '@/components/tool-grid'
import { EmptyState } from '@/components/empty-state'

export const dynamic = 'force-dynamic'

export default async function ToolsPage() {
  let tools: ToolWithAnalysis[] = []
  try {
    tools = await getTools({
      analyzedOnly: true,
      limit: 100,
      curationStatus: ['curated', 'reviewed', 'auto-suggested'],
    }) as unknown as ToolWithAnalysis[]

    console.log('🟢 [ToolsPage] Supabase getTools returned:', tools.length, 'tools')
  } catch (err) {
    console.error('🔴 [ToolsPage] Supabase getTools ERROR:', err)
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Page Header */}
      <div className="border-b border-[#1f2937] bg-[#111827] py-6">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6 lg:px-8">
          <h1 className="text-2xl font-semibold text-[#f9fafb]">All Developer Tools</h1>
          <p className="mt-1 text-sm text-[#9ca3af]">
            {tools.length > 0
              ? `Showing ${tools.length} analyzed tool${tools.length === 1 ? '' : 's'}`
              : 'No tools found yet'}
          </p>
        </div>
      </div>

      {/* Main Content */}
      <section className="flex-1 py-6">
        <div className="mx-auto max-w-[1280px] px-4 md:px-6 lg:px-8">
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