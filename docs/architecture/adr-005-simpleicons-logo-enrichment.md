# ADR-005: SimpleIcons Logo Enrichment

**Date**: 2026-07-22
**Status**: Proposed
**Author**: Software Architect

## Context

The 12 seed tools use `cdn.simpleicons.org` for their logos (e.g., `https://cdn.simpleicons.org/cursor`), which returns clean SVG brand icons. Scraped tools rely on `og:image` from source pages, which typically return:

- Social preview screenshots (not brand logos)
- GitHub's repo social card
- Hero/marketing images from tool pages

These are inconsistent quality — they don't match the seed tools' clean logo experience.

SimpleIcons (simpleicons.org) is an open-source collection of 3,100+ brand SVG icons. It includes most major developer tools and platforms, maintained by community contributions.

## Decision

Add a post-scrape enrichment step that attempts to resolve a tool's brand logo from `cdn.simpleicons.org` using the tool's name.

### Lookup logic

```typescript
const SIMPLEICONS_BASE = 'https://cdn.simpleicons.org';

function normalizeForSimpleIcons(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')  // strip non-alphanumeric
    .replace(/^[0-9]+/, '');     // strip leading digits
}

async function resolveLogo(name: string): Promise<string | null> {
  const normalized = normalizeForSimpleIcons(name);
  const url = `${SIMPLEICONS_BASE}/${normalized}`;

  try {
    // HEAD request to check if icon exists
    const response = await fetch(url, { method: 'HEAD' });
    if (response.ok) {
      return url;  // SimpleIcons returns valid SVG for known brands
    }
  } catch {
    // Network error — not critical, fall through
  }

  return null;
}
```

### Three-tier resolution order

For every tool, logos are resolved in this priority:

1. **SimpleIcons** (automatic, ~60% hit rate for dev tools)
2. **Logo registry** (`lib/enrichment/logo-registry.json` — manual mapping for tools not on SimpleIcons, e.g., Trigger.dev, Inngest)
3. **Favicon extraction** (fetch the tool's website, extract `<link rel="icon">`, as last resort)

### Acceptance criteria for images

A logo is accepted when:
- It comes from SimpleIcons (implicitly trusted)
- It comes from the logo registry (implicitly trusted, manually verified)
- It comes from favicon extraction AND resolves to a square SVG/PNG (last resort, lower trust)

### When a logo cannot be resolved

The tool is saved with `image_url` from the source page (the `og:image` fallback), but the tool is flagged with `curation_status = 'auto-suggested'` — it requires manual review to set a proper logo before appearing on the homepage.

## Consequences

**Positive**:
- Clean, consistent brand logos on par with seed tools
- SimpleIcons is free, lightweight, and requires no API key
- SVG logos are resolution-independent, look sharp on retina displays
- No additional cost or third-party dependency

**Negative**:
- Requires an HTTP request per tool (HEAD to SimpleIcons)
- SimpleIcons does not cover all developer tools (~3100 icons, ~60% hit rate for dev tools)
- Some tools share names with non-dev brands (e.g., "Linear" = Linear.app vs Linear furniture)
- Toolkit (dotnet, etc.) has different naming conventions

**Neutral**:
- Logo resolution is a best-effort enrichment, not a hard requirement
- Tools without resolved logos default to og:image and are hidden from homepage until reviewed

## Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Wrong icon due to name collision | When `website_url` is known, cross-reference with SimpleIcons' brand URL metadata; fall back to og:image if uncertain |
| Network failure during lookup | Non-critical — enrichment continues without logo, tool stored as auto-suggested |
| Rate limiting | SimpleIcons CDN has no rate limits; single HEAD request per tool is negligible |

## Alternatives Considered

1. **Use Clearbit Logo API** (`logo.clearbit.com/{domain}`): Requires domain, not name; varies in quality; commercial product
2. **Use Google Favicons** (`google.com/s2/favicons`): Low resolution (16x16), poor UX quality
3. **Manual logo upload**: Not scalable for automated pipeline
4. **AI-generated logos**: Would produce incoherent brand identity
