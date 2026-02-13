import type {
  AnalyzerResult,
  Finding,
  GSCConfig,
  GSCData,
  GSCSearchAnalytics,
  GSCQueryRow,
  GSCPageRow,
  GSCSitemapStatus,
} from '../types.js';
import { calculateCategoryScore, getScoreSummary } from '../utils/scoring.js';

/**
 * Google Search Console Analyzer
 *
 * Pulls real search performance data and produces findings:
 * - Low-CTR pages (high impressions, low clicks)
 * - High-impression queries with low clicks (keyword opportunities)
 * - Position benchmarking
 * - Sitemap health
 * - Overall search visibility assessment
 */
export async function analyzeSearchConsole(
  gscConfig: GSCConfig
): Promise<{ result: AnalyzerResult; data: GSCData }> {
  const { google } = await import('googleapis');

  const auth = new google.auth.GoogleAuth({
    keyFile: gscConfig.keyFilePath,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  });

  const searchconsole = google.searchconsole({ version: 'v1', auth });
  const webmasters = google.webmasters({ version: 'v3', auth });

  const endDate = gscConfig.dateRange?.endDate || formatDate(new Date());
  const startDate = gscConfig.dateRange?.startDate || formatDate(daysAgo(90));

  // Fetch query data and page data in parallel
  const [queryData, pageData, sitemaps] = await Promise.all([
    fetchQueryData(searchconsole, gscConfig.siteUrl, startDate, endDate),
    fetchPageData(searchconsole, gscConfig.siteUrl, startDate, endDate),
    fetchSitemapStatus(webmasters, gscConfig.siteUrl),
  ]);

  // Compute aggregated metrics
  const totalClicks = queryData.reduce((sum, q) => sum + q.clicks, 0);
  const totalImpressions = queryData.reduce((sum, q) => sum + q.impressions, 0);
  const averageCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;

  // Weighted average position (weighted by impressions)
  const weightedPos = queryData.reduce((sum, q) => sum + q.position * q.impressions, 0);
  const averagePosition = totalImpressions > 0 ? weightedPos / totalImpressions : 0;

  const searchAnalytics: GSCSearchAnalytics = {
    totalClicks,
    totalImpressions,
    averageCtr: Math.round(averageCtr * 10000) / 100, // As percentage
    averagePosition: Math.round(averagePosition * 10) / 10,
    topQueries: queryData.slice(0, 50),
    topPages: pageData.slice(0, 50),
    queryCount: queryData.length,
    pageCount: pageData.length,
  };

  const gscData: GSCData = {
    searchAnalytics,
    sitemapStatus: sitemaps,
  };

  // Generate findings
  const findings: Finding[] = [];

  checkOverallVisibility(searchAnalytics, findings);
  checkLowCtrPages(pageData, findings);
  checkOpportunityQueries(queryData, findings);
  checkPositionBenchmarks(queryData, findings);
  checkSitemapIssues(sitemaps, findings);

  const score = calculateCategoryScore(findings);

  return {
    result: {
      category: 'search-console',
      categoryLabel: 'Search Console Insights',
      score,
      maxScore: 100,
      findings,
      summary: getScoreSummary('Search Console', score),
    },
    data: gscData,
  };
}

// ============================================================
// Data Fetching
// ============================================================

async function fetchQueryData(
  searchconsole: any,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<GSCQueryRow[]> {
  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['query'],
        rowLimit: 500,
        dataState: 'final',
      },
    });

    return (response.data.rows || []).map((row: any) => ({
      query: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: Math.round((row.ctr || 0) * 10000) / 100,
      position: Math.round((row.position || 0) * 10) / 10,
    }));
  } catch {
    return [];
  }
}

async function fetchPageData(
  searchconsole: any,
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<GSCPageRow[]> {
  try {
    const response = await searchconsole.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        dimensions: ['page'],
        rowLimit: 500,
        dataState: 'final',
      },
    });

    return (response.data.rows || []).map((row: any) => ({
      page: row.keys[0],
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: Math.round((row.ctr || 0) * 10000) / 100,
      position: Math.round((row.position || 0) * 10) / 10,
    }));
  } catch {
    return [];
  }
}

async function fetchSitemapStatus(
  webmasters: any,
  siteUrl: string
): Promise<GSCSitemapStatus[]> {
  try {
    const response = await webmasters.sitemaps.list({ siteUrl });
    return (response.data.sitemap || []).map((sm: any) => ({
      path: sm.path || '',
      lastSubmitted: sm.lastSubmitted || '',
      lastDownloaded: sm.lastDownloaded || '',
      isPending: sm.isPending || false,
      urlsDiscovered: sm.contents?.reduce(
        (sum: number, c: any) => sum + (c.submitted ? parseInt(c.submitted, 10) : 0), 0
      ) || 0,
    }));
  } catch {
    return [];
  }
}

// ============================================================
// Finding Generators
// ============================================================

function checkOverallVisibility(analytics: GSCSearchAnalytics, findings: Finding[]) {
  if (analytics.totalImpressions < 100) {
    findings.push({
      id: 'gsc-low-impressions',
      title: 'Very Low Search Visibility',
      description: `The site received only ${analytics.totalImpressions} impressions in the last 90 days. This indicates very limited presence in search results.`,
      severity: 'high',
      category: 'search-console',
      subcategory: 'Visibility',
      currentValue: `${analytics.totalImpressions} impressions / 90 days`,
      recommendedValue: '1,000+ impressions / 90 days minimum',
      howToFix: 'Focus on creating content targeting specific keywords your audience searches for. Ensure the site is properly indexed (submit sitemap to GSC). Consider targeting long-tail keywords with lower competition initially.',
      impact: 'Low impressions mean the site is not appearing in search results for relevant queries. This is the most fundamental SEO metric — you cannot get clicks without impressions.',
      effort: 'high',
    });
  }

  if (analytics.averageCtr < 2 && analytics.totalImpressions >= 1000) {
    findings.push({
      id: 'gsc-low-overall-ctr',
      title: 'Below-Average Click-Through Rate',
      description: `The site's average CTR is ${analytics.averageCtr}%. The benchmark for most industries is 3-5%.`,
      severity: 'medium',
      category: 'search-console',
      subcategory: 'CTR',
      currentValue: `${analytics.averageCtr}% CTR`,
      recommendedValue: '3-5% average CTR',
      howToFix: 'Improve title tags to be more compelling and keyword-rich. Write meta descriptions with clear calls-to-action. Implement structured data for rich results (star ratings, FAQs, etc.) which increase visual appeal in search results.',
      impact: 'Low CTR means people see your site in results but don\'t click. Improving CTR directly increases organic traffic without needing to improve rankings.',
      effort: 'medium',
    });
  }

  if (analytics.averagePosition > 20 && analytics.totalImpressions >= 500) {
    findings.push({
      id: 'gsc-low-avg-position',
      title: 'Low Average Search Position',
      description: `The average position is ${analytics.averagePosition}, meaning most queries appear on page 2+ of Google results.`,
      severity: 'medium',
      category: 'search-console',
      subcategory: 'Rankings',
      currentValue: `Average position: ${analytics.averagePosition}`,
      recommendedValue: 'Average position under 15 (page 1-2)',
      howToFix: 'Identify queries ranking in positions 8-20 (the "striking distance" zone) and optimize those pages specifically. Improve content depth, add internal links, earn backlinks to push these pages onto page 1.',
      impact: 'Pages on page 1 of Google receive ~90% of all clicks. Moving from page 2 to page 1 can increase traffic 5-10x for those queries.',
      effort: 'high',
    });
  }
}

function checkLowCtrPages(pages: GSCPageRow[], findings: Finding[]) {
  // Find pages with high impressions but low CTR
  const lowCtrPages = pages.filter(p =>
    p.impressions >= 500 && p.ctr < 2
  ).sort((a, b) => b.impressions - a.impressions);

  if (lowCtrPages.length > 0) {
    const topPages = lowCtrPages.slice(0, 5);
    const pageList = topPages
      .map(p => `  ${p.page} — ${p.impressions} impressions, ${p.ctr}% CTR`)
      .join('\n');

    findings.push({
      id: 'gsc-low-ctr-pages',
      title: `${lowCtrPages.length} Pages with High Impressions but Low CTR`,
      description: `These pages appear frequently in search results but rarely get clicked. There is significant untapped traffic potential.`,
      severity: 'high',
      category: 'search-console',
      subcategory: 'CTR Optimization',
      currentValue: `${lowCtrPages.length} pages with CTR below 2%`,
      recommendedValue: 'CTR above 3% for high-impression pages',
      howToFix: `Optimize title tags and meta descriptions for these pages to increase clicks:\n${pageList}\n\nFor each page: rewrite the title to be more compelling, add power words, include the target keyword early, and write a meta description with a clear call-to-action.`,
      impact: 'Improving CTR from 2% to 4% on these pages could double their organic traffic without any ranking changes.',
      effort: 'low',
    });
  }
}

function checkOpportunityQueries(queries: GSCQueryRow[], findings: Finding[]) {
  // Find high-impression queries with low clicks (opportunity keywords)
  const opportunities = queries.filter(q =>
    q.impressions >= 200 && q.clicks < 5 && q.position <= 30
  ).sort((a, b) => b.impressions - a.impressions);

  if (opportunities.length > 0) {
    const topOpps = opportunities.slice(0, 10);
    const queryList = topOpps
      .map(q => `  "${q.query}" — ${q.impressions} imp, ${q.clicks} clicks, pos ${q.position}`)
      .join('\n');

    findings.push({
      id: 'gsc-opportunity-queries',
      title: `${opportunities.length} Keyword Opportunities Identified`,
      description: `These queries have significant search volume but are not generating clicks. They represent your highest-ROI content opportunities.`,
      severity: 'medium',
      category: 'search-console',
      subcategory: 'Keyword Opportunities',
      currentValue: `${opportunities.length} underperforming queries`,
      recommendedValue: 'Targeted content for each opportunity keyword',
      howToFix: `Create or optimize content targeting these queries:\n${queryList}\n\nFor queries where you rank 8-20: optimize the existing ranking page (improve content, add sections, update title). For queries where you rank 20+: consider creating new, dedicated content targeting that specific query.`,
      impact: 'These keywords represent proven demand — people are searching for them and seeing your site. Optimizing for them is lower risk than targeting untested keywords.',
      effort: 'medium',
    });
  }

  // "Striking distance" keywords — positions 4-15 that could reach page 1 top spots
  const strikingDistance = queries.filter(q =>
    q.position >= 4 && q.position <= 15 && q.impressions >= 100
  ).sort((a, b) => a.position - b.position);

  if (strikingDistance.length > 0) {
    const topStriking = strikingDistance.slice(0, 10);
    const queryList = topStriking
      .map(q => `  "${q.query}" — pos ${q.position}, ${q.impressions} imp, ${q.clicks} clicks`)
      .join('\n');

    findings.push({
      id: 'gsc-striking-distance',
      title: `${strikingDistance.length} "Striking Distance" Keywords (Positions 4-15)`,
      description: `These keywords are close to the top of page 1. Small improvements could significantly boost traffic.`,
      severity: 'medium',
      category: 'search-console',
      subcategory: 'Keyword Opportunities',
      currentValue: `${strikingDistance.length} keywords in positions 4-15`,
      recommendedValue: 'Move to positions 1-3 for maximum CTR',
      howToFix: `Focus optimization efforts on pushing these keywords to positions 1-3:\n${queryList}\n\nTactics: add more comprehensive content to the ranking page, earn backlinks to it, improve internal linking, ensure the page fully answers the query intent.`,
      impact: 'Position 1 gets ~28% CTR, position 3 gets ~11%, position 10 gets ~2.5%. Moving from position 8 to position 3 can 4x your traffic for that keyword.',
      effort: 'medium',
    });
  }
}

function checkPositionBenchmarks(queries: GSCQueryRow[], findings: Finding[]) {
  if (queries.length === 0) return;

  // Count queries by position bucket
  const positionBuckets = {
    top3: queries.filter(q => q.position <= 3).length,
    page1: queries.filter(q => q.position <= 10).length,
    page2: queries.filter(q => q.position > 10 && q.position <= 20).length,
    page3Plus: queries.filter(q => q.position > 20).length,
  };

  const total = queries.length;
  const page1Pct = Math.round((positionBuckets.page1 / total) * 100);

  if (page1Pct < 20 && total >= 10) {
    findings.push({
      id: 'gsc-low-page1-ratio',
      title: 'Low Page 1 Ranking Ratio',
      description: `Only ${page1Pct}% of your tracked queries (${positionBuckets.page1} of ${total}) rank on page 1 of Google.`,
      severity: 'medium',
      category: 'search-console',
      subcategory: 'Rankings',
      currentValue: `${page1Pct}% on page 1 (${positionBuckets.page1}/${total})`,
      recommendedValue: '30%+ of queries on page 1',
      howToFix: 'Prioritize content quality and relevance for your target keywords. Focus on comprehensive content that fully satisfies search intent, build topical authority with supporting content, and earn quality backlinks.',
      impact: 'Page 1 of Google receives ~90% of all search clicks. Increasing your page 1 presence directly translates to more organic traffic.',
      effort: 'high',
    });
  }
}

function checkSitemapIssues(sitemaps: GSCSitemapStatus[], findings: Finding[]) {
  if (sitemaps.length === 0) {
    findings.push({
      id: 'gsc-no-sitemap-submitted',
      title: 'No Sitemap Submitted to Search Console',
      description: 'No sitemaps are submitted in Google Search Console. Submitting a sitemap helps Google discover and index your pages faster.',
      severity: 'medium',
      category: 'search-console',
      subcategory: 'Sitemap',
      recommendedValue: 'Submit XML sitemap in Google Search Console',
      howToFix: 'Go to Google Search Console → Sitemaps → Add a new sitemap. Enter your sitemap URL (usually /sitemap.xml). Verify it shows as "Success" after processing.',
      impact: 'Submitted sitemaps help Google discover new and updated pages faster. Without a sitemap, Google relies on crawling links, which can miss pages.',
      effort: 'low',
    });
  }

  // Check for stale sitemaps
  for (const sm of sitemaps) {
    if (sm.lastDownloaded) {
      const lastDownloaded = new Date(sm.lastDownloaded);
      const daysSinceDownload = Math.ceil((Date.now() - lastDownloaded.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceDownload > 30) {
        findings.push({
          id: 'gsc-sitemap-stale',
          title: 'Sitemap Not Re-Downloaded Recently',
          description: `Sitemap "${sm.path}" was last downloaded by Google ${daysSinceDownload} days ago. This may indicate the sitemap is not being updated or has issues.`,
          severity: 'low',
          category: 'search-console',
          subcategory: 'Sitemap',
          currentValue: `Last downloaded ${daysSinceDownload} days ago`,
          recommendedValue: 'Sitemap re-downloaded within the last 7-14 days',
          howToFix: 'Ensure your sitemap is being regenerated when content changes. Re-submit the sitemap in Google Search Console. Check for errors in the sitemap report.',
          impact: 'A stale sitemap means Google may not be discovering your newest or updated content.',
          effort: 'low',
        });
        break; // Only report once
      }
    }
  }
}

// ============================================================
// Helpers
// ============================================================

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}
