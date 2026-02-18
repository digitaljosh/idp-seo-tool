import type {
  AnalyzerResult,
  Finding,
  DataforSEOConfig,
  DataforSEOBacklinkSummary,
  DataforSEOKeywordData,
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

/**
 * DataforSEO Keyword Intelligence Analyzer
 *
 * Uses DataforSEO's Keywords Data API to analyze:
 * - Keywords the domain ranks for (via keywords_for_site)
 * - Related keyword suggestions
 * - Search volume, CPC, and competition data
 *
 * Replaces the previously separate Keywords Everywhere integration.
 */
export async function analyzeKeywordIntelligence(
  domain: string,
  config: DataforSEOConfig,
  seedKeywords?: string[]
): Promise<{ result: AnalyzerResult; data: DataforSEOKeywordData[] }> {
  const auth = {
    username: config.login,
    password: config.password,
  };

  // Step 1: Get keywords the domain ranks for
  const domainKeywords = await fetchDomainKeywords(domain, auth);

  // Step 2: If seed keywords provided, get their volume data
  let seedData: DataforSEOKeywordData[] = [];
  if (seedKeywords && seedKeywords.length > 0) {
    seedData = await fetchKeywordSearchVolumes(seedKeywords, auth);
  }

  // Step 3: Get related keywords based on top domain keywords
  const topKeywords = domainKeywords.slice(0, 3).map(k => k.keyword);
  let relatedKeywords: DataforSEOKeywordData[] = [];
  if (topKeywords.length > 0) {
    relatedKeywords = await fetchRelatedKeywords(topKeywords[0], auth);
  }

  // Combine and deduplicate all keyword data
  const allKeywords = deduplicateKeywords([...domainKeywords, ...seedData, ...relatedKeywords]);

  // Generate findings
  const findings: Finding[] = [];

  checkKeywordCoverage(domainKeywords, findings);
  checkHighValueOpportunities(relatedKeywords, domainKeywords, findings);
  checkCompetitionLevels(domainKeywords, findings);

  const score = calculateCategoryScore(findings);

  return {
    result: {
      category: 'keywords',
      categoryLabel: 'Keyword Intelligence',
      score,
      maxScore: 100,
      findings,
      summary: getScoreSummary('Keyword Intelligence', score),
    },
    data: allKeywords,
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

// ============================================================
// Keyword Intelligence — Data Fetching
// ============================================================

async function fetchDomainKeywords(
  domain: string,
  auth: { username: string; password: string }
): Promise<DataforSEOKeywordData[]> {
  try {
    const response = await axios.post(
      `${BASE_URL}/keywords_data/google_ads/keywords_for_site/live`,
      [{ target: domain, language_code: 'en', location_code: 2840, sort_by: 'search_volume' }],
      { auth, headers: { 'content-type': 'application/json' } }
    );

    const items = response.data?.tasks?.[0]?.result || [];
    return items.slice(0, 100).map((item: any) => ({
      keyword: item.keyword || '',
      searchVolume: item.search_volume || 0,
      cpc: item.cpc || 0,
      competition: item.competition || 0,
      competitionLevel: item.competition_level || 'LOW',
      monthlySearches: (item.monthly_searches || []).map((m: any) => ({
        month: `${m.year}-${String(m.month).padStart(2, '0')}`,
        volume: m.search_volume || 0,
      })),
    }));
  } catch {
    return [];
  }
}

async function fetchRelatedKeywords(
  keyword: string,
  auth: { username: string; password: string }
): Promise<DataforSEOKeywordData[]> {
  try {
    const response = await axios.post(
      `${BASE_URL}/dataforseo_labs/google/related_keywords/live`,
      [{ keyword, language_code: 'en', location_code: 2840, limit: 50 }],
      { auth, headers: { 'content-type': 'application/json' } }
    );

    const items = response.data?.tasks?.[0]?.result?.[0]?.items || [];
    return items.map((item: any) => {
      const kd = item.keyword_data?.keyword_info || {};
      return {
        keyword: item.keyword_data?.keyword || '',
        searchVolume: kd.search_volume || 0,
        cpc: kd.cpc || 0,
        competition: kd.competition || 0,
        competitionLevel: kd.competition_level || 'LOW',
        monthlySearches: (kd.monthly_searches || []).map((m: any) => ({
          month: `${m.year}-${String(m.month).padStart(2, '0')}`,
          volume: m.search_volume || 0,
        })),
      };
    });
  } catch {
    return [];
  }
}

async function fetchKeywordSearchVolumes(
  keywords: string[],
  auth: { username: string; password: string }
): Promise<DataforSEOKeywordData[]> {
  try {
    const response = await axios.post(
      `${BASE_URL}/keywords_data/google_ads/search_volume/live`,
      [{ keywords: keywords.slice(0, 100), location_code: 2840, language_code: 'en' }],
      { auth, headers: { 'content-type': 'application/json' } }
    );

    const items = response.data?.tasks?.[0]?.result || [];
    return items.map((item: any) => ({
      keyword: item.keyword || '',
      searchVolume: item.search_volume || 0,
      cpc: item.cpc || 0,
      competition: item.competition || 0,
      competitionLevel: item.competition_level || 'LOW',
      monthlySearches: (item.monthly_searches || []).map((m: any) => ({
        month: `${m.year}-${String(m.month).padStart(2, '0')}`,
        volume: m.search_volume || 0,
      })),
    }));
  } catch {
    return [];
  }
}

// ============================================================
// Keyword Intelligence — Finding Generators
// ============================================================

function checkKeywordCoverage(domainKeywords: DataforSEOKeywordData[], findings: Finding[]) {
  if (domainKeywords.length === 0) {
    findings.push({
      id: 'kw-no-keyword-data',
      title: 'No Keyword Rankings Detected',
      description: 'No keyword rankings found for this domain. The site may be too new or not yet indexed for target keywords.',
      severity: 'high',
      category: 'keywords',
      subcategory: 'Coverage',
      currentValue: '0 keyword rankings found',
      recommendedValue: 'Target 50+ keywords with ranking positions',
      howToFix: 'Create keyword-targeted content: research what your audience searches for, create comprehensive pages for each topic, and ensure proper on-page optimization (title tags, H1s, content structure).',
      impact: 'Without keyword rankings, the site receives no organic search traffic. This is the foundation of SEO.',
      effort: 'high',
    });
    return;
  }

  const highVolume = domainKeywords.filter(k => k.searchVolume >= 1000);
  const medVolume = domainKeywords.filter(k => k.searchVolume >= 100 && k.searchVolume < 1000);
  const lowVolume = domainKeywords.filter(k => k.searchVolume > 0 && k.searchVolume < 100);

  if (highVolume.length === 0 && medVolume.length < 5) {
    findings.push({
      id: 'kw-low-volume-keywords',
      title: 'Ranking for Low-Volume Keywords Only',
      description: `The site ranks for ${domainKeywords.length} keywords, but most have very low search volume. This limits traffic potential.`,
      severity: 'medium',
      category: 'keywords',
      subcategory: 'Coverage',
      currentValue: `${highVolume.length} high-vol, ${medVolume.length} mid-vol, ${lowVolume.length} low-vol keywords`,
      recommendedValue: 'Target keywords with 100+ monthly searches',
      howToFix: 'Research and target keywords with higher search volumes. Build topical authority with content clusters: one "pillar" page targeting a higher-volume keyword, with supporting pages targeting related long-tail keywords.',
      impact: 'Ranking for higher-volume keywords dramatically increases organic traffic potential.',
      effort: 'medium',
    });
  }
}

function checkHighValueOpportunities(
  relatedKeywords: DataforSEOKeywordData[],
  domainKeywords: DataforSEOKeywordData[],
  findings: Finding[]
) {
  if (relatedKeywords.length === 0) return;

  const domainKwSet = new Set(domainKeywords.map(k => k.keyword.toLowerCase()));

  const opportunities = relatedKeywords
    .filter(k => !domainKwSet.has(k.keyword.toLowerCase()) && k.searchVolume >= 100)
    .sort((a, b) => b.searchVolume - a.searchVolume);

  if (opportunities.length > 0) {
    const topOpps = opportunities.slice(0, 10);
    const oppList = topOpps
      .map(k => `  "${k.keyword}" — ${k.searchVolume.toLocaleString()} monthly searches, $${k.cpc.toFixed(2)} CPC`)
      .join('\n');

    findings.push({
      id: 'kw-content-opportunities',
      title: `${opportunities.length} Content Opportunities Identified`,
      description: 'Related keywords with search volume that the site doesn\'t currently rank for. These represent content gaps that could drive new traffic.',
      severity: 'info',
      category: 'keywords',
      subcategory: 'Opportunities',
      currentValue: `${opportunities.length} untapped related keywords`,
      recommendedValue: 'Create content targeting high-opportunity keywords',
      howToFix: `Consider creating content for these keywords:\n${oppList}\n\nFor each keyword: research the search intent, analyze the top-ranking pages, and create content that is more comprehensive and useful.`,
      impact: 'Each new keyword ranking represents a new traffic source. Content targeting these keywords has a high probability of ranking since they are closely related to your existing content.',
      effort: 'medium',
    });
  }
}

function checkCompetitionLevels(domainKeywords: DataforSEOKeywordData[], findings: Finding[]) {
  if (domainKeywords.length < 5) return;

  const highCompetition = domainKeywords.filter(k => k.competition > 0.7 && k.searchVolume >= 100);
  const lowCompetition = domainKeywords.filter(k => k.competition < 0.3 && k.searchVolume >= 100);

  if (highCompetition.length > domainKeywords.length * 0.5 && lowCompetition.length < 3) {
    findings.push({
      id: 'kw-high-competition-focus',
      title: 'Most Target Keywords Are Highly Competitive',
      description: `${highCompetition.length} of your keywords have high competition. Consider diversifying into lower-competition keywords for easier wins.`,
      severity: 'info',
      category: 'keywords',
      subcategory: 'Strategy',
      currentValue: `${highCompetition.length} high-competition keywords`,
      recommendedValue: 'Mix of high and low-competition keyword targets',
      howToFix: 'Target a mix of keyword difficulties. Use long-tail variations of your main keywords, which tend to have lower competition and higher conversion rates. Build authority on easier keywords first, then compete for harder ones.',
      impact: 'A balanced keyword strategy provides both short-term wins (low-competition) and long-term growth (high-competition).',
      effort: 'medium',
    });
  }
}

// ============================================================
// Keyword Intelligence — Helpers
// ============================================================

function deduplicateKeywords(keywords: DataforSEOKeywordData[]): DataforSEOKeywordData[] {
  const seen = new Set<string>();
  return keywords.filter(k => {
    const lower = k.keyword.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}
