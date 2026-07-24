// lib/scrape/parsers/saashub.ts
// Parser for SaaSHub (saashub.com)

import * as cheerio from 'cheerio';
import type { Parser, CandidateLink, ScrapedTool } from '../types';

export const saashubParser: Parser = {
  name: 'SaaSHub',

  isToolUrl(url: string): boolean {
    // Must match saashub.com/* where * is a product detail path
    // Reject category pages, homepage, etc.
    try {
      const parsed = new URL(url);
      if (parsed.hostname !== 'saashub.com' && parsed.hostname !== 'www.saashub.com') {
        return false;
      }

      const path = parsed.pathname;

      // Reject category/directory pages
      if (path === '/' || path === '') return false;
      if (path.includes('/categories/') || path.includes('/category/')) return false;
      if (path.includes('/alternatives/') || path.includes('/vs/')) return false;
      if (path.includes('/blog') || path.includes('/news')) return false;

      // Accept product pages: /<product-name>, /products/<slug>
      return true;
    } catch {
      return false;
    }
  },

  extractCandidates(html: string): CandidateLink[] {
    const $ = cheerio.load(html);
    const candidates: CandidateLink[] = [];

    // SaaSHub product cards
    $('a[href*="/"]').each((_index, element) => {
      const href = $(element).attr('href');
      const title = $(element).text().trim();

      if (!href || !title) return;

      // Must be a product link (not external, not nav)
      if (href.startsWith('http') && !href.includes('saashub.com')) return;
      if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
      if (href === '/') return;

      // Extract path from full URLs or relative
      let path = href;
      if (path.startsWith('http')) {
        try {
          path = new URL(href).pathname;
        } catch {
          return;
        }
      }

      // Reject non-product paths
      if (path.includes('/categories/') || path.includes('/category/')) return;
      if (path.includes('/alternatives/') || path.includes('/vs/')) return;
      if (path.includes('/blog') || path.includes('/news')) return;
      if (path.includes('/login') || path.includes('/signup') || path.includes('/register')) return;

      const url = href.startsWith('http') ? href : `https://saashub.com${href.startsWith('/') ? href : '/' + href}`;

      // Get description from parent card
      let description = '';
      const card = $(element).closest('[class*="item"], [class*="card"], [class*="product"], li, div');
      const descEl = card.find('[class*="description"], [class*="desc"], p');
      description = descEl.first().text().trim();

      // Get pricing if available
      let pricing = '';
      const pricingEl = card.find('[class*="price"], [class*="pricing"]');
      pricing = pricingEl.first().text().trim();

      candidates.push({
        url,
        title,
        description: description || undefined,
        metadata: { pricing },
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
      $('img[class*="logo"], img[class*="screenshot"], img[class*="product"]').each((_i, el) => {
        const src = $(el).attr('src');
        if (src) {
          imageUrl = src.startsWith('http') ? src : `https:${src}`;
          return false;
        }
      });
    }

    // Extract last updated
    const lastUpdated =
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="date"]').attr('content') ||
      $('time').attr('datetime') ||
      new Date().toISOString();

    // Extract tool website URL from the product page
    let websiteUrl: string | null = null;
    // SaaSHub typically has a "Visit" or product website link
    $('a[href*="//"][rel*="nofollow"], a[href*="//"][target="_blank"]').each((_i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim().toLowerCase();
      if (href && (text.includes('visit') || text.includes('website') || text.includes('go to'))) {
        if (!href.includes('saashub.com')) {
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
  const main = $('main, article, [class*="content"], [class*="product-content"], [class*="detail"]').first();
  const text = main.length ? main.text() : $('body').text();
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}
