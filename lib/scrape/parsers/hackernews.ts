// lib/scrape/parsers/hackernews.ts
// Parser for Hacker News (news.ycombinator.com)

import * as cheerio from 'cheerio';
import type { Parser, CandidateLink, ScrapedTool } from '../types';

export const hackernewsParser: Parser = {
  name: 'Hacker News',

  isToolUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      // Reject HN internal pages (item pages, user pages, etc.)
      if (parsed.hostname === 'news.ycombinator.com' || parsed.hostname === 'hn.algolia.com') {
        return false;
      }
      // Must be an external http(s) URL
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  },

  extractCandidates(html: string): CandidateLink[] {
    const $ = cheerio.load(html);
    const candidates: CandidateLink[] = [];

    $('tr.athing').each((_index, element) => {
      const titleEl = $(element).find('td.title a');
      const href = titleEl.attr('href');
      const title = titleEl.text().trim();

      if (!href || !title) return;

      // Resolve relative URLs
      let url = href;
      if (url.startsWith('item?id=')) {
        url = `https://news.ycombinator.com/${url}`;
      } else if (url.startsWith('/')) {
        // Some links show as relative — resolve
        const hnMatch = url.match(/^\/\/(.*)/);
        if (hnMatch) {
          url = `https://${hnMatch[1]}`;
        } else {
          url = `https://news.ycombinator.com${url}`;
        }
      } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = `https://${url}`;
      }

      // Get subtext for points and comments
      const subtextRow = $(element).next('tr');
      const subtext = subtextRow.find('td.subtext');
      const scoreText = subtext.find('.score').text().trim();
      const points = scoreText ? parseInt(scoreText.replace(/\D/g, ''), 10) || 0 : 0;

      const commentLinks = subtext.find('a');
      let comments = 0;
      commentLinks.each((_i, el) => {
        const text = $(el).text().trim();
        if (text.includes('comment')) {
          comments = parseInt(text.replace(/\D/g, ''), 10) || 0;
        }
      });

      // For Hacker News, the external link IS the tool website URL
      const isExternal = !url.includes('news.ycombinator.com');

      candidates.push({
        url,
        title,
        description: undefined,
        websiteUrl: isExternal ? url : undefined,
        metadata: { points, comments },
      });
    });

    return candidates;
  },

  extractToolContent(html: string): ScrapedTool | null {
    const $ = cheerio.load(html);

    // Extract title from <title> or og:title
    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').first().text().trim() ||
      $('h1').first().text().trim();

    if (!title) return null;

    // Extract description
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      '';

    // Extract image — og:image first, then twitter:image, then first large img
    let imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      '';

    if (!imageUrl) {
      // Try first meaningful image
      $('img').each((_i, el) => {
        const src = $(el).attr('src');
        if (src && !src.includes('logo') && !src.includes('avatar') && !src.includes('icon')) {
          const width = parseInt($(el).attr('width') || '0', 10);
          const height = parseInt($(el).attr('height') || '0', 10);
          if (width > 100 || height > 100) {
            imageUrl = src.startsWith('http') ? src : `https:${src}`;
            return false; // break
          }
        }
      });
    }

    // Extract last updated date
    const lastUpdated =
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="date"]').attr('content') ||
      $('time').attr('datetime') ||
      new Date().toISOString();

    // Clean the raw text
    const rawText = cleanPageText($);

    return {
      title,
      description,
      imageUrl,
      lastUpdated,
      rawText,
    };
  },
};

/**
 * Clean page text by removing scripts, styles, nav, and non-content elements.
 */
function cleanPageText($: cheerio.CheerioAPI): string {
  // Remove non-content elements
  $('script, style, nav, footer, header, iframe, noscript').remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();
  $('.sidebar, .footer, .header, .nav, .menu, .cookie, .newsletter, .subscribe').remove();

  // Get text from main content areas
  const main = $('main, article, .content, #content, .post-content, .readme, .repository-content').first();
  const text = main.length ? main.text() : $('body').text();

  return cleanWhitespace(text);
}

function cleanWhitespace(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}
