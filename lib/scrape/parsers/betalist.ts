// lib/scrape/parsers/betalist.ts
// Parser for BetaList (betalist.com)

import * as cheerio from 'cheerio';
import type { Parser, CandidateLink, ScrapedTool } from '../types';

export const betalistParser: Parser = {
  name: 'BetaList',

  isToolUrl(url: string): boolean {
    // Must match betalist.com/startups/* format
    const match = url.match(/^https?:\/\/(?:www\.)?betalist\.com\/startups\/([^/?#]+)/);
    return !!match;
  },

  extractCandidates(html: string): CandidateLink[] {
    const $ = cheerio.load(html);
    const candidates: CandidateLink[] = [];

    // BetaList startup cards
    $('a[href*="/startups/"]').each((_index, element) => {
      const href = $(element).attr('href');
      const title = $(element).text().trim();

      if (!href || !title) return;

      // Must be a startup link, not a nav/footer link
      if (!href.includes('/startups/')) return;

      let url = href;
      if (url.startsWith('/')) {
        url = `https://betalist.com${url}`;
      }

      // Get description from parent card
      let description = '';
      const card = $(element).closest('[class*="startup"], [class*="card"], [class*="item"], li');
      const descEl = card.find('[class*="description"], [class*="tagline"], p');
      description = descEl.first().text().trim();

      candidates.push({
        url,
        title,
        description: description || undefined,
        metadata: {},
      });
    });

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

    // Extract image
    let imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      '';

    if (!imageUrl) {
      // Try logo or screenshot
      $('img[class*="logo"], img[class*="screenshot"], img[class*="featured"]').each((_i, el) => {
        const src = $(el).attr('src');
        if (src) {
          imageUrl = src.startsWith('http') ? src : `https:${src}`;
          return false;
        }
      });
    }

    // Extract launch date as lastUpdated
    let lastUpdated =
      $('meta[property="article:published_time"]').attr('content') ||
      $('time').attr('datetime') ||
      $('[class*="date"], [class*="launch"]').first().text().trim() ||
      new Date().toISOString();

    if (lastUpdated && !lastUpdated.includes('T')) {
      const parsed = new Date(lastUpdated);
      if (!isNaN(parsed.getTime())) {
        lastUpdated = parsed.toISOString();
      } else {
        lastUpdated = new Date().toISOString();
      }
    }

    // Extract tool website URL from the startup page
    let websiteUrl: string | null = null;
    // Look for "Visit Website" or similar button/link
    $('a[href*="//"]').each((_i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim().toLowerCase();
      if (href && (text.includes('visit') || text.includes('website') || text.includes('launch'))) {
        if (!href.includes('betalist.com')) {
          websiteUrl = href.startsWith('http') ? href : `https://${href}`;
          return false;
        }
      }
    });

    const rawText = cleanPageText($);

    return {
      title,
      description,
      imageUrl,
      lastUpdated,
      rawText,
      websiteUrl,
    };
  },
};

function cleanPageText($: cheerio.CheerioAPI): string {
  $('script, style, nav, footer, header, iframe, noscript').remove();
  const main = $('main, article, [class*="content"], [class*="startup-content"]').first();
  const text = main.length ? main.text() : $('body').text();
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}
