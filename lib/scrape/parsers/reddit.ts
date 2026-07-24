// lib/scrape/parsers/reddit.ts
// Parser for Reddit r/SideProject (reddit.com/r/SideProject)
// Reddit may require render: "html" for proper card extraction.

import * as cheerio from 'cheerio';
import type { Parser, CandidateLink, ScrapedTool } from '../types';

export const redditParser: Parser = {
  name: 'Reddit r/SideProject',

  isToolUrl(url: string): boolean {
    try {
      const parsed = new URL(url);

      // For Reddit self posts (r/SideProject/comments/*), accept them
      if (parsed.hostname.includes('reddit.com') || parsed.hostname.includes('redd.it')) {
        const path = parsed.pathname;
        if (path.includes('/r/SideProject/comments/') || path.includes('/r/sideproject/comments/')) {
          return true;
        }
        // Reject other Reddit pages
        return false;
      }

      // For external URLs, reject social media and known non-tool domains
      const socialDomains = [
        'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
        'youtube.com', 'youtu.be', 'linkedin.com', 'pinterest.com', 'snapchat.com',
        'reddit.com', 'redd.it', 'discord.gg', 'discord.com',
      ];
      const hostname = parsed.hostname.replace('www.', '');
      if (socialDomains.some(d => hostname === d || hostname.endsWith('.' + d))) {
        return false;
      }

      // Must be valid http(s) URL
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  },

  extractCandidates(html: string): CandidateLink[] {
    const $ = cheerio.load(html);
    const candidates: CandidateLink[] = [];

    // Reddit uses several different DOM structures depending on old/new/rendered view
    // Try multiple selectors

    // Old Reddit: div.thing with a.title
    $('div.thing a.title').each((_index, element) => {
      const href = $(element).attr('href');
      const title = $(element).text().trim();
      if (!href || !title) return;

      let url = href;
      if (url.startsWith('/')) {
        url = `https://old.reddit.com${url}`;
      }

      // Get upvotes
      const scoreEl = $(element).closest('.thing').find('.score.unvoted');
      const scoreText = scoreEl.text().trim();
      const score = scoreText ? parseInt(scoreText.replace(/\D/g, ''), 10) || 0 : 0;

      candidates.push({
        url,
        title,
        metadata: { upvotes: score },
      });
    });

    // New Reddit / rendered: shreddit-post or article with data-testid="post"
    $('shreddit-post, article[data-testid="post"], [class*="post"]').each((_index, element) => {
      const linkEl = $(element).find('a[class*="title"], a[slot="title"], a[href*="//"]').first();
      const href = linkEl.attr('href');
      const title = linkEl.text().trim();

      if (!href || !title) return;

      let url = href;
      if (url.startsWith('/')) {
        url = `https://reddit.com${url}`;
      }

      // For external links on Reddit, Reddit wraps them in a go redirect
      // Try to extract the actual external URL
      if (url.includes('out.reddit.com') || url.includes('reddit.com/away')) {
        const match = url.match(/url=([^&]+)/);
        if (match) {
          url = decodeURIComponent(match[1]);
        }
      }

      // Get description
      let description = '';
      const descEl = $(element).find('[class*="description"], [class*="preview"], p');
      description = descEl.first().text().trim();

      candidates.push({
        url,
        title,
        description: description || undefined,
        metadata: {},
      });
    });

    // Fallback: look for external links that are posted as link posts
    if (candidates.length === 0) {
      $('a[href*="//"]').each((_index, element) => {
        const href = $(element).attr('href');
        const title = $(element).text().trim();

        if (!href || !title) return;
        if (href.startsWith('#') || href.startsWith('/') || href.startsWith('javascript:')) return;

        // Skip Reddit internal links (except comments pages)
        if (href.includes('reddit.com') && !href.includes('/comments/')) return;

        candidates.push({
          url: href,
          title,
        });
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

    // Extract image
    let imageUrl =
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      '';

    if (!imageUrl) {
      // Try to find post media/image
      $('img[class*="post"], img[alt*="Post"], img[class*="preview"]').each((_i, el) => {
        const src = $(el).attr('src');
        if (src && src.startsWith('http')) {
          imageUrl = src;
          return false;
        }
      });
    }

    // Extract last updated — posted date
    const lastUpdated =
      $('meta[property="article:published_time"]').attr('content') ||
      $('time').attr('datetime') ||
      $('meta[name="date"]').attr('content') ||
      new Date().toISOString();

    // Extract tool website URL from the post (if it's a link post to an external tool)
    let websiteUrl: string | null = null;
    // Reddit self-posts may include a link in the post body
    $('a[href*="//"]').each((_i, el) => {
      const href = $(el).attr('href');
      if (href && !href.includes('reddit.com') && !href.includes('redd.it')) {
        const parentText = $(el).closest('p, li, div').text().trim().toLowerCase();
        if (parentText.length < 200) {
          websiteUrl = href;
          return false; // Take the first external link
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
  const main = $('main, article, [class*="content"], [class*="post-content"], [class*="thread"]').first();
  const text = main.length ? main.text() : $('body').text();
  return text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n')
    .trim();
}
