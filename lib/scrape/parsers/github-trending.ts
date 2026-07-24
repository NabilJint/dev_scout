// lib/scrape/parsers/github-trending.ts
// Parser for GitHub Trending (github.com/trending)

import * as cheerio from 'cheerio';
import type { Parser, CandidateLink, ScrapedTool } from '../types';

export const githubTrendingParser: Parser = {
  name: 'GitHub Trending',

  isToolUrl(url: string): boolean {
    // Must match github.com/<owner>/<repo> format
    const match = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return false;

    // Reject known non-repo paths
    // Allow anything after the repo name (it's valid paths like /issues, /pulls)
    // But reject if it's a top-level GitHub page
    const owner = match[1];
    const repo = match[2];
    if (!owner || !repo) return false;
    if (repo === 'trending' || repo === 'explore' || repo === 'marketplace' || repo === 'settings') return false;

    return true;
  },

  extractCandidates(html: string): CandidateLink[] {
    const $ = cheerio.load(html);
    const candidates: CandidateLink[] = [];

    $('article.Box-row').each((_index, element) => {
      const h2El = $(element).find('h2.h3 a');
      const href = h2El.attr('href');
      const fullName = h2El.text().trim().replace(/\s+/g, '');

      if (!href || !fullName) return;

      const url = `https://github.com${href}`;
      const description = $(element).find('p.col-9, p').first().text().trim();

      // Extract language
      const langEl = $(element).find('.d-inline-block').first();
      const language = langEl.text().trim();

      // Extract stars
      const starsEl = $(element).find('a.Link--muted').last();
      const starsText = starsEl.text().trim();
      const stars = starsText ? parseInt(starsText.replace(/,/g, ''), 10) || 0 : 0;

      candidates.push({
        url,
        title: fullName,
        description: description || undefined,
        metadata: { language, stars },
      });
    });

    return candidates;
  },

  extractToolContent(html: string): ScrapedTool | null {
    const $ = cheerio.load(html);

    // Extract repo name from og:title or page title
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const pageTitle = $('title').first().text().trim();
    const title = ogTitle || pageTitle || '';

    if (!title) return null;

    // Extract description from og:description or About section
    const description =
      $('meta[property="og:description"]').attr('content') ||
      $('meta[name="description"]').attr('content') ||
      $('article.BorderGrid .BorderGrid-cell p').first().text().trim() ||
      '';

    // Extract image — og:image (social preview) first
    let imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      '';

    if (!imageUrl) {
      // Try the repo's social preview
      const ogImage = $('meta[property="og:image"]').attr('content');
      if (ogImage) {
        imageUrl = ogImage;
      }
    }

    // Extract last updated from repo metadata
    let lastUpdated =
      $('relative-time').attr('datetime') ||
      $('time').attr('datetime') ||
      $('meta[property="article:published_time"]').attr('content') ||
      $('meta[name="date"]').attr('content') ||
      new Date().toISOString();

    // For GitHub repos, look for the "Last updated" text
    $('div:contains("Last updated")').each((_i, el) => {
      const timeEl = $(el).find('relative-time');
      const datetime = timeEl.attr('datetime');
      if (datetime) {
        lastUpdated = datetime;
        return false; // break
      }
    });

    // Extract homepage URL from the repo sidebar (website link)
    let websiteUrl: string | null = null;
    // Look for the website link in the sidebar
    $('a[href]:has(svg[class*="octicon-link"])').each((_i, el) => {
      const href = $(el).attr('href');
      if (href && !href.includes('github.com')) {
        websiteUrl = href.startsWith('http') ? href : `https://${href}`;
        return false; // break
      }
    });
    // Fallback: look for "Website" or "Homepage" link text
    if (!websiteUrl) {
      $('a[href]').each((_i, el) => {
        const text = $(el).text().trim().toLowerCase();
        if (text === 'website' || text === 'homepage' || text.includes('website')) {
          const href = $(el).attr('href');
          if (href && !href.includes('github.com')) {
            websiteUrl = href.startsWith('http') ? href : `https://${href}`;
            return false;
          }
        }
      });
    }

    // Clean the raw text
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
  const main = $('main, article, .repository-content, .readme, #readme').first();
  const text = main.length ? main.text() : $('body').text();
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}
