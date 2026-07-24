// lib/scrape/validate.ts
// Tool validation and raw_text cleanup per AGENTS.md Section 13 rules.

import * as cheerio from 'cheerio';
import type { ScrapedTool } from './types';

/**
 * Clean raw HTML text by removing scripts, styles, nav elements, banners,
 * cookie-consent popups, newsletter blocks, testimonial carousels, "trusted by"
 * strips, chat widgets, social share widgets, repeated nav labels, inline event
 * handlers, and JSON-LD dumps. Returns text that reads like a product description.
 */
export function cleanRawText(html: string): string {
  const $ = cheerio.load(html);

  // --- Strip non-content elements ---
  // Essential removals
  $('script, style, iframe, noscript, svg, canvas').remove();

  // Navigation, footer, header
  $('nav, footer, header, .nav, .navbar, .navigation, .menu, .sidebar').remove();
  $('[role="navigation"], [role="banner"], [role="contentinfo"]').remove();

  // Cookie / privacy / consent banners
  $('[class*="cookie"], [class*="consent"], [class*="privacy"], [class*="gdpr"]').remove();
  $('[id*="cookie"], [id*="consent"], [id*="privacy"]').remove();

  // Newsletter / subscription blocks
  $('[class*="newsletter"], [class*="subscribe"], [class*="signup"], [class*="mailing"]').remove();
  $('[class*="email-sub"], [class*="email-form"]').remove();

  // Testimonial carousels / repeated trust bars
  $('[class*="testimonial"], [class*="carousel"], [class*="trusted"], [class*="testimonials"]').remove();
  $('[class*="logo-strip"], [class*="logo-cloud"], [class*="customer-logos"]').remove();

  // Chat widgets
  $('[class*="chat"], [class*="intercom"], [class*="livechat"], [class*="crisp"]').remove();
  $('[id*="chat"], [id*="intercom"], [id*="livechat"]').remove();

  // Social share buttons / text
  $('[class*="share"], [class*="social"], [class*="follow"]').remove();

  // Comment sections
  $('[class*="comment"], [id*="comment"], .comments, #comments').remove();

  // --- Remove inline event handlers ---
  $('*').removeAttr('onclick onload onerror onmouseover onmouseout onsubmit onchange onkeyup onkeydown');

  // --- Remove JSON-LD and meta dumps ---
  $('script[type="application/ld+json"]').remove();
  $('script[type="application/json"]').remove();

  // --- Extract meaningful text ---
  // Prefer <article> or <main> content; fall back to <body>
  const mainSelectors = 'article, main, [role="main"], .content, #content, .post-content, .readme, .repository-content';
  const mainEl = $(mainSelectors).first();
  let text = mainEl.length ? mainEl.text() : $('body').text();

  // --- Clean whitespace ---
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * Split text into paragraphs for quality checking.
 * Handles both \n\n separators and common block-level wrappers.
 */
function splitParagraphs(text: string): string[] {
  // Try splitting by double newlines first
  const byNewlines = text.split(/\n\s*\n/).filter(Boolean);

  if (byNewlines.length >= 3) {
    return byNewlines;
  }

  // If we have one large paragraph, split by sentence boundaries
  if (byNewlines.length <= 2 && text.length > 600) {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let current = '';

    for (const sentence of sentences) {
      if (current.length + sentence.length > 300 && current.length > 0) {
        chunks.push(current.trim());
        current = '';
      }
      current += sentence;
    }
    if (current.trim()) {
      chunks.push(current.trim());
    }

    return chunks.length >= 3 ? chunks : [text];
  }

  return byNewlines.length > 0 ? byNewlines : [text];
}

/**
 * Generic / non-product title patterns (lowercase checks).
 */
const GENERIC_TITLES = new Set([
  'home', 'blog', 'careers', 'community', 'docs', 'documentation',
  'pricing', 'about', 'about us', 'contact', 'contact us', 'sign in',
  'sign up', 'login', 'register', 'dashboard', 'settings', 'profile',
  'help', 'faq', 'support', 'terms', 'privacy', 'status',
]);

/**
 * Validate a ScrapedTool per AGENTS.md Section 13 rules.
 *
 * Accept only if:
 *  - title is present and not generic
 *  - imageUrl is present and non-empty (required)
 *  - lastUpdated is present and non-empty (required)
 *  - body quality check passes
 *  - one clear product subject (not blog, listing, careers, etc.)
 */
export function validateToolContent(
  content: ScrapedTool
): { valid: boolean; reason?: string } {
  // --- Title check ---
  if (!content.title || content.title.trim().length === 0) {
    return { valid: false, reason: 'title_generic' };
  }

  const titleLower = content.title.trim().toLowerCase();
  if (GENERIC_TITLES.has(titleLower)) {
    return { valid: false, reason: 'title_generic' };
  }

  // --- Image URL check (required) ---
  if (!content.imageUrl || content.imageUrl.trim().length === 0) {
    return { valid: false, reason: 'missing_image' };
  }

  // --- Last updated check (required) ---
  if (!content.lastUpdated || content.lastUpdated.trim().length === 0) {
    return { valid: false, reason: 'missing_last_updated' };
  }

  // --- Raw text checks ---
  const rawText = content.rawText || '';
  const meaningfulText = rawText.replace(/\s+/g, ' ').trim();

  if (meaningfulText.length < 100) {
    return { valid: false, reason: 'body_too_short' };
  }

  // Check for non-product indicators in the body
  const lowerBody = meaningfulText.toLowerCase();

  // If the body is mostly about irrelevant topics, reject
  const nonProductIndicators = [
    'cookie', 'privacy policy', 'terms of service', 'all rights reserved',
    'subscribe to our newsletter', 'sign up for our newsletter',
  ];

  const nonProductScore = nonProductIndicators.filter(indicator =>
    lowerBody.includes(indicator)
  ).length;

  // High density of non-product indicators suggests low-quality body
  if (nonProductScore >= 3) {
    return { valid: false, reason: 'body_low_quality' };
  }

  // --- Body quality check ---
  const paragraphs = splitParagraphs(meaningfulText);
  const meaningfulParagraphs = paragraphs.filter(p => p.length >= 30);

  const passesParagraphCheck = meaningfulParagraphs.length >= 3;
  const passesCharCheck =
    meaningfulText.length >= 900 &&
    content.title.trim().length > 0 &&
    content.imageUrl.trim().length > 0 &&
    content.lastUpdated.trim().length > 0;

  if (!passesParagraphCheck && !passesCharCheck) {
    return { valid: false, reason: 'body_too_short' };
  }

  // --- Check for non-product page indicators ---
  const pageTypeIndicators = [
    { keywords: ['blog', 'posts', 'articles'], label: 'blog' },
    { keywords: ['careers', 'jobs', 'join us', 'we\'re hiring'], label: 'careers' },
    { keywords: ['community', 'forum', 'discuss'], label: 'community' },
    { keywords: ['corporate', 'press', 'media kit', 'newsroom'], label: 'corporate' },
    { keywords: ['pricing', 'plans', 'subscription'], label: 'pricing' },
  ];

  // If the title strongly suggests a non-product page, reject
  const matchingIndicator = pageTypeIndicators.find(indicator =>
    indicator.keywords.some(kw => titleLower.includes(kw))
  );

  if (matchingIndicator) {
    return { valid: false, reason: 'not_a_product_page' };
  }

  // --- Article / blog post title detection ---
  const articlePatterns = [
    'how to', 'how i', 'how we', 'why i', 'why you', 'why we',
    'guide to', 'guide for', 'introduction to', 'getting started with',
    'the complete guide', 'the ultimate', 'the definitive',
    'what i learned', 'things i wish', 'best practices for',
    'in 2024', 'in 2025', 'in 2026', 'this year',
    'race condition', 'when to use', 'from scratch',
    'your first', 'your own', 'building a', 'building an',
    'creating a', 'making a',
    'review:', ' vs ', ' versus ',
  ];

  const isArticle = articlePatterns.some(pattern => titleLower.includes(pattern));
  if (isArticle) {
    return { valid: false, reason: 'article_page' };
  }

  // --- Non-tool / consumer product detection ---
  const consumerPatterns = [
    'fashion', 'clothing', 'buy and sell', 'luxury', 'recipe', 'food',
    'restaurant', 'hotel', 'travel', 'booking', 'real estate', 'property',
    'rental', 'dating', 'fitness', 'workout', 'weight loss',
    'beauty', 'makeup', 'skin care', 'skin condition',
    'game', 'gaming', 'entertainment', 'movie', 'music',
    'art', 'photography',
  ];

  const isConsumerProduct = consumerPatterns.some(pattern => titleLower.includes(pattern));
  if (isConsumerProduct) {
    return { valid: false, reason: 'consumer_product' };
  }

  return { valid: true };
}
