import type {
  AnalyzerResult,
  Finding,
  KeywordsEverywhereConfig,
  KEKeywordData,
} from '../types.js';
import { calculateCategoryScore, getScoreSummary } from '../utils/scoring.js';
import axios from 'axios';

const BASE_URL = 'https://api.keywordseverywhere.com/v1';

/**
 * Keywords Everywhere Analyzer
 *
 * Uses Keywords Everywhere API for keyword research:
 * - Search volume, CPC, competition for target keywords
 * - Related keywords discovery
 * - "People Also Search For" keywords
 * - Domain traffic estimates
 *
 * Produces findings about keyword opportunities and content gaps.
 */
export async function analyzeKeywords(
  domain: string,
  config: KeywordsEverywhereConfig,
  seedKeywords?: string[]
): Promise<{ result: AnalyzerResult; data: KEKeywordData[] }> {
  const headers = {
    'Authorization': `Bearer ${config.apiKey}`,
    'Accept': 'application/json',
  };

  // Step 1: Get keywords the domain ranks for
  const domainKeywords = await fetchDomainKeywords(domain, headers);

  // Step 2: If seed keywords provided, get their data
  let seedData: KEKeywordData[] = [];
  if (seedKeywords && seedKeywords.length > 0) {
    seedData = await fetchKeywordData(seedKeywords, headers);
  }

  // Step 3: Get related keywords based on top domain keywords
  const topKeywords = domainKeywords.slice(0, 5).map(k => k.keyword);
  let relatedKeywords: KEKeywordData[] = [];
  if (topKeywords.length > 0) {
    relatedKeywords = await fetchRelatedKeywords(topKeywords[0], headers);
  }

  // Combine all keyword data
  const allKeywords = deduplicateKeywords([...domainKeywords, ...seedData, ...relatedKeywords]);

  // Generate findings
  const findings: Finding[] = [];

  checkKeywordCoverage(domainKeywords, findings);
  checkHighValueOpportunities(relatedKeywords, domainKeywords, findings);
  checkCompetitionLevels(domainKeywords, findings);
  checkKeywordTrends(domainKeywords, findings);

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

async function fetchKeywordData(
  keywords: string[],
  headers: Record<string, string>,
  country: string = 'us'
): Promise<KEKeywordData[]> {
  try {
    const response = await axios.post(
      `${BASE_URL}/get_keyword_data`,
      new URLSearchParams({
        dataSource: 'gkp',
        country,
        ...Object.fromEntries(keywords.slice(0, 100).map((kw, i) => [`kw[${i}]`, kw])),
      }),
      { headers }
    );

    const data = response.data?.data || [];
    return data.map((item: any) => ({
      keyword: item.keyword || '',
      vol: item.vol || 0,
      cpc: item.cpc?.value ? parseFloat(item.cpc.value) : 0,
      competition: item.competition || 0,
      trend: (item.trend || []).map((t: any) => t.value || 0),
    }));
  } catch {
    return [];
  }
}

async function fetchRelatedKeywords(
  keyword: string,
  headers: Record<string, string>,
  country: string = 'us'
): Promise<KEKeywordData[]> {
  try {
    const response = await axios.post(
      `${BASE_URL}/get_related_keywords`,
      new URLSearchParams({
        keyword,
        country,
        dataSource: 'gkp',
      }),
      { headers }
    );

    const data = response.data?.data || [];
    return data.slice(0, 50).map((item: any) => ({
      keyword: item.keyword || '',
      vol: item.vol || 0,
      cpc: item.cpc?.value ? parseFloat(item.cpc.value) : 0,
      competition: item.competition || 0,
      trend: (item.trend || []).map((t: any) => t.value || 0),
    }));
  } catch {
    return [];
  }
}

async function fetchDomainKeywords(
  domain: string,
  headers: Record<string, string>
): Promise<KEKeywordData[]> {
  try {
    const response = await axios.post(
      `${BASE_URL}/get_domain_keywords`,
      new URLSearchParams({ domain }),
      { headers }
    );

    const data = response.data?.data || [];
    return data.slice(0, 100).map((item: any) => ({
      keyword: item.keyword || '',
      vol: item.vol || 0,
      cpc: item.cpc?.value ? parseFloat(item.cpc.value) : 0,
      competition: item.competition || 0,
      trend: (item.trend || []).map((t: any) => t.value || 0),
    }));
  } catch {
    return [];
  }
}

// ============================================================
// Finding Generators
// ============================================================

function checkKeywordCoverage(domainKeywords: KEKeywordData[], findings: Finding[]) {
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

  // Check for volume distribution
  const highVolume = domainKeywords.filter(k => k.vol >= 1000);
  const medVolume = domainKeywords.filter(k => k.vol >= 100 && k.vol < 1000);
  const lowVolume = domainKeywords.filter(k => k.vol > 0 && k.vol < 100);

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
  relatedKeywords: KEKeywordData[],
  domainKeywords: KEKeywordData[],
  findings: Finding[]
) {
  if (relatedKeywords.length === 0) return;

  const domainKwSet = new Set(domainKeywords.map(k => k.keyword.toLowerCase()));

  // Find related keywords with good volume that the domain doesn't rank for
  const opportunities = relatedKeywords
    .filter(k => !domainKwSet.has(k.keyword.toLowerCase()) && k.vol >= 100)
    .sort((a, b) => b.vol - a.vol);

  if (opportunities.length > 0) {
    const topOpps = opportunities.slice(0, 10);
    const oppList = topOpps
      .map(k => `  "${k.keyword}" — ${k.vol.toLocaleString()} monthly searches, $${k.cpc.toFixed(2)} CPC`)
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

function checkCompetitionLevels(domainKeywords: KEKeywordData[], findings: Finding[]) {
  if (domainKeywords.length < 5) return;

  const highCompetition = domainKeywords.filter(k => k.competition > 0.7 && k.vol >= 100);
  const lowCompetition = domainKeywords.filter(k => k.competition < 0.3 && k.vol >= 100);

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

function checkKeywordTrends(domainKeywords: KEKeywordData[], findings: Finding[]) {
  if (domainKeywords.length === 0) return;

  // Check for declining keywords (last 3 months trend)
  const decliningKeywords = domainKeywords.filter(k => {
    if (!k.trend || k.trend.length < 6) return false;
    const recent = k.trend.slice(-3);
    const earlier = k.trend.slice(-6, -3);
    const recentAvg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const earlierAvg = earlier.reduce((s, v) => s + v, 0) / earlier.length;
    return earlierAvg > 0 && recentAvg < earlierAvg * 0.7 && k.vol >= 100;
  });

  if (decliningKeywords.length >= 3) {
    findings.push({
      id: 'kw-declining-trends',
      title: `${decliningKeywords.length} Keywords Showing Declining Trends`,
      description: 'Several keywords you rank for are showing declining search interest. Consider diversifying your keyword portfolio.',
      severity: 'info',
      category: 'keywords',
      subcategory: 'Trends',
      currentValue: `${decliningKeywords.length} declining keywords`,
      recommendedValue: 'Monitor and diversify keyword targets',
      howToFix: 'Review content targeting declining keywords. Consider: updating content to match current trends, finding rising alternative keywords in the same topic area, and creating content around emerging related topics.',
      impact: 'Declining keyword trends mean gradually decreasing traffic if not addressed. Proactive diversification prevents sudden traffic drops.',
      effort: 'medium',
    });
  }
}

// ============================================================
// Helpers
// ============================================================

function deduplicateKeywords(keywords: KEKeywordData[]): KEKeywordData[] {
  const seen = new Set<string>();
  return keywords.filter(k => {
    const lower = k.keyword.toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });
}
