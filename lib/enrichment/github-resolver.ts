import 'server-only';

// lib/enrichment/github-resolver.ts
// GitHub repository resolver for developer tools.
// Discovers GitHub repos from tool data and fetches metadata.

import type { GitHubData } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Base URL for the GitHub REST API. */
const GITHUB_API_BASE = 'https://api.github.com';

/** Rate limit: 60 req/hr without token, 5000 req/hr with token. */
const GITHUB_API_TIMEOUT = 10_000;

/** User-Agent required by GitHub API. */
const GITHUB_USER_AGENT = 'DevScoutAI/1.0 (developer tool discovery; +https://devscout.ai)';

// ---------------------------------------------------------------------------
// GitHub URL extraction from text
// ---------------------------------------------------------------------------

/**
 * Extract GitHub repository URLs from text content.
 * Matches github.com/owner/repo patterns, excluding non-repo pages.
 */
function extractGitHubUrls(text: string): string[] {
  const urlRegex = /https?:\/\/(?:www\.)?github\.com\/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)(?:\/|$|[\s<>"')}\]]|\.git)/gi;
  const urls: string[] = [];
  const seen = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(text)) !== null) {
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');

    // Skip user/organization profile pages
    if (!repo || repo === '' || repo === 'followers' || repo === 'repositories' || repo === 'stars') continue;

    const fullUrl = `https://github.com/${owner}/${repo}`.toLowerCase();
    if (!seen.has(fullUrl)) {
      seen.add(fullUrl);
      urls.push(`https://github.com/${owner}/${repo}`);
    }
  }

  return urls;
}

/**
 * Check if a URL is a GitHub repository URL.
 */
function isGitHubRepoUrl(url: string): boolean {
  return /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/#?]+)/i.test(url);
}

/**
 * Parse a GitHub URL into owner and repo.
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/#?]+)/i);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

// ---------------------------------------------------------------------------
// GitHub API calls
// ---------------------------------------------------------------------------

/**
 * Get auth headers for GitHub API.
 * Uses GITHUB_TOKEN if available, otherwise unauthenticated.
 */
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': GITHUB_USER_AGENT,
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Fetch repository metadata from GitHub API.
 */
async function fetchRepoData(owner: string, repo: string): Promise<Record<string, unknown> | null> {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GITHUB_API_TIMEOUT);

    const response = await fetch(url, {
      headers: getAuthHeaders(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) return null;
      if (response.status === 403) {
        console.warn(`  ⚠️  [GitHub] Rate limited fetching ${owner}/${repo}`);
        return null;
      }
      console.warn(`  ⚠️  [GitHub] HTTP ${response.status} fetching ${owner}/${repo}`);
      return null;
    }

    return await response.json() as Record<string, unknown>;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn(`  ⚠️  [GitHub] Timeout fetching ${owner}/${repo}`);
    } else {
      console.warn(`  ⚠️  [GitHub] Network error fetching ${owner}/${repo}: ${err instanceof Error ? err.message : String(err)}`);
    }
    return null;
  }
}

/**
 * Fetch latest release for a repo.
 */
async function fetchLatestRelease(owner: string, repo: string): Promise<string | null> {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/latest`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      headers: getAuthHeaders(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json() as { tag_name?: string };
      return data.tag_name || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch latest commit date for a repo.
 */
async function fetchLatestCommit(owner: string, repo: string): Promise<string | null> {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=1`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      headers: getAuthHeaders(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json() as Array<{ commit: { committer: { date: string } } }>;
      if (data && data.length > 0 && data[0].commit?.committer?.date) {
        return data[0].commit.committer.date;
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Search GitHub for a repository by name.
 */
async function searchGitHub(query: string): Promise<{ owner: string; repo: string } | null> {
  const encodedQuery = encodeURIComponent(query);
  const url = `${GITHUB_API_BASE}/search/repositories?q=${encodedQuery}&sort=stars&per_page=5`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GITHUB_API_TIMEOUT);

    const response = await fetch(url, {
      headers: getAuthHeaders(),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const data = await response.json() as { items?: Array<{ full_name: string; owner: { login: string }; name: string }> };
    if (!data.items || data.items.length === 0) return null;

    // Return the first result
    const top = data.items[0];
    const parsed = parseGitHubUrl(`https://github.com/${top.full_name}`);
    return parsed;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Discovery methods
// ---------------------------------------------------------------------------

/**
 * Tier 1: Extract GitHub URLs from raw text content.
 */
function discoverFromText(rawText: string): { url: string; confidence: number } | null {
  const urls = extractGitHubUrls(rawText);
  if (urls.length === 0) return null;

  // Return the first GitHub URL found
  return { url: urls[0], confidence: 1.0 };
}

/**
 * Tier 2: Check website URL for GitHub link.
 * If the website itself is github.com/owner/repo, that's the repo.
 */
function discoverFromWebsite(websiteUrl: string | null): { url: string; confidence: number } | null {
  if (!websiteUrl) return null;
  if (!isGitHubRepoUrl(websiteUrl)) return null;

  return { url: websiteUrl, confidence: 0.9 };
}

/**
 * Tier 3: Check JSON-LD data for sameAs GitHub URL.
 */
function discoverFromJsonLd(rawText: string): { url: string; confidence: number } | null {
  // Look for sameAs fields in JSON-LD
  const ldRegex = /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = ldRegex.exec(rawText)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
      const itemsArr = Array.isArray(items) ? items : [items];

      for (const item of itemsArr) {
        if (!item || typeof item !== 'object') continue;

        const sameAs = item.sameAs;
        if (!sameAs) continue;

        const urls = Array.isArray(sameAs) ? sameAs : [sameAs];
        for (const url of urls) {
          if (typeof url === 'string' && isGitHubRepoUrl(url)) {
            return { url, confidence: 0.9 };
          }
        }
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Tier 5: GitHub search API (last resort).
 */
async function discoverFromSearch(toolName: string): Promise<{ url: string; confidence: number } | null> {
  // Try exact name first
  const exactResult = await searchGitHub(toolName);
  if (exactResult) {
    const url = `https://github.com/${exactResult.owner}/${exactResult.repo}`;
    return { url, confidence: 0.8 };
  }

  // Try name without special characters
  const simplified = toolName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  if (simplified !== toolName.toLowerCase()) {
    const fuzzyResult = await searchGitHub(simplified);
    if (fuzzyResult) {
      const url = `https://github.com/${fuzzyResult.owner}/${fuzzyResult.repo}`;
      return { url, confidence: 0.5 };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a tool's GitHub repository and fetch metadata.
 *
 * Discovery chain:
 *   1. Extract github.com URLs from raw text content
 *   2. Check the website URL itself (if it's a GitHub repo)
 *   3. Check JSON-LD sameAs fields
 *   4. Check README content (if provided separately)
 *   5. GitHub Search API (last resort, limited to 60/hr without token)
 *
 * @param params.toolName - The tool's display name
 * @param params.rawText - Scraped raw text to search for GitHub URLs
 * @param params.websiteUrl - The tool's resolved website URL
 * @param params.githubUrl - Any pre-detected GitHub URL (optional)
 * @returns GitHubData with repo metadata, or minimal result if not found
 */
export async function resolveGitHub(params: {
  toolName: string;
  rawText?: string | null;
  websiteUrl?: string | null;
  githubUrl?: string | null;
}): Promise<GitHubData> {
  const { toolName, rawText, websiteUrl, githubUrl } = params;

  // ---- Discovery phase ----
  let discovered: { url: string; confidence: number } | null = null;

  // Tier 0: Pre-detected GitHub URL (from parser or other source)
  if (githubUrl && isGitHubRepoUrl(githubUrl)) {
    discovered = { url: githubUrl, confidence: 1.0 };
  }

  // Tier 1: Extract from raw text
  if (!discovered && rawText) {
    discovered = discoverFromText(rawText);
  }

  // Tier 2: Website URL itself is a GitHub repo
  if (!discovered && websiteUrl) {
    discovered = discoverFromWebsite(websiteUrl);
  }

  // Tier 3: JSON-LD sameAs
  if (!discovered && rawText) {
    discovered = discoverFromJsonLd(rawText);
  }

  // Tier 5: GitHub Search API (rate-limited, last resort)
  if (!discovered) {
    discovered = await discoverFromSearch(toolName);
  }

  if (!discovered) {
    return {
      repository: null,
      owner: null,
      name: null,
      stars: null,
      forks: null,
      language: null,
      topics: [],
      license: null,
      lastRelease: null,
      lastCommit: null,
      method: 'none',
      confidence: 0,
    };
  }

  // ---- Fetch metadata phase ----
  const parsed = parseGitHubUrl(discovered.url);
  if (!parsed) {
    return {
      repository: discovered.url,
      owner: null,
      name: null,
      stars: null,
      forks: null,
      language: null,
      topics: [],
      license: null,
      lastRelease: null,
      lastCommit: null,
      method: discovered.confidence >= 0.8 ? 'github-search' : 'url-extraction',
      confidence: discovered.confidence,
    };
  }

  const repoData = await fetchRepoData(parsed.owner, parsed.repo);

  if (!repoData) {
    // Repo URL was extracted but API fetch failed — return partial data
    return {
      repository: discovered.url,
      owner: parsed.owner,
      name: parsed.repo,
      stars: null,
      forks: null,
      language: null,
      topics: [],
      license: null,
      lastRelease: null,
      lastCommit: null,
      method: 'url-extraction',
      confidence: discovered.confidence * 0.5, // Reduce confidence since API failed
    };
  }

  // Fetch optional metadata in parallel
  const [release, commit] = await Promise.all([
    fetchLatestRelease(parsed.owner, parsed.repo),
    fetchLatestCommit(parsed.owner, parsed.repo),
  ]);

  // Map license object to string
  const licenseObj = repoData.license as { spdx_id?: string } | null;
  const licenseStr = licenseObj?.spdx_id || null;

  // Map topics
  const topics = (repoData.topics as string[]) || [];

  const methodMap: Record<string, GitHubData['method']> = {
    '1.0': 'url-extraction',
    '0.9': 'website-check',
    '0.8': 'github-search',
    '0.5': 'github-search',
  };
  const method = methodMap[String(discovered.confidence)] || 'url-extraction';

  return {
    repository: discovered.url,
    owner: parsed.owner,
    name: parsed.repo,
    stars: (repoData.stargazers_count as number) || null,
    forks: (repoData.forks_count as number) || null,
    language: (repoData.language as string) || null,
    topics,
    license: licenseStr,
    lastRelease: release,
    lastCommit: commit,
    method,
    confidence: discovered.confidence,
  };
}