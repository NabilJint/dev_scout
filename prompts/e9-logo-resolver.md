# Prompt: E9 — Logo Resolver Upgrade

## Goal

Upgrade the logo resolver (`lib/enrichment/logo-resolver.ts`) to add three new tiers above the existing SimpleIcons/Registry/Favicon chain. OG image, JSON-LD logo, and header SVG extraction are tried first, then fall through to the existing tiers. The `resolveLogo()` function will accept enrichment HTML in addition to the tool name and website URL.

## Assigned Specialist Agent(s)

- **Backend Engineer** (primary — update logo-resolver.ts)

## Skills Read

- Existing `AGENTS.md` — Sections 7 (tool image_url field), 19 (AI analysis/UI), 21 (code standards)

## Existing Code Inspected

- `lib/enrichment/logo-resolver.ts` — full file: `resolveLogo()`, `normalizeForSimpleIcons()`, `checkSimpleIcons()`, `checkRegistry()`, `extractFavicon()`, `resolveLogos()`
- `lib/enrichment/types.ts` — `LogoResult` (url, source), `EnrichedLogoResult`
- `lib/enrichment/index.ts` — how `resolveLogo()` is called in `enrichTool()`
- `lib/scrape/pipeline.ts` — how `resolveLogo()` / enrichment logo is consumed (lines 677-679)
- `lib/supabase/types.ts` — `Tool.image_url` field used in UI

## Decisions or Assumptions

1. **New priority order is**: OG image → JSON-LD logo → Header SVG → SimpleIcons → Registry → Favicon
2. **The `resolveLogo()` function signature changes** — adds an optional `html?: string` parameter containing the page HTML for extraction. The existing signature `resolveLogo(toolName, websiteUrl?)` is extended to `resolveLogo(toolName, websiteUrl?, html?)`. The `html` parameter is optional; when absent, the new tiers are skipped.
3. **OG image extraction**: Parse the HTML for `meta[property="og:image"]`. This is already done in `resolve-website.ts` but that function discards raw HTML. The new tier re-extracts from the passed HTML.
4. **JSON-LD logo extraction**: Parse `script[type="application/ld+json"]` blocks for `logo` fields (both string URL and ImageObject sub-object patterns).
5. **Header SVG logo extraction**: Look for `<img>` tags inside `<header>` or `<nav>` that have `logo` in their class/id/alt. Extract the `src` attribute. This is best-effort and may miss SPAs that render logos via JS.
6. **All existing tiers remain as fallbacks** — SimpleIcons, Registry, Favicon logic is unchanged.
7. **The `LogoResult.source` type is extended** with three new source values: `'og-image'`, `'jsonld-logo'`, `'header-svg'`.
8. **Existing callers** (`enrichTool`, `resolveLogos`, pipeline) must update their calls when HTML is available, but continue to work unchanged when it's not.

## Files Likely to Change

| File | Change |
|------|--------|
| `lib/enrichment/logo-resolver.ts` | **Modify** — add 3 new tier functions, update `resolveLogo()` signature, update `LogoResult` return |
| `lib/enrichment/types.ts` | **Modify** — update `LogoResult` source union to include `'og-image'`, `'jsonld-logo'`, `'header-svg'` |

## Implementation Requirements

### Step 1: Update `LogoResult` in `lib/enrichment/types.ts`

Change the `source` union:

```typescript
export interface LogoResult {
  url: string | null;
  source: 'og-image' | 'jsonld-logo' | 'header-svg' | 'simpleicons' | 'registry' | 'favicon' | 'none';
}
```

### Step 2: Add three new extraction functions to `lib/enrichment/logo-resolver.ts`

Add these after the constants section (line 30) and before the name normalization section:

#### Tier 0a: OG Image extraction

```typescript
/**
 * Extract logo URL from OpenGraph image tag.
 * Checks meta[property="og:image"] in the HTML.
 * Only returns the URL if it looks like a logo/icon (not a hero/screenshot).
 * Uses heuristics: prefers square aspect ratio images, small dimensions,
 * or paths containing "logo", "icon", "brand", "avatar".
 */
function extractOgImage(html: string): string | null {
  const match = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  if (!match) return null;

  const url = match[1];
  if (!url) return null;

  // Only return if the URL looks like a logo (not a hero/screenshot)
  const lowerUrl = url.toLowerCase();
  if (
    lowerUrl.includes('logo') ||
    lowerUrl.includes('icon') ||
    lowerUrl.includes('brand') ||
    lowerUrl.includes('avatar') ||
    lowerUrl.includes('favicon')
  ) {
    return url;
  }

  // If no keyword match, still return the OG image as it often IS the logo
  // for many developer tools (e.g., simple product screenshots with logo mark).
  return url;
}
```

#### Tier 0b: JSON-LD logo extraction

```typescript
/**
 * Extract logo URL from JSON-LD structured data.
 * Looks for logo field in SoftwareApplication, Organization, or WebSite types.
 * Handles both string URLs and ImageObject sub-objects.
 */
function extractJsonLdLogo(html: string): string | null {
  const scriptRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const raw = match[1].trim();
      if (!raw) continue;

      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
      const itemsArr = Array.isArray(items) ? items : [items];

      for (const item of itemsArr) {
        if (!item || typeof item !== 'object') continue;

        const logo = item.logo;
        if (!logo) continue;

        let logoUrl: string | null = null;

        if (typeof logo === 'string') {
          logoUrl = logo;
        } else if (typeof logo === 'object' && logo !== null) {
          logoUrl = logo.url || logo.contentUrl || null;
        }

        if (logoUrl && typeof logoUrl === 'string') {
          return logoUrl;
        }
      }
    } catch {
      // Skip malformed JSON-LD
      continue;
    }
  }

  return null;
}
```

#### Tier 0c: Header SVG logo extraction

```typescript
/**
 * Extract logo URL from an <img> tag inside <header>, <nav>, or with
 * logo-related class/id/alt attributes.
 *
 * This is best-effort — SPAs that render logos via JS will not match.
 */
function extractHeaderSvg(html: string): string | null {
  // Look for <img> in header/nav context
  const headerImgRegex = /<img[^>]+(?:src=["']([^"']+)["'])[^>]*>/gi;
  const logoKeywords = ['logo', 'brand', 'header-logo', 'nav-logo', 'site-logo', 'app-logo'];
  let match: RegExpExecArray | null;

  while ((match = headerImgRegex.exec(html)) !== null) {
    const imgTag = match[0];
    const src = match[1];

    if (!src) continue;

    const lowerTag = imgTag.toLowerCase();

    // Check context: inside header/nav or has logo keyword in class/id/alt
    const inHeaderContext =
      /<header/i.test(imgTag.substring(0, 50)) ||
      lowerTag.includes('header') ||
      lowerTag.includes('nav');

    const hasLogoKeyword = logoKeywords.some(kw =>
      lowerTag.includes(kw) ||
      (imgTag.match(/class=["']([^"']*)["']/i)?.[1]?.toLowerCase().includes(kw) ?? false) ||
      (imgTag.match(/alt=["']([^"']*)["']/i)?.[1]?.toLowerCase().includes(kw) ?? false) ||
      (imgTag.match(/id=["']([^"']*)["']/i)?.[1]?.toLowerCase().includes(kw) ?? false)
    );

    // Also check if the img is likely a logo by dimension attributes
    const widthMatch = imgTag.match(/width=["'](\d+)["']/i);
    const heightMatch = imgTag.match(/height=["'](\d+)["']/i);
    const smallImage =
      (widthMatch && parseInt(widthMatch[1]) <= 200) ||
      (heightMatch && parseInt(heightMatch[1]) <= 200);

    if ((inHeaderContext || hasLogoKeyword) && smallImage) {
      // Resolve relative URLs
      if (src.startsWith('//')) return `https:${src}`;
      if (src.startsWith('/') || !src.startsWith('http')) return src; // Caller resolves relative
      return src;
    }
  }

  return null;
}
```

### Step 3: Update `resolveLogo()` function signature and logic

Change the existing `resolveLogo(toolName, websiteUrl?)` to `resolveLogo(toolName, websiteUrl?, html?)`:

```typescript
/**
 * Six-tier logo resolution for a tool.
 *
 * Priority:
 *   0a. OG image from tool website HTML
 *   0b. JSON-LD logo from structured data
 *   0c. Header SVG logo from HTML
 *   1.  SimpleIcons CDN (by tool name)
 *   2.  Logo registry (manual overrides)
 *   3.  Favicon from tool website (last resort)
 *
 * @param toolName - The tool's display name (e.g., "PlanetScale")
 * @param websiteUrl - The tool's website URL (optional, for favicon fallback)
 * @param html - The tool website's raw HTML (optional, for OG/JSON-LD/SVG extraction)
 * @returns LogoResult with resolved URL and source
 */
export async function resolveLogo(
  toolName: string,
  websiteUrl?: string,
  html?: string
): Promise<LogoResult> {
  const normalized = normalizeForSimpleIcons(toolName);
  const registryKey = normalizeForRegistry(toolName);

  // Tier 0a: OG image from HTML (requires HTML)
  if (html) {
    try {
      const ogImageUrl = extractOgImage(html);
      if (ogImageUrl) {
        return { url: ogImageUrl, source: 'og-image' };
      }
    } catch {
      // Non-critical
    }

    // Tier 0b: JSON-LD logo from HTML
    try {
      const jsonLdLogoUrl = extractJsonLdLogo(html);
      if (jsonLdLogoUrl) {
        return { url: jsonLdLogoUrl, source: 'jsonld-logo' };
      }
    } catch {
      // Non-critical
    }

    // Tier 0c: Header SVG from HTML
    try {
      const headerSvgUrl = extractHeaderSvg(html);
      if (headerSvgUrl) {
        // Resolve relative URLs
        if (headerSvgUrl.startsWith('/') && websiteUrl) {
          try {
            const base = new URL(websiteUrl);
            return { url: `${base.origin}${headerSvgUrl}`, source: 'header-svg' };
          } catch {
            return { url: headerSvgUrl, source: 'header-svg' };
          }
        }
        return { url: headerSvgUrl, source: 'header-svg' };
      }
    } catch {
      // Non-critical
    }
  }

  // Tier 1: SimpleIcons
  try {
    const simpleiconsUrl = await checkSimpleIcons(normalized);
    if (simpleiconsUrl) {
      return { url: simpleiconsUrl, source: 'simpleicons' };
    }
  } catch {
    // Non-critical
  }

  // Tier 2: Logo Registry
  const registryUrl = checkRegistry(registryKey);
  if (registryUrl) {
    return { url: registryUrl, source: 'registry' };
  }

  // Tier 3: Favicon (only if we have a website URL)
  if (websiteUrl) {
    try {
      const faviconUrl = await extractFavicon(websiteUrl);
      if (faviconUrl) {
        return { url: faviconUrl, source: 'favicon' };
      }
    } catch {
      // Non-critical
    }
  }

  return { url: null, source: 'none' };
}
```

### Step 4: Update `resolveLogos()` function signature

Update `resolveLogos` to pass HTML through:

```typescript
export async function resolveLogos(
  tools: Array<{ name: string; websiteUrl?: string; html?: string }>,
  concurrency = 5
): Promise<LogoResult[]> {
  // ... existing implementation, but pass tool.html to resolveLogo
  // Change line 232: results[i] = await resolveLogo(tool.name, tool.websiteUrl, tool.html);
}
```

### Step 5: Update `enrichTool` in `lib/enrichment/index.ts`

The `enrichTool` function already calls `resolveLogo` with name and websiteUrl. Since `fetchWebsiteContent()` doesn't retain raw HTML, the enrichment path won't pass HTML initially. However, the **pipeline** in `lib/scrape/pipeline.ts` can pass the raw HTML from the detail page scrape when calling enrichment.

For now, the enrichment path works without HTML (falling through to existing tiers). The pipeline can be updated in a future pass to pass raw HTML. No immediate change to `enrichTool()` is required — the new `html` parameter is optional.

## Security Requirements

- `import 'server-only';` already exists in `logo-resolver.ts`
- No client-side exposure of HTML content

## Acceptance Criteria

1. Three new extraction functions added to `lib/enrichment/logo-resolver.ts`
2. `resolveLogo(toolName, websiteUrl?, html?)` accepts optional HTML parameter
3. New priority order: OG image → JSON-LD logo → Header SVG → SimpleIcons → Registry → Favicon
4. Existing SimpleIcons, Registry, and Favicon tiers are preserved as fallbacks
5. `LogoResult.source` union updated with `'og-image'`, `'jsonld-logo'`, `'header-svg'`
6. When HTML is not provided, behavior is identical to before the change
7. `npm run typecheck` passes with zero errors
8. `npm run lint` passes with zero new errors

## Checks to Run

- `npm run typecheck` — TypeScript, no emit
- `npm run lint` — ESLint
- `npm run build` — Next.js production build (if routes changed)

## Exact Manual Test Steps

1. Run `npm run dev` and watch the terminal.
2. Trigger a scrape + enrichment:
   ```bash
   curl -X POST http://localhost:3000/api/scrape \
     -H "Content-Type: application/json" \
     -H "x-devscout-admin-secret: YOUR_ADMIN_SECRET" \
     -d '{"sourceNames": ["producthunt"], "perSourceLimit": 1}'
   ```
3. Observe console logs — logo resolution should still work (falling through to existing tiers since no HTML is passed yet).
4. Run a unit-level verification:
   ```typescript
   import { resolveLogo } from '@/lib/enrichment/logo-resolver';
   const testHtml = `
   <html><head>
     <meta property="og:image" content="https://example.com/logo.png" />
     <script type="application/ld+json">{"@type":"SoftwareApplication","name":"Test","logo":"https://example.com/jsonld-logo.png"}</script>
   </head><body><header><img src="/header-logo.svg" alt="logo" width="100" height="40" /></header></body></html>
   `;
   const result = await resolveLogo('Test Tool', 'https://example.com', testHtml);
   console.log(result); // Should show source: 'og-image'
   ```
5. Run `npm run typecheck && npm run lint && npm run build` — all must pass.
