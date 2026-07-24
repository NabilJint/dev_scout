import 'server-only';
import * as cheerio from 'cheerio';
import type { PageMetadata } from './types';

/**
 * Extract structured metadata from HTML.
 *
 * Returns a PageMetadata object with all known fields populated
 * (or null if not found). Never throws — always returns a valid object.
 *
 * @param html - Raw HTML string to extract metadata from.
 * @returns PageMetadata with extracted fields.
 */
export function extractMetadata(html: string): PageMetadata {
  const $ = cheerio.load(html);

  // ---- OpenGraph tags ----
  const ogTitle = $('meta[property="og:title"]').attr('content') || null;
  const ogDescription = $('meta[property="og:description"]').attr('content') || null;
  const ogImage = $('meta[property="og:image"]').attr('content') || null;
  const ogUrl = $('meta[property="og:url"]').attr('content') || null;
  const ogType = $('meta[property="og:type"]').attr('content') || null;
  const ogSiteName = $('meta[property="og:site_name"]').attr('content') || null;

  // ---- Twitter Card tags ----
  const twitterCard = $('meta[name="twitter:card"]').attr('content') || null;
  const twitterSite = $('meta[name="twitter:site"]').attr('content') || null;
  const twitterCreator = $('meta[name="twitter:creator"]').attr('content') || null;

  // ---- Standard meta tags ----
  const metaDescription = $('meta[name="description"]').attr('content') || null;
  const metaKeywords = $('meta[name="keywords"]').attr('content') || null;
  const canonicalUrl = $('link[rel="canonical"]').attr('href') || null;

  // ---- JSON-LD extraction ----
  let jsonLdType: string | null = null;
  let jsonLdName: string | null = null;
  let jsonLdDescription: string | null = null;
  let jsonLdLogo: string | null = null;
  let jsonLdUrl: string | null = null;
  let jsonLdApplicationCategory: string | null = null;
  let jsonLdOperatingSystem: string | null = null;
  const rawJsonLd: string[] = [];

  $('script[type="application/ld+json"]').each((_i, el) => {
    const raw = $(el).html() || '';
    if (!raw.trim()) return;

    rawJsonLd.push(raw);

    try {
      const parsed = JSON.parse(raw);

      // Handle @graph arrays — find the SoftwareApplication node
      const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
      const itemsArr = Array.isArray(items) ? items : [items];

      for (const item of itemsArr) {
        if (!item || typeof item !== 'object') continue;

        const type = item['@type'] || '';
        // Prefer SoftwareApplication, but accept any typed item as fallback
        if (!jsonLdType || type === 'SoftwareApplication' || type === 'WebApplication' || type === 'MobileApplication') {
          jsonLdType = type || null;
          if (item.name) jsonLdName = item.name;
          if (item.description) jsonLdDescription = item.description;
          if (item.url) jsonLdUrl = item.url;
          if (item.applicationCategory) jsonLdApplicationCategory = item.applicationCategory;
          if (item.operatingSystem) jsonLdOperatingSystem = item.operatingSystem;

          // Logo can be string URL or an ImageObject with a 'url' or 'contentUrl' field
          if (item.logo) {
            if (typeof item.logo === 'string') {
              jsonLdLogo = item.logo;
            } else if (item.logo.url) {
              jsonLdLogo = item.logo.url;
            } else if (item.logo.contentUrl) {
              jsonLdLogo = item.logo.contentUrl;
            }
          }
        }
      }
    } catch {
      // Non-critical — skip malformed JSON-LD
    }
  });

  return {
    ogTitle,
    ogDescription,
    ogImage,
    ogUrl,
    ogType,
    ogSiteName,
    twitterCard,
    twitterSite,
    twitterCreator,
    metaDescription,
    metaKeywords,
    canonicalUrl,
    jsonLdType,
    jsonLdName,
    jsonLdDescription,
    jsonLdLogo,
    jsonLdUrl,
    jsonLdApplicationCategory,
    jsonLdOperatingSystem,
    rawJsonLd: rawJsonLd.length > 0 ? rawJsonLd : null,
  };
}
