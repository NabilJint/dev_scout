import type { ToolWithAnalysis } from '@/lib/supabase/types'

interface ToolScreenshotProps {
  tool: ToolWithAnalysis
}

export function ToolScreenshot({ tool }: ToolScreenshotProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle">
      {/* Window Chrome */}
      <div className="flex items-center gap-2 bg-n-800 px-4 py-2">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-negative" />
          <div className="h-3 w-3 rounded-full bg-warning" />
          <div className="h-3 w-3 rounded-full bg-positive" />
        </div>
        <div className="flex-1 text-center text-xs text-text-muted">{tool.name}</div>
        <div className="w-12" />
      </div>

      {/* Code Editor Content */}
      <div className="relative bg-n-900 p-4">
        <div className="flex gap-4">
          {/* File Tree Sidebar */}
          <div className="hidden w-40 space-y-1 md:block">
            <div className="mb-2 text-xs font-medium text-text-muted">lib</div>
            <div className="ml-3 space-y-1 text-xs">
              <div className="text-text-secondary">components</div>
              <div className="ml-3 text-text-muted">app.tsx</div>
              <div className="ml-3 text-text-muted">index.css</div>
              <div className="text-text-secondary">utils</div>
              <div className="ml-3 text-text-muted">types.ts</div>
              <div className="ml-3 text-text-muted">helpers.ts</div>
            </div>
            <div className="mt-2 text-xs text-text-secondary">.gitignore</div>
            <div className="text-xs text-text-secondary">next.config.js</div>
            <div className="text-xs text-text-secondary">package.json</div>
          </div>

          {/* Code Editor Area */}
          <div className="flex-1 font-mono text-xs leading-relaxed">
            <div className="flex items-center gap-4 border-b border-n-700 pb-2 mb-3">
              <span className="text-text-muted">file.tsx</span>
              <span className="text-text-muted">App.tsx</span>
            </div>
            <div className="space-y-1">
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">1</span>
                <span className="text-primary">function</span>
                <span className="text-positive ml-1">Dashboard</span>
                <span className="text-text-muted">() {'{'}</span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">2</span>
                <span className="text-text-muted ml-4">const [data, setData] = useState(null);</span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">3</span>
                <span className="text-text-muted ml-4"></span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">4</span>
                <span className="text-primary ml-4">useEffect</span>
                <span className="text-text-muted">(() =&gt; {'{'}</span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">5</span>
                <span className="text-warning ml-8">fetch</span>
                <span className="text-text-muted">(&apos;/api/data&apos;)</span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">6</span>
                <span className="text-text-muted ml-12">.then(res =&gt; res.json())</span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">7</span>
                <span className="text-text-muted ml-12">.then(setData)</span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">8</span>
                <span className="text-text-muted ml-4">{'}'}</span>
                <span className="text-text-muted ml-2">, []);</span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">9</span>
                <span className="text-text-muted ml-4"></span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">10</span>
                <span className="text-primary ml-4">return</span>
                <span className="text-text-muted ml-1">(</span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">11</span>
                <span className="text-text-muted ml-8">&lt;div className=&quot;dashboard&quot;&gt;</span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">12</span>
                <span className="text-text-muted ml-12">&lt;h1&gt;Dashboard&lt;/h1&gt;</span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">13</span>
                <span className="text-text-muted ml-12">&lt;Chart data={'{data}'} /&gt;</span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">14</span>
                <span className="text-text-muted ml-8">&lt;/div&gt;</span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">15</span>
                <span className="text-text-muted ml-4">);</span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">16</span>
                <span className="text-text-muted">{'}'}</span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">17</span>
                <span className="text-text-muted"></span>
              </div>
              <div className="flex">
                <span className="w-8 text-right text-text-muted mr-4">18</span>
                <span className="text-primary">export default</span>
                <span className="text-text-muted ml-1">Dashboard;</span>
              </div>
            </div>
          </div>

          {/* AI Chat Panel */}
          <div className="hidden w-64 border-l border-n-700 pl-4 lg:block">
            <div className="mb-3 flex items-center gap-2 text-xs text-text-muted">
              <span className="font-medium text-text-secondary">CHAT</span>
              <span>COMPOSER</span>
            </div>
            <div className="space-y-3">
              <div className="rounded-lg bg-n-700 p-3 text-xs text-text-secondary">
                How can I improve this component?
              </div>
              <div className="rounded-lg bg-primary/10 p-3 text-xs text-text-secondary">
                Here&apos;s an improved version with better error handling and loading states:
              </div>
              <div className="mt-2 flex justify-center">
                <button className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover">
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
