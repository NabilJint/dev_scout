# Tradeoff Analysis: Scraping Pipeline Approaches

**Date**: 2026-07-22
**Author**: Software Architect

## Current State

The pipeline produces low-quality results: URLs point to source pages, not tools; logos are missing or low quality; non-tools (academic papers, blog posts, directories) pass validation.

## Options Evaluated

### Option A: Curated-First (manual curation, sources as signals only)

| Dimension | Score | Notes |
|---|---|---|
| **Quality** | 10/10 | Every tool meets seed-grade standards |
| **Scalability** | 2/10 | Manual curation doesn't scale; 50-100 tools is a month of work |
| **Freshness** | 3/10 | New tools only appear when manually added |
| **Complexity** | 8/10 | Removes most scraping complexity; simple data model |
| **Team cost** | 4/10 | Requires ongoing manual curation effort |
| **Total** | 27/50 | Quality-first but doesn't scale |

### Option B: Better Automated Scraping (improve parsers, stricter validation)

| Dimension | Score | Notes |
|---|---|---|
| **Quality** | 5/10 | Better than current, but still inconsistent; logos remain a problem |
| **Scalability** | 9/10 | Fully automated, runs at any scale |
| **Freshness** | 9/10 | New tools discovered automatically |
| **Complexity** | 5/10 | Existing architecture, incremental changes |
| **Team cost** | 7/10 | Initial effort to improve parsers, then maintenance |
| **Total** | 35/50 | Scales well but quality is medium |

### Option C: Hybrid (Recommended)

| Dimension | Score | Notes |
|---|---|---|
| **Quality** | 9/10 | Curated tools are perfect; auto-suggested tools hidden until reviewed |
| **Scalability** | 7/10 | Discovery runs automatically; enrichment has some automation |
| **Freshness** | 7/10 | Discoveries found automatically, enrichment runs on schedule |
| **Complexity** | 6/10 | Two-phase pipeline is more complex than linear, but discoveries table is simple |
| **Team cost** | 6/10 | Initial build cost + ongoing review of suggested tools (lightweight) |
| **Total** | 35/50 | Best balance — high quality with reasonable scale |

### Option D: AI-Augmented Scraping (use AI to enrich every discovery)

| Dimension | Score | Notes |
|---|---|---|
| **Quality** | 8/10 | AI can extract website URLs, logos, descriptions from tool pages |
| **Scalability** | 6/10 | OpenAI calls per tool cost money and have rate limits |
| **Freshness** | 8/10 | Fully automated discovery |
| **Complexity** | 4/10 | Pipeline orchestration + AI call management + cost tracking |
| **Team cost** | 4/10 | High upfront build + ongoing API costs |
| **Total** | 30/50 | High quality potential, but expensive and complex |

## Weighted Scoring

| Factor | Weight | A: Curated | B: Better Scrape | C: Hybrid | D: AI-Augmented |
|---|---|---|---|---|---|
| Tool quality (logos, URLs, descriptions) | 35% | 10 (3.5) | 5 (1.75) | 9 (3.15) | 8 (2.8) |
| Development effort (time to implement) | 20% | 5 (1.0) | 7 (1.4) | 6 (1.2) | 3 (0.6) |
| Scalability (can reach 1000+ tools) | 20% | 2 (0.4) | 9 (1.8) | 7 (1.4) | 6 (1.2) |
| Freshness (new tools discovered) | 15% | 3 (0.45) | 9 (1.35) | 7 (1.05) | 8 (1.2) |
| Maintenance burden (ongoing cost) | 10% | 4 (0.4) | 7 (0.7) | 6 (0.6) | 2 (0.2) |
| **Total** | 100% | **5.75** | **7.00** | **7.40** | **6.00** |

**Winner: Option C (Hybrid)** with a weighted score of 7.40/10.

## Why Not A? (Pure Curated)

The CEO will eventually want more than 50 tools. Manual curation doesn't scale. If the product succeeds and needs hundreds of tools, pure curation becomes a bottleneck.

## Why Not B? (Better Scraping Alone)

Even with better parsers, automated scraping cannot reliably:
- Extract a tool's real website URL from PH/HN/GitHub (each source has different patterns)
- Get a clean brand logo (SimpleIcons lookup helps, but some tools aren't on SimpleIcons)
- Determine if something is truly a "developer tool" vs a library, framework, hobby project, or blog post

Automated scraping without human review produces medium-quality results. This works for some products, but the CEO specifically wants seed-tool quality everywhere.

## Why Not D? (AI-Augmented)

AI-augmented scraping would work but introduces:
- Ongoing API costs per tool (potentially high at scale)
- Latency from LLM calls
- Unreliable structured output (even with Zod validation, AI makes mistakes)
- Maintenance overhead for prompt engineering

It's a viable future enhancement once the pipeline is solid, but premature now.

## Recommended Path: Option C with phased delivery

### Phase 1 — Immediate fixes (this sprint)
Add `website_url`, `curation_status`, SimpleIcons enrichment. This alone solves the URL problem and provides a quality gate.

### Phase 2 — Discoveries table + two-phase pipeline (next sprint)
Separate discovery from enrichment. Persist failed enrichments. Lay groundwork for admin review.

### Phase 3 — Admin review UI (future)
Allow reviewing auto-suggested tools. Add AI-suggested enrichment as a power-up for the admin flow.
