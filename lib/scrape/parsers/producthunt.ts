// lib/scrape/parsers/producthunt.ts
// Parser for Product Hunt (producthunt.com)
// Product Hunt is JavaScript-heavy and requires render: "html" to get pre-rendered content.

import * as cheerio from 'cheerio';
import type { Parser, CandidateLink, ScrapedTool } from '../types';

export const producthuntParser: Parser = {
  name: 'Product Hunt',

  isToolUrl(url: string): boolean {
    // Must match producthunt.com/posts/* format
    const match = url.match(/^https?:\/\/(?:www\.)?producthunt\.com\/posts\/([^/?#]+)/);
    if (!match) return false;

    // Reject non-product paths
    const pathname = new URL(url).pathname;
    if (pathname.includes('/@')) return false; // user profile
    if (pathname.includes('/collections/')) return false;
    if (pathname.includes('/topics/')) return false;
    if (pathname.includes('/questions/')) return false;
    if (pathname.includes('/discussions/')) return false;

    return true;
  },

  extractCandidates(html: string): CandidateLink[] {
    const $ = cheerio.load(html);
    const candidates: CandidateLink[] = [];

    // Product Hunt post cards come in various shapes
    // Try to find post links that match /posts/* pattern
    const seen = new Set<string>();

    $('a[href*="/posts/"]').each((_index, element) => {
      const href = $(element).attr('href');
      const title = $(element).text().trim();

      if (!href) return;

      // Match post URLs
      const postMatch = href.match(/\/posts\/([^/?#]+)/);
      if (!postMatch) return;

      const url = href.startsWith('http')
        ? href
        : `https://producthunt.com${href.startsWith('/') ? href : '/posts/' + postMatch[1]}`;

      if (seen.has(url)) return;
      seen.add(url);

      // Get tagline from parent card
      let description = '';
      const card = $(element).closest('[class*="post"], [class*="card"], [class*="item"], li, div');
      const taglineEl = card.find('[class*="tagline"], [class*="description"], p');
      description = taglineEl.first().text().trim();

      // Get upvotes
      let upvotes = 0;
      const voteEl = card.find('[class*="vote"], [class*="upvote"], button');
      voteEl.each((_i, el) => {
        const voteText = $(el).text().trim();
        const voteNum = parseInt(voteText.replace(/\D/g, ''), 10);
        if (!isNaN(voteNum) && voteNum > 0) {
          upvotes = voteNum;
          return false; // break
        }
      });

      candidates.push({
        url,
        title,
        description: description || undefined,
        metadata: { upvotes },
      });
    });

    // If no candidates found through links, try more aggressive selectors
    if (candidates.length === 0) {
      // Look for structured data or JSON-LD
      $('script[type="application/ld+json"]').each((_i, el) => {
        try {
          const data = JSON.parse($(el).html() || '');
          if (data?.url && data?.name) {
            const url = data.url;
            if (url.includes('/posts/') && !seen.has(url)) {
              seen.add(url);
              candidates.push({
                url,
                title: data.name,
                description: data.description || undefined,
              });
            }
          }
        } catch {
          // ignore parse errors
        }
      });
    }

    return candidates;
  },

  extractToolContent(html: string): ScrapedTool | null {
    const $ = cheerio.load(html);

    // Extract title
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('h1').first().text().trim() ||
      $('title').first().text().trim();

    if (!title) return null;

    // Extract description
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    // Extract image — try product screenshot/social image
    let imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      '';

    if (!imageUrl) {
      // Look for product screenshot images
      $('img[class*="screenshot"], img[alt*="screenshot"]').each((_i, el) => {
        const src = $(el).attr('src');
        if (src) {
          imageUrl = src.startsWith('http') ? src : `https:${src}`;
          return false;
        }
      });
    }

    // Extract last updated — try launch date or published time
    let lastUpdated =
      $('meta[property="article:published_time"]').attr('content') ||
      $('time').attr('datetime') ||
      $('[class*="date"]').first().text().trim() ||
      new Date().toISOString();

    // Try to parse a date from text
    if (lastUpdated && !lastUpdated.includes('T')) {
      const parsed = new Date(lastUpdated);
      if (!isNaN(parsed.getTime())) {
        lastUpdated = parsed.toISOString();
      } else {
        lastUpdated = new Date().toISOString();
      }
    }

    // Extract actual website URL from the product page
    const websiteUrl =
      $('a[class*="website"], a[data-test="product-url"]').attr('href') ||
      $('a:contains("Visit")').attr('href') || '';

    const rawText = cleanPageText($, websiteUrl);

    return {
      title,
      description,
      imageUrl,
      lastUpdated,
      rawText,
      websiteUrl: websiteUrl || null,
    };
  },
};

function cleanPageText($: cheerio.CheerioAPI, websiteUrl?: string): string {
  $('script, style, nav, footer, header, iframe, noscript').remove();
  const main = $('main, article, [class*="content"], [class*="description"]').first();
  let text = main.length ? main.text() : $('body').text();

  if (websiteUrl) {
    text += `\n\nProduct URL: ${websiteUrl}`;
  }

  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}
