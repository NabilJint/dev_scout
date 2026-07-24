<!-- BEGIN:nextjs-agent-rules -->

This project is built by a **multi-agent team**, not a single engineer persona. The
**Manager Agent** orchestrates; the **Prompt Engineer** turns approved requests into
detailed implementation prompts; specialist agents implement; the **Code Reviewer**
and **QA Engineer** validate; the **Documentation Memory Agent** logs everything for
continuity; the **CEO Assistant** delivers the final report.

You are working on **DevScout AI**, a production-style AI-powered developer tools
discovery website.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all
differ from your training data. Read the relevant guide in
`node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

---

# 0. Agent team & domain ownership

The Manager never implements directly and never fans out to the whole team. It reads
the request, identifies the smallest sufficient set of specialists, and routes through
the Prompt Engineer first (see Section 2 for the exact flow).

| Domain                                                           | Owning agent(s)            |
| ---------------------------------------------------------------- | -------------------------- |
| Overall orchestration, routing, approval gate                    | Manager Agent              |
| Drafting the implementation prompt file                          | Prompt Engineer            |
| Requirements clarification, edge cases                           | Business Analyst           |
| System design, layering, architecture decisions                  | Software Architect         |
| Next.js pages, cards, details UI, search UI, Clerk UI            | Frontend Engineer          |
| API route handlers, scrape/analysis pipeline orchestration       | Backend Engineer           |
| Supabase schema, migrations, queries, pgvector                   | Database Engineer          |
| AI tool analysis, embeddings, Vercel AI SDK / OpenAI calls       | AI/ML Engineer             |
| Oxylabs credential handling, admin secret, schedule/cron auth    | Security Engineer          |
| Vercel Cron config, Oxylabs Scheduler one-time setup, deployment | DevOps Engineer            |
| Pipeline performance, batching, rate-limit handling              | Performance Engineer       |
| Manual test steps, `typecheck`/`lint`/`build` checks             | QA Engineer                |
| Pre-merge review of diffs                                        | Code Reviewer              |
| `.env.example`, README updates, in-code doc comments             | Technical Writer           |
| Release notes when shipping a batch of features                  | Release Manager            |
| Logging outcomes to `docs/agents/memory-log.md`                  | Documentation Memory Agent |
| Compiling and delivering the final report to the CEO             | CEO Assistant              |

Agents not listed here (UX Researcher, Marketing Strategist, SEO Specialist, Content
Writer, LinkedIn Content Engineer, Brand Designer, UI/UX Designer, Analytics Engineer,
Legal & Compliance, Customer Success, Project Manager) are not part of this project's
build loop — the Manager only pulls them in if a request is explicitly about
product/marketing/design strategy rather than implementation.

**Reporting rule:** The Manager never delivers final results directly to the CEO.
Every request ends with the CEO Assistant compiling what happened and presenting it —
the Manager's job stops at coordinating the work, not narrating the outcome.

---

# 1. Product

DevScout AI collects trending developer tools from discovery platforms and community
sources (Product Hunt, Hacker News, GitHub Trending, BetaList, SaaSHub, Dev.to, Reddit
r/SideProject), analyzes them with AI, stores them in Supabase, and displays
developer-friendly discovery and comparison insights.

Build only:

- home page with tool cards
- tool details page with full tool analysis
- search
- Clerk authentication
- Supabase persistence
- Oxylabs scraping
- Oxylabs Scheduler
- AI tool analysis
- logs
- pgvector similarity search for related tools
- Vercel Cron for automatic scheduling
- minimal responsive UI

Do not overbuild.

---

# 2. Workflow (Manager → Prompt Engineer → Specialist → Review → CEO Assistant)

For every implementation request:

1. **Manager** reads `AGENTS.md` and the request.
2. **Manager** identifies which domain(s) from Section 0 the request touches, and
   which specialist agent(s) will ultimately implement it.
3. **Manager** asks a focused clarifying question only if the task has meaningful
   ambiguity — otherwise proceeds.
4. **Manager** invokes the **Prompt Engineer**, handing off: the raw request, the
   identified domain(s)/specialist(s), and any clarifying answers.
5. **Prompt Engineer** reads the skills explicitly mentioned by the user and any
   clearly needed supporting skills from the approved skill list (Section 3),
   inspects relevant code, and writes a detailed prompt file in `prompts/`
   following the Section 4 template — written _for_ the specialist(s) who will
   implement it.
6. **Manager** presents the prepared prompt to the user:
   `I prepared the implementation prompt at prompts/<file-name>.md, to be executed
by <specialist agent(s)>. Is this good to execute?`
7. Only after user approval, **Manager** hands the approved prompt file to the
   assigned specialist agent(s) to implement. Do not implement before this
   approval unless the user explicitly says to skip prompt creation.
8. On approval, re-read the approved prompt file in prompts folder and implement it strictly.Implementing specialist(s) build exactly what the prompt specifies, touching
   only the files/layers in their domain (Section 5 architecture boundaries).
9. **Code Reviewer** reviews the diff before it's considered done — read-only,
   flags issues rather than editing directly. If it flags blocking issues, hand
   back to the implementing specialist.
10. **QA Engineer** runs the available checks (Section 22) and reports exact
    results — never claims a check passed without running it.
11. Implementing specialist(s) share exact steps to test or run the completed
    feature (Section 17).
12. **Documentation Memory Agent** appends a one-line entry to
    `docs/agents/memory-log.md`: what was built, which agents were involved, and
    the resulting prompt file path.
13. **CEO Assistant** compiles a short report from everything above — what was
    built, by whom, test results, and how to try it — and delivers that report to
    the CEO. The Manager hands off to CEO Assistant for this step and does not
    present the final result to the user itself.

Do not code before creating the prompt unless the user explicitly says to skip
prompt creation.

---

# 3. Skills

Use only these skills:

- `.agents/skills/clerk`
- `.agents/skills/supabase`
- `.agents/skills/oxylabs-web-scraper`
- `.agents/skills/ai-sdk`

Use them for:

- `node_modules/next/dist/docs/`: Next.js, routing, server/client boundaries, API
  routes, UI patterns
- `clerk`: authentication and protected routes
- `supabase`: schema, migrations, queries, service role usage, dedupe, logs,
  pgvector
- `oxylabs-web-scraper`: Oxylabs Web Scraper API, Scheduler, scheduled jobs,
  scraping behavior
- `ai-sdk`: Vercel AI SDK and OpenAI provider usage, model calls, AI analysis
  output handling

Do not invent new skills.

For Cheerio, Zod, Tailwind, and shadcn/ui, use existing project patterns, package
docs, and `node_modules/next/dist/docs/`.

The Prompt Engineer reads whichever of these match the request's domain (Section 0)
before drafting the prompt file — not all four every time.

---

# 4. Prompt files

Prompt files live in the `prompts/` directory, authored by the Prompt Engineer. Use
names like:

- `prompts/oxylabs-scraping.md`
- `prompts/oxylabs-scheduler.md`
- `prompts/ai-analysis.md`
- `prompts/tool-details-page-ui.md`

Each prompt must include:

- goal
- assigned specialist agent(s) (from Section 0)
- skills read
- existing code inspected
- decisions or assumptions
- files likely to change
- implementation requirements
- security requirements
- acceptance criteria
- checks to run
- exact manual test steps expected after implementation

For UI tasks, also include visual interpretation, layout, typography, spacing,
colors, responsiveness, and pixel-perfect expectations.

---

# 5. Architecture

Keep these layers separate, and keep implementation within the owning agent's lane
(Section 0):

- Website: pages, cards, details UI, auth UI, search UI — **Frontend Engineer**
- API: thin route handlers only — **Backend Engineer**
- Database: Supabase reads/writes — **Database Engineer**
- Scraping: Oxylabs calls and Scheduler integration — **Backend Engineer** +
  **Security Engineer** (credential handling)
- Parsing: tool page link extraction, cleanup, tool page validation —
  **Backend Engineer**
- AI: tool analysis and output validation — **AI/ML Engineer**
- Pipeline: scrape and analysis orchestration, log tracking — **Backend Engineer**
  - **Performance Engineer** (batching/timeouts)
- Vector: pgvector similarity queries and tool embedding storage —
  **Database Engineer** + **AI/ML Engineer**

UI must display stored data only.

UI must not scrape, analyze, or mutate pipeline state.

If a prompt would require one specialist to cross into another's layer, the
Prompt Engineer should split it into multiple prompt files instead.

---

# 6. Tech stack

Use:

- Next.js
- Clerk
- Supabase
- Oxylabs Web Scraper API
- Oxylabs Scheduler
- Cheerio
- Vercel AI SDK
- OpenAI provider
- Zod
- Tailwind CSS
- shadcn/ui
- pgvector (via Supabase Extensions)
- Vercel Cron

Do not use:

- Supabase Auth
- local JSON app storage
- a separate backend framework

---

# 7. Supabase source of truth

Supabase is the source of truth for app data. Owned by **Database Engineer**;
**Backend Engineer** and **AI/ML Engineer** consume it through typed query
functions only.

Core tables:

- `tool_sources`
- `tools`
- `tool_analyses`
- `logs`
- `oxylabs_schedules`
- `oxylabs_schedule_runs`

Scraping must load active sources from the `tool_sources` table.

Do not hardcode source URLs inside scraping logic or `AGENTS.md`.

Each source should store the fields needed by the scraper:

- name (the discovery source, e.g. Product Hunt, Hacker News, GitHub Trending)
- homepage URL (listing_url)
- parser strategy if needed
- active status
- optional logo URL

Only active sources should be used for scraping and scheduling.

Each tool should store:

- source reference
- original URL (unique, used for dedupe)
- canonical URL
- tool name
- image URL (required before saving)
- last-updated date (required before saving)
- raw product page text
- scraped timestamp
- analyzed timestamp (null until analysis is saved)

Each tool analysis should store:

- tool reference
- neutral summary
- adoption score (−1 to 1) and adoption label (early-stage / growing / established)
- AI-estimated tool rating label (beginner-friendly / balanced / power-user /
  mixed / unclear — see section 19)
- beginner-friendly percentage, balanced percentage, power-user percentage (each
  0–100, must sum to 100)
- derived complexity score (−1 to 1, computed as
  `(power_user_percentage − beginner_friendly_percentage) / 100`)
- confidence (0 to 1)
- main purpose
- category
- target users
- key features
- pros
- cons
- pricing model
- integrations
- best for
- marketing buzzwords
- rating notes
- disclaimer
- model name

The `embedding vector(1536)` column is added to `tool_analyses` in section 20
after pgvector is enabled. Do not include it in the initial schema.

When any of these fields are added or changed, **Database Engineer** updates
`supabase/schema.sql`, `lib/supabase/types.ts`, and runs the corresponding ALTER
SQL in Supabase Dashboard → SQL Editor before **QA Engineer** tests it.

---

# 8. Scraping source selection

Before implementing or running scraping behavior, **Backend Engineer** inspects
the active sources stored in Supabase and the Manager shows the user the
available source names.

Manager asks the user which sources to scrape and how many tool pages per
source.

If the user already says something like "scrape 3 sources and 5 per source," use
that instruction and fetch the matching active sources from Supabase.

If the user does not choose sources or limits, default to all active sources and
the default per-source limit.

Do not invent source URLs.

Do not scrape source sub-endpoints that are not stored in Supabase.

---

# 9. Correct scraping model

Source URLs from Supabase are **homepage entry pages only**.

## Scrape-to-insert pipeline

This is the canonical scrape-to-insert flow, implemented by **Backend Engineer**.
Both manual scraping (section 16) and scheduler processing (section 18) run
these exact steps and differ only in how they are triggered and where the
homepage HTML comes from:

1. Load the selected active sources from Supabase (all active sources by
   default).
2. Obtain each source's homepage HTML — manual scraping fetches the stored
   homepage URL live through Oxylabs; scheduler processing uses completed
   Oxylabs job results (section 18). Never crawl into sublinks to find more
   listing pages.
3. Extract candidate links from visible product/feature card links on the
   homepage only (section 11).
4. Reject anything on the **non-tool-page reject list** before detail scraping.
5. Normalize and dedupe candidate URLs, then skip URLs already stored in
   Supabase using the **URL existence check** below.
6. Scrape only tool detail pages that pass the candidate URL check (section 12).
7. Validate and clean each detail page (section 13); it must pass the
   **tool content gate** below.
8. Insert only valid tools, append-only (section 10). Never save a source
   homepage, listing, or category page as a tool.
9. Emit **run logging** (below) during the run and a final summary object.

## Shared pipeline rules

Named rules reused by sections 16 and 18 — defined once here:

- **URL existence check** — when checking which candidate URLs already exist in
  Supabase, query in small chunks and never pass more than 15 URLs to a single
  `.in()` filter.
- **Tool content gate** — save a tool only if it has meaningful product content,
  an image URL, and a last-updated date. Full accept/reject criteria and
  `raw_text` cleanup live in section 13.
- **Run logging** — log neat server-side console messages during the run (scrape
  started, selected sources, per-source start, homepage fetched, candidate links
  found, candidates rejected before detail scrape, duplicates skipped, detail
  pages scraped, tools inserted, tools rejected after validation, source-level
  errors, scrape completed or failed) and, at the end, a summary object with:
  status, sources checked, candidates found, candidates rejected, duplicates
  skipped, detail pages scraped, tools inserted, tools rejected, tools failed,
  total duration, and rejection reasons grouped by count.

## Non-tool-page reject list

This is the canonical list of page types that are never valid tools. Other
sections refer to it as the **non-tool-page reject list** instead of repeating
it:

- blog and changelog pages
- category and directory listing pages
- author and team bio pages
- search pages
- navigation, menu, and footer links
- status and uptime pages
- careers and jobs pages
- community and forum pages
- comparison, review, and "alternatives to" pages, especially third-party ones
- corporate press and media-kit pages
- newsletter and subscription pages
- login, signup, and dashboard pages unless the page also has full product
  description text

When this list changes, update it here only.

---

# 10. Tool storage rules

Tools must be append-only during scraping.

Never delete, replace, or reset the tool list during a scrape.

Use original URL and canonical URL for dedupe.

Do not insert duplicate tools.

Do not store invalid, generic, non-product, listing, category, blog, changelog,
careers, community, comparison, corporate, or low-quality pages as tools.

---

# 11. Homepage tool link extraction

When scraping a source homepage, do not collect every link.

Extract only visible product/feature card links from the homepage content.

Ignore everything on the **non-tool-page reject list** (section 9) — navigation,
menus, footers, blog/changelog links, status, careers, community, comparison,
corporate, and subscription pages.

Before detail scraping, each candidate URL must pass a source-specific tool URL
check.

Examples:

- Product Hunt features product cards (`/posts/*`) — extract tool name, tagline, URL, upvotes, and comment count.
- Hacker News shows story links (`/item?id=*` on `news.ycombinator.com`) — extract title, URL, points, and comment count from the listing.
- GitHub Trending lists repository entries on `github.com/trending` — extract repo name, description, stars, and language.
- BetaList showcases startup listings with name, tagline, URL, and launch date.
- Reddit r/SideProject posts contain project descriptions, URLs, and upvote counts.
- SaaSHub directory entries include product name, description, pricing, and category.
- Dev.to articles tagged with tool-related topics include tool descriptions and links.

Use source-specific parser strategy when generic listing extraction is not
enough — for example, Product Hunt requires extracting from post cards while
GitHub Trending uses a different DOM structure entirely.

Use only homepage URLs already stored in Supabase.

---

# 12. Candidate URL filtering

Filter candidate URLs before scraping tool detail pages.

A candidate should be kept only when it looks like a real product/feature page
URL for that source.

Prefer URLs with:

- product- or feature-specific paths (e.g. `/product/*`, `/features/*`)
- a resolvable, distinct product or sub-product name
- clear product-page path structure rather than a content/marketing-campaign
  structure
- a match against known sub-product naming for multi-product companies

Reject candidate URLs that look like homepage URLs or anything on the
**non-tool-page reject list** (section 9).

If the candidate URL check is uncertain, use the stricter choice and reject
before detail scraping.

---

# 13. Tool validation and cleanup

After scraping a tool detail page, validate it before saving.

Accept only if the page has:

- product-specific URL
- product-specific title
- one clear product subject
- meaningful product description body
- source reference
- last-updated date
- image URL

Reject if:

- last-updated date is missing
- image URL is missing
- title is generic
- title is a blog, careers, docs-index, community, or corporate page name
- body is mostly unrelated marketing copy with no product substance
- body is mostly cookie-consent banners, chat-widget scripts, "trusted by" logo
  strips, navigation, styles, scripts, or CSS
- canonical URL points to a blog, listing, or careers page
- page has no clear product-specific subject

Do not reject a page only because paragraph extraction returned one paragraph.

Body quality can pass by either:

- 3 or more meaningful paragraphs, or
- 900 or more meaningful characters after cleanup with a clear product title,
  image URL, last-updated date, and product-specific URL

If text extraction returns one large paragraph, split it using page DOM blocks,
sentence boundaries, or source-specific selectors before validation.

Before saving `raw_text`, remove scripts, styles, cookie-consent banners,
newsletter/subscription blocks, testimonial-carousel repeated markup, "trusted
by" logo-strip repeated text, chat-widget scripts, social share text, repeated
navigation labels, inline JavaScript errors, and CSS class dumps.

Saved tool text should read like one product description, not a copied webpage
dump.

---

# 14. API route method rules

Use consistent API methods.

Use `POST` for actions that start or mutate work:

- `POST /api/scrape`
- `POST /api/analyze`
- `POST /api/oxylabs/schedules`
- `POST /api/oxylabs/scheduled-results/process`

Use `GET` only for read/status routes:

- `GET /api/tool-sources`
- `GET /api/logs`
- `GET /api/oxylabs/schedules`
- `GET /api/oxylabs/runs`

One exception — the Vercel Cron route uses `GET` because Vercel Cron always
sends GET requests:

- `GET /api/cron/pipeline` — internal only, protected by `CRON_SECRET`, not
  callable by browsers or users

Do not switch scraping or AI analysis between `GET` and `POST`.

Scraping and AI analysis must be triggered with `POST` for manual calls. The
Vercel Cron route is the only GET exception and must be protected by
`CRON_SECRET`.

---

# 15. Admin secret rule

Owned by **Security Engineer**. All action routes that start or mutate work must
require a shared admin secret sent as the `x-devscout-admin-secret` request
header. Store the value in the `DEVSCOUT_ADMIN_SECRET` environment variable.

Do not put the secret in the URL query string.

Do not expose the secret to browser code.

Reject missing or invalid secrets with `401`.

---

# 16. Manual scraping behavior and logs

Manual scraping runs the **scrape-to-insert pipeline** (section 9) on demand,
fetching each source homepage live through Oxylabs.

Manual-specific rules:

- Trigger with `POST /api/scrape` and require the `x-devscout-admin-secret`
  header (section 15).
- Select sources per section 8: use the user's choice (e.g. "3 sources, 5 per
  source"); otherwise default to all active sources and up to 5 valid tools per
  source.
- It is better to insert fewer good tools than to insert bad ones.
- Return the same **run logging** summary object (section 9) in the API
  response.
- Do not rely on a run-id polling test format for basic manual testing.

---

# 17. Testing output after implementation

After completing scraping, scheduler, or AI analysis work, the implementing
specialist always shares exact test steps.

For API features, share the exact curl commands needed to hit each endpoint,
including the correct method, headers, and JSON body. Always include the
`x-devscout-admin-secret` header where required.

Tell the user to watch the terminal running the Next.js dev server because
scrape and analysis progress is logged there.

Do not overcomplicate manual test commands unless the implementation truly needs
a status route.

---

# 18. Oxylabs Scheduler

Owned jointly by **Backend Engineer** (pipeline wiring) and **DevOps Engineer**
(one-time schedule/cron setup), with **Security Engineer** reviewing credential
handling.

Use Oxylabs Scheduler to run hourly scraping for active source homepages stored
in Supabase.

Scheduler should scrape source homepages only.

## Oxylabs Scheduler API

Before implementing Oxylabs Scheduler, always fetch the current API
documentation from
`https://developers.oxylabs.io/products/web-scraper-api/features/scheduler`. Do
not assume endpoint paths, request body fields, or response field names from
memory — consult the live docs first.

## Large integer precision — critical

Oxylabs `schedule_id` and job `id` values are large 64-bit integers that exceed
JavaScript's `Number.MAX_SAFE_INTEGER`. Parsing them with `JSON.parse` silently
corrupts the last digits, producing a wrong ID that Oxylabs will not recognise.

Always read these IDs from the raw HTTP response text before any `JSON.parse`
call — use string extraction or regex on the raw text to capture the exact digit
sequence. Never convert a parsed JavaScript number back to a string; precision
is already lost at parse time.

## Use /runs not /jobs for processing

`GET /schedules/{id}/jobs` returns a flat array of job IDs with no status. There
is no way to know if a job is `done`, `pending`, or `faulted`.

`GET /schedules/{id}/runs` returns each run with per-job `result_status`. Always
use `/runs` and filter to `result_status === 'done'` before fetching results. Do
not attempt to fetch results for `pending` or `faulted` jobs.

## Orphan schedule deactivation

Each call to the sync route that creates a new schedule leaves behind old
schedules on Oxylabs if DB rows were deleted and re-created. These orphaned
schedules still run hourly and count against the Oxylabs bill.

The sync route must:

1. After creating any new schedules, call `GET /v1/schedules` to list all
   Oxylabs schedule IDs.
2. Compare against the IDs currently stored in `oxylabs_schedules`.
3. Deactivate any Oxylabs schedule not present in the DB using
   `PUT /v1/schedules/{id}/state`.

## Two separate one-time setups

Creating Oxylabs schedules and configuring Vercel Cron are two independent
one-time steps, owned respectively by **Backend Engineer** and **DevOps
Engineer**. Neither one triggers the other.

- `POST /api/oxylabs/schedules` — tells Oxylabs what to scrape hourly. Done
  once per source set.
- Vercel Cron config — tells Vercel to call `/api/cron/pipeline` at :15 past
  every hour. Done once via `vercel.json`.

Both must be completed for the pipeline to be fully automatic. Until Vercel
Cron is configured, the process route must be called manually.

Tools only appear on the homepage after `analyzed_at` is set. Until analysis
runs, use `POST /api/analyze` manually after scraping.

Process scheduled results by running the **scrape-to-insert pipeline** (section
9), with these scheduler differences:

- Create or update Oxylabs schedules from active source homepages before
  processing.
- The homepage HTML comes from completed Oxylabs job results — fetch via
  `/runs`, use only `result_status === 'done'` (see above), and parse that HTML
  instead of doing a live homepage fetch.
- Do not save raw scheduled homepage results as tools.
- Do not duplicate pipeline logic inside Scheduler; reuse the same validation,
  cleanup, dedupe, **URL existence check**, and **run logging** as manual
  scraping (section 9).

## Automatic hourly pipeline

Owned by **DevOps Engineer** (cron config) + **Backend Engineer** (pipeline
chaining). Scheduled result processing and AI analysis must run automatically
after every Oxylabs run.

Do not require manual intervention after schedules are created.

The automatic pipeline flow is:

1. Oxylabs Scheduler runs its jobs at the top of every hour.
2. A Vercel Cron Job fires 15 minutes later to give Oxylabs time to finish.
3. The cron triggers `/api/cron/pipeline`, which runs both steps in sequence.
4. Step one: process scheduled results — fetch completed Oxylabs job HTML,
   extract candidate links, reject non-tool-page URLs, dedupe, scrape tool
   detail pages, validate, and insert valid tools.
5. Step two: immediately run AI analysis on all newly inserted tools that are
   still pending analysis.
6. If step one fails, step two must still run — there may be pre-existing
   unanalyzed tools.
7. Log progress and completion for both steps.

The cron route is internal only and must not be callable by browsers or users.

Protect the cron route using the `CRON_SECRET` environment variable, which
Vercel injects automatically on every cron request. Reject requests with a
missing or wrong value with `401`.

In local development, skip the secret check so the route can be tested
manually.

Do not use `DEVSCOUT_ADMIN_SECRET` to protect the cron route. Do not add
`CRON_SECRET` to `.env.local`.

When implementing Oxylabs Scheduler, the Prompt Engineer's prompt file must
cover all parts together (they will likely be split across Backend Engineer,
Security Engineer, and DevOps Engineer prompt files, coordinated by the
Manager):

- Sync schedules route — creates one Oxylabs schedule per active source
- List schedules route — reads stored schedule rows
- Manual process route — allows on-demand processing
- Vercel Cron config — registers the automatic hourly trigger
- Cron pipeline route — chains scheduled result processing then AI analysis

Scheduler processing must use the same validation, cleanup, dedupe, and console
summary logging as manual scraping.

# 19. AI analysis and UI framing

Owned by **AI/ML Engineer** (analysis logic) + **Frontend Engineer**
(framing/UI display).

AI analysis must process valid tools missing analysis, detected by the
**pending-analysis check** in the Required behavior list below — based on the
actual state of `tool_analyses`, not `analyzed_at` alone.

AI analysis must be triggered with `POST /api/analyze`.

The request must include the `x-devscout-admin-secret` header.

Default behavior should process all pending valid tools.

If the user gives a limit or selected tool IDs, respect that request.

Do not analyze only 10 total tools unless the user explicitly asks for 10.

Do not hardcode analysis to:

- latest scrape only
- specific tool IDs
- specific sources
- a fixed one-time batch

Batching is allowed only to avoid timeouts.

Each analysis must include and save to `tool_analyses`:

- neutral summary → `summary`
- adoption score → `adoption_score`, adoption label → `adoption_label`
- AI-estimated tool rating label → `tool_rating_label`
- beginner-friendly percentage → `beginner_friendly_percentage`
- balanced percentage → `balanced_percentage`
- power-user percentage → `power_user_percentage`
- derived complexity score → `complexity_score` (computed as
  `(power_user_percentage − beginner_friendly_percentage) / 100`)
- confidence → `confidence`
- main purpose → `main_purpose`
- category → `category`
- target users → `target_users`
- key features → `key_features`
- pros → `pros`
- cons → `cons`
- pricing model → `pricing_model`
- integrations → `integrations`
- best for → `best_for`
- marketing buzzwords → `marketing_buzzwords`
- rating notes → `rating_notes`
- disclaimer → `disclaimer`
- model name → `model`

Embedding generation is added in section 20 after pgvector is enabled.

Tool rating must be shown as **AI-estimated**, not objective truth.

Framing output rules:

- `beginnerFriendlyPercentage`, `balancedPercentage`, and `powerUserPercentage`
  must be numbers from 0 to 100.
- The three percentages must add up to 100.
- `toolRatingLabel` must be one of: `beginner-friendly`, `balanced`,
  `power-user`, `mixed`, or `unclear`.
- The label should match the strongest percentage unless confidence is low or
  percentages are close.
- If evidence is weak, use `unclear` and keep confidence low.
- `pricingModel` must be one of: `free`, `freemium`, `paid`, `usage-based`,
  `enterprise`, or `unclear`.
- Use tool page text evidence only — product description, feature lists,
  pricing copy, and docs excerpts present on the scraped page. Do not infer
  based on company name or brand reputation alone.
- Validate AI output with Zod or equivalent before saving.
- If output is invalid, retry once or mark the tool as failed without saving
  bad analysis.

Required behavior:

1. **Pending-analysis check** — detect pending tools by LEFT JOINing `tools` to
   `tool_analyses`. Never rely on `analyzed_at IS NULL` alone — `analyzed_at`
   can be set while the `tool_analyses` row is absent (e.g. after manual
   deletion). A tool is pending when no `tool_analyses` row exists for it.
2. Process in configurable batches.
3. Continue until no pending tools remain for full analysis runs.
4. Validate AI output before saving.
5. Save analysis only for valid tools.
6. Mark `analyzed_at` only after valid analysis is saved.
7. Log analyzed, skipped, failed counts per batch and in the final summary.
8. Log neat console progress during the run.
9. Log a final summary object when complete.

Tool cards must show:

- tool logo
- tool name
- company
- AI summary
- category
- tool score (rating label + beginner-friendly / balanced / power-user
  percentages)
- last updated

Tool details page must show the full analysis, including hero image, tool name,
company, AI summary, category, pricing, key features, pros, cons, target users,
integrations, AI confidence, main purpose, marketing buzzwords, rating notes,
disclaimer, and related tools.

# 20. pgvector and related tools

Owned jointly by **Database Engineer** (schema/index) and **AI/ML Engineer**
(embedding calls, similarity query logic). This section is implemented after AI
analysis is working (section 19). pgvector upgrades the analysis pipeline to
also generate embeddings and powers a Related Tools feature on the tool details
page.

Enable pgvector in Supabase Dashboard under Database Extensions. Then add an
`embedding vector(1536)` column to `tool_analyses` and create an IVFFlat cosine
index on it via the SQL Editor. Update `supabase/schema.sql`,
`lib/supabase/types.ts`, and run the ALTER SQL before testing.

Update the `/api/analyze` route to also call OpenAI text-embedding-3-small for
each tool alongside the existing analysis call and save the result to
`tool_analyses.embedding`. Update `analyzed_at` only after both analysis and
embedding are saved. Because pending detection uses LEFT JOIN logic (see
section 19), tools whose `tool_analyses` row exists but has `embedding IS NULL`
will automatically be picked up for embedding backfill on the next run without
re-running the full analysis.

To find related tools, query `tool_analyses` joined to `tools` and
`tool_sources`, filter to rows where the embedding is not null and the tool is
analyzed and is not the current tool, then order by cosine distance (`<=>`) to
the current tool's embedding and limit to 5 results.

Add a `getRelatedTools(toolId, embedding)` query function to
`lib/supabase/queries/tools.ts` using the service role client.

Update the tool details page to show a Related Tools section with up to 5
similar tools by cosine similarity. Do not show the section when the current
tool has no embedding.

---

# 21. Security, code standards, and final rule

**Security Engineer** owns this section and reviews any prompt file that
touches secrets, auth, or scheduler/cron verification before the Manager seeks
approval.

Never expose to browser code:

- Supabase service role key
- Oxylabs credentials
- OpenAI credentials
- scheduler/admin secrets

Never run from browser code:

- Oxylabs calls
- OpenAI/model calls
- scraping
- analysis
- scheduler processing

## Environment variables

Canonical list lives in `.env.example`. Only `NEXT_PUBLIC_*` values may reach
browser code; everything else is server-only. `CRON_SECRET` is injected by
Vercel and must not be added to `.env.local`.

| Variable                                                                      | Purpose                                                                                 | Exposure        |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`                                           | Clerk publishable key                                                                   | client + server |
| `CLERK_SECRET_KEY`                                                            | Clerk server-side key                                                                   | server only     |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` / `_*_FALLBACK_REDIRECT_URL` | Clerk auth route config                                                                 | client + server |
| `NEXT_PUBLIC_SUPABASE_URL`                                                    | Supabase project URL                                                                    | client + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                               | Supabase anon key                                                                       | client + server |
| `SUPABASE_SERVICE_ROLE_KEY`                                                   | Service-role DB access for writes and pipeline reads                                    | server only     |
| `OXY_WSA_USERNAME` / `OXY_WSA_PASSWORD`                                       | Oxylabs Web Scraper API + Scheduler auth                                                | server only     |
| `OPENAI_API_KEY`                                                              | AI analysis and `text-embedding-3-small`                                                | server only     |
| `DEVSCOUT_ADMIN_SECRET`                                                       | Shared secret for `x-devscout-admin-secret` on action routes (section 15)               | server only     |
| `ANALYSIS_BATCH_SIZE`                                                         | Optional; tools analyzed per batch (default 5)                                          | server only     |
| `CRON_SECRET`                                                                 | Protects `GET /api/cron/pipeline`; injected by Vercel, not in `.env.local` (section 18) | server only     |

Keep this table and `.env.example` in sync when variables change.

Use TypeScript.

Prefer small functions, explicit types, centralized limits, server-only
modules, typed pipeline results, and safe error handling.

Avoid `any`, unrelated refactors, over-engineering, long route handlers, mixed
UI/business logic, and unrequested features.

## Supabase joined table filter gotcha

Do not use `.eq('foreignTable.column', value)` to filter on a joined table in
supabase-js. This generates broken PostgREST SQL and causes runtime errors.

Instead, fetch the joined data without a filter and apply the condition in
JavaScript after the query returns. For Supabase query patterns, refer to
`.agents/skills/supabase/SKILL.md`.

## Code reuse preflight

Before any specialist writes new code, they MUST check `components/` for existing
components, and `lib/` for existing utility functions/constants/types, before
creating new ones. Duplicating existing code wastes time, increases bundle size,
and fragments the design system. When in doubt, ask the team or search the
codebase first.

When in doubt, the Manager's checklist is:

1. Keep it small.
2. Route to the right specialist (Section 0).
3. Prompt Engineer drafts the prompt using the relevant skill.
4. Preserve server/client boundaries.
5. Ask a focused question if needed.
6. Save a prompt before coding.
7. Ask if it is good to execute.
8. Implement after confirmation, in the assigned specialist's lane only.
9. Code Reviewer reviews; QA Engineer runs available checks.
10. Share exact test steps.
11. Documentation Memory Agent logs the outcome.
12. CEO Assistant compiles and delivers the final report.
13. Before coding: check existing components (`components/`) and utilities
    (`lib/`) — reuse, don't reinvent.

---

# 22. Commands and checks

"Run available checks" (sections 2 and 21), owned by **QA Engineer**, means
running these from the project root and reporting the results:

- `npm run typecheck` — TypeScript, no emit (`tsc --noEmit`)
- `npm run lint` — ESLint (`eslint`)
- `npm run build` — Next.js production build, only when the change could affect
  the build

Development and runtime:

- `npm run dev` — start the Next.js dev server; watch its terminal for scrape
  and analysis logs (section 17)
- `npm run start` — run the production build locally after `npm run build`

After implementation, QA Engineer runs `typecheck` and `lint` at minimum. Add
`build` when routes, config, or server modules changed. Report the exact
command output; do not claim a check passed without running it.
