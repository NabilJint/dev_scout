import 'server-only';
import crypto from 'crypto';
import { resolveWebsite } from '@/lib/enrichment/resolve-website';
import { fetchViaJina } from '@/lib/enrichment/jina-fallback';
import { upsertResearchDoc } from '@/lib/supabase/queries/research-documents';

const FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_SUB_PATHS: Record<string, string> = {
  docs: '/docs',
  pricing: '/pricing',
};

function buildSubPageUrl(baseUrl: string, subPath: string): string {
  try {
    const url = new URL(baseUrl);
    let path = url.pathname;
    if (path.endsWith('/') && path.length > 1) path = path.slice(0, -1);
    url.pathname = `${path}${subPath}`;
    return url.toString();
  } catch {
    return `${baseUrl.replace(/\/$/, '')}${subPath}`;
  }
}

async function fetchPageContent(url: string, label: string): Promise<string | null> {
  console.log(`    📄 [ResearchDoc] Fetching ${label}: ${url}`);
  try {
    const result = await resolveWebsite(url);
    if (result && result.quality !== 'failed' && result.rawText.length > 100) {
      console.log(`    ✅ [ResearchDoc] ${label} fetched via HTTP (${result.rawText.length} chars)`);
      return result.rawText;
    }
  } catch {}

  try {
    const jinaResult = await fetchViaJina(url);
    if (jinaResult && jinaResult.rawText.length > 100) {
      console.log(`    ✅ [ResearchDoc] ${label} fetched via Jina (${jinaResult.rawText.length} chars)`);
      return jinaResult.rawText;
    }
  } catch {}

  console.log(`    ⚠️  [ResearchDoc] ${label} not available at ${url}`);
  return null;
}

async function fetchGitHubReadme(githubUrl: string): Promise<string | null> {
  try {
    const match = githubUrl.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (!match) return null;
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');

    for (const branch of ['main', 'master']) {
      const readmeUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/README.md`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const response = await fetch(readmeUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'DevScoutAI/1.0' },
        });
        clearTimeout(timeoutId);
        if (response.ok) {
          const text = await response.text();
          if (text.length > 100) {
            console.log(`    ✅ [ResearchDoc] GitHub README fetched (${branch}, ${text.length} chars)`);
            return text;
          }
        }
      } catch { clearTimeout(timeoutId); }
    }
    return null;
  } catch (err) {
    console.warn(`    ⚠️  [ResearchDoc] GitHub README fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

function computeDocHash(fields: Record<string, string | null>): string {
  const combined = Object.values(fields)
    .filter((v): v is string => v !== null)
    .join('\n---\n');
  return crypto.createHash('sha256').update(combined, 'utf-8').digest('hex');
}

export async function buildResearchDoc(params: {
  toolId: string;
  toolName: string;
  websiteUrl: string;
  githubUrl?: string | null;
}): Promise<string | null> {
  const { toolId, toolName, websiteUrl, githubUrl } = params;
  console.log(`  🔬 [ResearchDoc] Building research document for "${toolName}"...`);

  const homepageUrl = websiteUrl;
  const docsUrl = buildSubPageUrl(websiteUrl, DEFAULT_SUB_PATHS.docs);
  const pricingUrl = buildSubPageUrl(websiteUrl, DEFAULT_SUB_PATHS.pricing);

  const [homepageMd, docsMd, pricingMd, githubReadmeMd] = await Promise.all([
    fetchPageContent(homepageUrl, 'homepage'),
    fetchPageContent(docsUrl, 'docs'),
    fetchPageContent(pricingUrl, 'pricing'),
    githubUrl ? fetchGitHubReadme(githubUrl) : Promise.resolve(null),
  ]);

  const hasContent = homepageMd || docsMd || pricingMd || githubReadmeMd;
  if (!hasContent) {
    console.log(`  ⚠️  [ResearchDoc] No content fetched for "${toolName}"`);
    return null;
  }

  let combined = `# Research Document: ${toolName}\n\n`;
  if (homepageMd) combined += `## Homepage\n\n${homepageMd}\n\n`;
  if (docsMd) combined += `## Documentation\n\n${docsMd}\n\n`;
  if (pricingMd) combined += `## Pricing\n\n${pricingMd}\n\n`;
  if (githubReadmeMd) combined += `## GitHub README\n\n${githubReadmeMd}\n\n`;

  const contentHash = computeDocHash({
    homepage_md: homepageMd,
    docs_md: docsMd,
    pricing_md: pricingMd,
    github_readme_md: githubReadmeMd,
  });

  try {
    await upsertResearchDoc({
      tool_id: toolId,
      homepage_md: homepageMd,
      docs_md: docsMd,
      pricing_md: pricingMd,
      github_readme_md: githubReadmeMd,
      content_hash: contentHash,
      metadata: {
        sources: {
          homepage: !!homepageMd,
          docs: !!docsMd,
          pricing: !!pricingMd,
          github_readme: !!githubReadmeMd,
        },
        charCounts: {
          homepage: homepageMd?.length || 0,
          docs: docsMd?.length || 0,
          pricing: pricingMd?.length || 0,
          github_readme: githubReadmeMd?.length || 0,
        },
      },
    });
    console.log(`  💾 [ResearchDoc] Stored research document for "${toolName}"`);
  } catch (err) {
    console.error(`  ❌ [ResearchDoc] Failed to store research document for "${toolName}": ${err}`);
  }

  console.log(`  ✅ [ResearchDoc] Research document built for "${toolName}" (${combined.length} chars)`);
  return combined;
}
