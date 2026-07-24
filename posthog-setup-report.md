# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into DevScout AI. Client-side tracking is initialized via `instrumentation-client.ts` using Next.js 16's instrumentation API, with a reverse proxy through `/ingest` to avoid ad blockers. A shared server-side PostHog client (`lib/posthog-server.ts`) tracks pipeline operations. Clerk-authenticated users are automatically identified in PostHog via a `PostHogUserIdentifier` component mounted in the root layout.

| Event name | Description | File |
|---|---|---|
| `category_filtered` | User clicks a category filter pill on the home page. | `components/category-filter.tsx` |
| `tool_card_clicked` | User clicks on a tool card to view its detail page. | `components/tool-card.tsx` |
| `tool_website_visited` | User clicks 'Visit Official Website' from the tool detail quick actions. | `components/tool-details/quick-actions.tsx` |
| `newsletter_subscribed` | User submits the newsletter subscription form on the tool detail page. | `components/tool-details/newsletter-section.tsx` |
| `scrape_pipeline_completed` | Server-side: a manual scrape pipeline run finished (success or failure). | `app/api/scrape/route.ts` |
| `analysis_pipeline_completed` | Server-side: an AI analysis pipeline run finished (success or failure). | `app/api/analyze/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard**: [Analytics basics (wizard)](https://us.posthog.com/project/525857/dashboard/1896696)
- **Insight**: [Tool card clicks over time (wizard)](https://us.posthog.com/project/525857/insights/8pp6hCa0)
- **Insight**: [Category filter breakdown (wizard)](https://us.posthog.com/project/525857/insights/hcnPGeXq)
- **Insight**: [Tool website visits (wizard)](https://us.posthog.com/project/525857/insights/JxRUXymM)
- **Insight**: [Discovery-to-website funnel (wizard)](https://us.posthog.com/project/525857/insights/qGrVsVJk)
- **Insight**: [Newsletter subscriptions (wizard)](https://us.posthog.com/project/525857/insights/4LpR89aU)

## Verify before merging

- [ ] Run a full production build (`npm run build`) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN` and `NEXT_PUBLIC_POSTHOG_HOST` to `.env.example` and any monorepo/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.
- [ ] Confirm the returning-visitor path also calls `identify` — the `PostHogUserIdentifier` component runs `posthog.identify()` on every page load when Clerk reports the user as signed in, so returning sessions are covered automatically. Verify this with the PostHog debug panel (`?__posthog_debug=true`) after signing in.
- [ ] This project connects to Supabase, Clerk, and OpenAI. Run `npx @posthog/wizard warehouse` to connect these data sources to PostHog's data warehouse for enriched analytics.

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.
