// lib/scrape/parsers/devto.ts
// Parser for Dev.to (dev.to)

import * as cheerio from 'cheerio';
import type { Parser, CandidateLink, ScrapedTool } from '../types';

// Tool-related tags to filter on Dev.to
const TOOL_TAGS = new Set([
  'showdev', 'opensource', 'tooling', 'productivity', 'tools',
  'devtools', 'development', 'webdev', 'react', 'nextjs', 'typescript',
  'javascript', 'node', 'python', 'api', 'saas', 'startup',
]);

export const devtoParser: Parser = {
  name: 'Dev.to',

  isToolUrl(url: string): boolean {
    // Must match dev.to/*/* format (username/article-slug)
    const match = url.match(/^https?:\/\/(?:www\.)?dev\.to\/([^/]+)\/([^/?#]+)/);
    if (!match) return false;

    // Reject if it's a user profile page
    const username = match[1];
    const slug = match[2];
    if (username === 'new' || username === 'settings' || username === 'dashboard') return false;

    // The slug should not be a generic page
    if (slug === 'series' || slug === 'comments' || slug === 'following') return false;

    return true;
  },

  extractCandidates(html: string): CandidateLink[] {
    const $ = cheerio.load(html);
    const candidates: CandidateLink[] = [];

    // Dev.to article cards
    $('article, .crayons-story, [class*="card"], div[data-content]').each((_index, element) => {
      const linkEl = $(element).find('a[href*="/"][href*="-"], a[class*="title"], a[class*="link"]');
      const href = linkEl.attr('href');
      const title = linkEl.text().trim();

      if (!href || !title) return;

      // Must be a dev.to article link
      if (!href.startsWith('/') && !href.includes('dev.to')) return;

      let url = href;
      if (url.startsWith('/')) {
        url = `https://dev.to${url}`;
      }

      // Must match dev.to/<user>/<slug>
      if (!url.match(/^https?:\/\/dev\.to\/[^/]+\/[^/]+/)) return;

      // Check tags
      const tags: string[] = [];
      const tagEls = $(element).find('[class*="tag"], a[href*="/t/"]');
      tagEls.each((_i, el) => {
        const tagText = $(el).text().trim().toLowerCase().replace('#', '');
        if (tagText) tags.push(tagText);
      });

      // Only include if it has tool-related tags
      const hasToolTag = tags.some(t => TOOL_TAGS.has(t));

      // If no explicit tool tags, still include if title suggests a tool showcase
      const titleLower = title.toLowerCase();
      const suggestiveTitle = !hasToolTag && (
        titleLower.includes('build') || titleLower.includes('create') ||
        titleLower.includes('tool') || titleLower.includes('app') ||
        titleLower.includes('saas') || titleLower.includes('project')
      );

      if (!hasToolTag && !suggestiveTitle) return;

      // Get description
      let description = '';
      const descEl = $(element).find('[class*="description"], [class*="excerpt"], p');
      description = descEl.first().text().trim();

      // Get published date
      const timeEl = $(element).find('time');
      const publishedAt = timeEl.attr('datetime') || '';

      candidates.push({
        url,
        title,
        description: description || undefined,
        metadata: { tags, publishedAt },
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

    // Extract image — cover image or social preview
    const imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      $('img[class*="cover"], img[class*="hero"]').attr('src') ||
      '';

    // Extract last updated — published date
    const lastUpdated =
      $('meta[property="article:published_time"]').attr('content') ||
      $('time').attr('datetime') ||
      $('meta[name="date"]').attr('content') ||
      new Date().toISOString();

    // Extract tool website URL from the article (if post links to a tool)
    let websiteUrl: string | null = null;
    $('a[href*="//"]').each((_i, el) => {
      const href = $(el).attr('href');
      if (href && !href.includes('dev.to') && !href.includes('github.com')) {
        const parentText = $(el).closest('p, li, div').text().trim().toLowerCase();
        if (parentText.includes('check out') || parentText.includes('try it') || parentText.includes('website')) {
          websiteUrl = href;
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
  const main = $('main, article, .crayons-article__main, [class*="article-body"]').first();
  const text = main.length ? main.text() : $('body').text();
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}
