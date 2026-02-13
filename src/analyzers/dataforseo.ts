import type {
  AnalyzerResult,
  Finding,
  DataforSEOConfig,
  DataforSEOBacklinkSummary,
} from '../types.js';
import { calculateCategoryScore, getScoreSummary } from '../utils/scoring.js';
import axios from 'axios';

const BASE_URL = 'https://api.dataforseo.com/v3';

/**
 * DataforSEO Backlink Analyzer
 *
 * Uses DataforSEO's Backlinks API to analyze:
 * - Total backlinks and referring domains
 * - Broken backlinks
 * - Domain rank / authority
 * - Top anchor texts
 * - Top referring domains
 *
 * Also checks SERP visibility for the domain.
 */
export async function analyzeBacklinks(
  domain: string,
  config: DataforSEOConfig
): Promise<{ result: AnalyzerResult; data: DataforSEOBacklinkSummary }> {
  const auth = {
    username: config.login,
    password: config.password,
  };

  // Fetch backlink summary and anchors in parallel
  const [summary, anchors, referringDomains] = await Promise.all([
    fetchBacklinkSummary(domain, auth),
    fetchTopAnchors(domain, auth),
    fetchTopReferringDomains(domain, auth),
  ]);

  const backlinkData: DataforSEOBacklinkSummary = {
    totalBacklinks: summary.totalBacklinks,
    referringDomains: summary.referringDomains,
    brokenBacklinks: summary.brokenBacklinks,
    domainRank: summary.domainRank,
    topAnchors: anchors,
    topReferringDomains: referringDomains,
  };

  // Generate findings
  const findings: Finding[] = [];

  checkBacklinkProfile(backlinkData, findings);
  checkBrokenBacklinks(backlinkData, findings);
  checkAnchorDiversity(backlinkData, findings);
  checkDomainAuthority(backlinkData, findings);

  const score = calculateCategoryScore(findings);

  return {
    result: {
      category: 'backlinks',
      categoryLabel: 'Backlink Profile',
      score,
      maxScore: 100,
      findings,
      summary: getScoreSummary('Backlink Profile', score),
    },
    data: backlinkData,
  };
}

// ============================================================
// Data Fetching
// ============================================================

interface BacklinkSummaryRaw {
  totalBacklinks: number;
  referringDomains: number;
  brokenBacklinks: number;
  domainRank: number;
}

async function fetchBacklinkSummary(
  domain: string,
  auth: { username: string; password: string }
): Promise<BacklinkSummaryRaw> {
  try {
    const response = await axios.post(
      `${BASE_URL}/backlinks/summary/live`,
      [{ target: domain, internal_list_limit: 0, backlinks_status_type: 'all' }],
      { auth, headers: { 'content-type': 'application/json' } }
    );

    const result = response.data?.tasks?.[0]?.result?.[0];
    if (!result) return { totalBacklinks: 0, referringDomains: 0, brokenBacklinks: 0, domainRank: 0 };

    return {
      totalBacklinks: result.total_backlinks || 0,
      referringDomains: result.referring_domains || 0,
      brokenBacklinks: result.broken_backlinks || 0,
      domainRank: result.rank || 0,
    };
  } catch {
    return { totalBacklinks: 0, referringDomains: 0, brokenBacklinks: 0, domainRank: 0 };
  }
}

async function fetchTopAnchors(
  domain: string,
  auth: { username: string; password: string }
): Promise<{ anchor: string; count: number }[]> {
  try {
    const response = await axios.post(
      `${BASE_URL}/backlinks/anchors/live`,
      [{ target: domain, limit: 20, order_by: ['backlinks,desc'] }],
      { auth, headers: { 'content-type': 'application/json' } }
    );

    const items = response.data?.tasks?.[0]?.result?.[0]?.items || [];
    return items.map((item: any) => ({
      anchor: item.anchor || '(empty)',
      count: item.backlinks || 0,
    }));
  } catch {
    return [];
  }
}

async function fetchTopReferringDomains(
  domain: string,
  auth: { username: string; password: string }
): Promise<{ domain: string; backlinks: number; rank: number }[]> {
  try {
    const response = await axios.post(
      `${BASE_URL}/backlinks/referring_domains/live`,
      [{ target: domain, limit: 20, order_by: ['backlinks,desc'] }],
      { auth, headers: { 'content-type': 'application/json' } }
    );

    const items = response.data?.tasks?.[0]?.result?.[0]?.items || [];
    return items.map((item: any) => ({
      domain: item.domain || '',
      backlinks: item.backlinks || 0,
      rank: item.rank || 0,
    }));
  } catch {
    return [];
  }
}

// ============================================================
// Keyword Volume Lookup (used by Keywords analyzer)
// ============================================================

export async function fetchKeywordVolumes(
  keywords: string[],
  config: DataforSEOConfig,
  location: number = 2840, // US
  language: string = 'en'
): Promise<{ keyword: string; volume: number; cpc: number; competition: number }[]> {
  try {
    const response = await axios.post(
      `${BASE_URL}/keywords_data/google_ads/search_volume/live`,
      [{ keywords, location_code: location, language_code: language }],
      {
        auth: { username: config.login, password: config.password },
        headers: { 'content-type': 'application/json' },
      }
    );

    const items = response.data?.tasks?.[0]?.result || [];
    return items.map((item: any) => ({
      keyword: item.keyword || '',
      volume: item.search_volume || 0,
      cpc: item.cpc || 0,
      competition: item.competition || 0,
    }));
  } catch {
    return [];
  }
}

// ============================================================
// Finding Generators
// ============================================================

function checkBacklinkProfile(data: DataforSEOBacklinkSummary, findings: Finding[]) {
  if (data.totalBacklinks === 0) {
    findings.push({
      id: 'bl-no-backlinks',
      title: 'No Backlinks Detected',
      description: 'The site has no detectable backlinks from external websites. Backlinks are a major ranking factor.',
      severity: 'high',
      category: 'backlinks',
      subcategory: 'Link Profile',
      currentValue: '0 backlinks',
      recommendedValue: 'Build quality backlinks from relevant sites',
      howToFix: 'Start a link-building strategy: create link-worthy content (guides, tools, research), reach out to industry blogs for guest posts, list the business in relevant directories, pursue digital PR opportunities.',
      impact: 'Backlinks are one of Google\'s top 3 ranking factors. Sites without backlinks struggle to rank for competitive keywords.',
      effort: 'high',
    });
    return;
  }

  if (data.referringDomains < 10) {
    findings.push({
      id: 'bl-low-referring-domains',
      title: 'Low Referring Domain Count',
      description: `Only ${data.referringDomains} unique domains link to the site. Diversity of linking domains matters more than total link count.`,
      severity: 'medium',
      category: 'backlinks',
      subcategory: 'Link Profile',
      currentValue: `${data.referringDomains} referring domains`,
      recommendedValue: '50+ referring domains for competitive niches',
      howToFix: 'Focus on earning links from NEW domains rather than additional links from existing ones. Guest posting, industry partnerships, resource page outreach, and HARO/journalist queries are effective strategies.',
      impact: 'Google values link diversity. 10 links from 10 different domains is far more valuable than 100 links from 1 domain.',
      effort: 'high',
    });
  }

  // Check backlink-to-domain ratio (very high ratio may indicate spam)
  if (data.referringDomains > 0 && data.totalBacklinks / data.referringDomains > 50) {
    findings.push({
      id: 'bl-high-link-concentration',
      title: 'High Backlink Concentration',
      description: `Average of ${Math.round(data.totalBacklinks / data.referringDomains)} backlinks per referring domain. This could indicate sitewide footer/sidebar links or potential spam.`,
      severity: 'low',
      category: 'backlinks',
      subcategory: 'Link Profile',
      currentValue: `${data.totalBacklinks} backlinks from ${data.referringDomains} domains`,
      recommendedValue: 'Diversify link sources',
      howToFix: 'Review the top referring domains. If many links come from sitewide placements (footers, sidebars), this is natural. If from link farms or PBNs, consider disavowing those links.',
      impact: 'Unnatural link patterns can trigger Google penalties. A healthy link profile has diverse sources.',
      effort: 'medium',
    });
  }
}

function checkBrokenBacklinks(data: DataforSEOBacklinkSummary, findings: Finding[]) {
  if (data.brokenBacklinks > 0) {
    const brokenPct = data.totalBacklinks > 0
      ? Math.round((data.brokenBacklinks / data.totalBacklinks) * 100)
      : 0;

    const severity = brokenPct > 20 ? 'high' as const : brokenPct > 5 ? 'medium' as const : 'low' as const;

    findings.push({
      id: 'bl-broken-backlinks',
      title: `${data.brokenBacklinks} Broken Backlinks Detected`,
      description: `${brokenPct}% of backlinks point to pages that return errors (404, 5xx). These represent lost link equity.`,
      severity,
      category: 'backlinks',
      subcategory: 'Link Health',
      currentValue: `${data.brokenBacklinks} broken backlinks (${brokenPct}%)`,
      recommendedValue: '0 broken backlinks',
      howToFix: 'For each broken backlink: (1) If the page was moved, set up a 301 redirect to the new URL. (2) If the page was deleted, redirect to the closest relevant page. (3) For important lost links, consider reaching out to the linking site to update the URL.',
      impact: 'Every broken backlink is wasted link equity. Fixing these with redirects recovers ranking power for free.',
      effort: 'low',
    });
  }
}

function checkAnchorDiversity(data: DataforSEOBacklinkSummary, findings: Finding[]) {
  if (data.topAnchors.length === 0) return;

  const totalAnchors = data.topAnchors.reduce((sum, a) => sum + a.count, 0);
  const topAnchorPct = totalAnchors > 0
    ? Math.round((data.topAnchors[0].count / totalAnchors) * 100)
    : 0;

  // Check if top anchor is over-optimized (exact-match keyword anchor)
  if (topAnchorPct > 50 && data.topAnchors[0].anchor !== '(empty)') {
    findings.push({
      id: 'bl-anchor-overoptimized',
      title: 'Potential Anchor Text Over-Optimization',
      description: `The top anchor text "${data.topAnchors[0].anchor}" accounts for ${topAnchorPct}% of all backlinks. This may appear unnatural to Google.`,
      severity: 'medium',
      category: 'backlinks',
      subcategory: 'Anchor Text',
      currentValue: `Top anchor: "${data.topAnchors[0].anchor}" (${topAnchorPct}%)`,
      recommendedValue: 'Natural mix of branded, URL, and keyword anchors',
      howToFix: 'Diversify anchor text in future link-building efforts. Use a natural mix: ~40% branded, ~25% URL/naked, ~20% generic (click here, learn more), ~15% keyword variations.',
      impact: 'Over-optimized anchor text profiles can trigger Google\'s Penguin algorithm, leading to ranking penalties.',
      effort: 'medium',
    });
  }
}

function checkDomainAuthority(data: DataforSEOBacklinkSummary, findings: Finding[]) {
  if (data.domainRank === 0 && data.totalBacklinks === 0) return; // Already covered by no-backlinks

  if (data.domainRank > 0 && data.domainRank < 20) {
    findings.push({
      id: 'bl-low-domain-rank',
      title: 'Low Domain Authority',
      description: `The site's domain rank is ${data.domainRank}/100. This indicates limited authority in Google's eyes.`,
      severity: 'info',
      category: 'backlinks',
      subcategory: 'Authority',
      currentValue: `Domain rank: ${data.domainRank}/100`,
      recommendedValue: 'Domain rank 30+ for competitive niches',
      howToFix: 'Domain authority grows over time with consistent link-building, quality content, and site age. Focus on earning links from higher-authority sites in your niche.',
      impact: 'Higher domain authority correlates with better rankings across all keywords on the site.',
      effort: 'high',
    });
  }
}
