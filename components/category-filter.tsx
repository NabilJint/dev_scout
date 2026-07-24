'use client'

import { useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

interface CategoryFilterProps {
  categories: string[]
  activeCategory: string
}

const categoryIcons: Record<string, string> = {
  'All': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  'AI Tools': '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  'Developer Tools': '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  'Backend': '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  'Frontend': '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
  'Database': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  'DevOps': '<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  'Productivity': '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  'Security': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  'Cloud': '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  'Authentication': '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  'Deployment': '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  'Email': '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  'Monitoring': '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  'ORM': '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
}

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const iconPaths = categoryIcons[name]
  if (!iconPaths) return null
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <g dangerouslySetInnerHTML={{ __html: iconPaths }} />
    </svg>
  )
}

export function CategoryFilter({ categories, activeCategory }: CategoryFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const uniqueCategories = useMemo(() => {
    const seen = new Set<string>()
    return categories.filter((c) => {
      if (seen.has(c)) return false
      seen.add(c)
      return true
    })
  }, [categories])

  function handleCategoryClick(category: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (category === 'All') {
      params.delete('category')
    } else {
      params.set('category', category)
    }
    posthog.capture('category_filtered', { category })
    router.push(`/?${params.toString()}`)
  }

  return (
    <div className="relative flex items-center overflow-hidden">
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide flex-1 min-w-0">
        {uniqueCategories.map((category) => {
          const isActive = activeCategory === category
          return (
            <button
              key={category}
              onClick={() => handleCategoryClick(category)}
              className={`flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-gradient-to-r from-[#7c3aed] to-[#3b82f6] text-white border-none'
                  : 'border border-[#1f2937] bg-[#111827] text-[#9ca3af] hover:border-[#374151] hover:text-white'
              }`}
            >
              <CategoryIcon
                name={category}
                className={isActive ? 'text-white' : 'text-[#6b7280]'}
              />
              {category}
            </button>
          )
        })}
      </div>
    </div>
  )
}
