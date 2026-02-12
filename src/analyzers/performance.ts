import axios from 'axios';
import type {
  CrawlResult,
  Finding,
  AnalyzerResult,
  PerformanceData,
  CoreWebVitals,
  LighthouseScores,
  MetricResult,
} from '../types.js';
import { calculateCategoryScore, getScoreSummary } from '../utils/scoring.js';

/**
 * Performance Analyzer
 *
 * Uses Google PageSpeed Insights API (free, no key required for basic usage)
 * to get Core Web Vitals and Lighthouse scores.
 * Falls back to basic analysis if API is unavailable.
 */
export async function analyzePerformance(
  crawl: CrawlResult,
  apiKey?: string
): Promise<AnalyzerResult> {
  const findings: Finding[] = [];

  // Try to get PageSpeed Insights data for both mobile and desktop
  let mobileData: PerformanceData | null = null;
  let desktopData: PerformanceData | null = null;

  try {
    [mobileData, desktopData] = await Promise.all([
      fetchPageSpeedData(crawl.finalUrl, 'mobile', apiKey),
      fetchPageSpeedData(crawl.finalUrl, 'desktop', apiKey),
    ]);
  } catch (err) {
    findings.push({
      id: 'perf-api-error',
      title: 'PageSpeed Insights API Unavailable',
      description: 'Could not fetch performance data from Google PageSpeed Insights. Basic performance analysis applied instead.',
      severity: 'info',
      category: 'performance',
      subcategory: 'API',
      howToFix: 'This is typically a temporary issue. You can manually check performance at https://pagespeed.web.dev/',
      impact: 'Without PageSpeed data, we cannot provide Core Web Vitals scores. Manual testing is recommended.',
      effort: 'low',
    });
  }

  // Analyze mobile performance (Google uses mobile-first indexing)
  if (mobileData) {
    analyzeCoreWebVitals(mobileData, 'Mobile', findings);
    analyzeLighthouseScores(mobileData, 'Mobile', findings);
  }

  // Analyze desktop performance
  if (desktopData) {
    analyzeLighthouseScores(desktopData, 'Desktop', findings);
  }

  // Basic performance checks from crawl data
  analyzeResponseTime(crawl, findings);
  analyzePageSize(crawl, findings);

  const score = mobileData
    ? Math.round(mobileData.lighthouseScores.performance)
    : calculateCategoryScore(findings);

  return {
    category: 'performance',
    categoryLabel: 'Performance & Core Web Vitals',
    score,
    maxScore: 100,
    findings,
    summary: getScoreSummary('Performance', score),
  };
}

async function fetchPageSpeedData(
  url: string,
  strategy: 'mobile' | 'desktop',
  apiKey?: string
): Promise<PerformanceData> {
  const params: Record<string, string> = {
    url,
    strategy,
    category: 'PERFORMANCE',
  };

  if (apiKey) {
    params.key = apiKey;
  }

  const response = await axios.get(
    'https://www.googleapis.com/pagespeedonline/v5/runPagespeed',
    {
      params,
      timeout: 60000, // PageSpeed can take a while
    }
  );

  const data = response.data;
  const loadingExperience = data.loadingExperience?.overall_category || 'NONE';
  const lighthouseResult = data.lighthouseResult;

  // Extract Core Web Vitals from field data (real user data) or lab data
  const fieldMetrics = data.loadingExperience?.metrics || {};
  const labAudits = lighthouseResult?.audits || {};

  const coreWebVitals: CoreWebVitals = {};

  // LCP
  if (fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS) {
    const lcpField = fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS;
    coreWebVitals.lcp = {
      value: lcpField.percentile,
      unit: 'ms',
      rating: lcpField.category === 'FAST' ? 'good' : lcpField.category === 'AVERAGE' ? 'needs-improvement' : 'poor',
    };
  } else if (labAudits['largest-contentful-paint']) {
    const lcpValue = labAudits['largest-contentful-paint'].numericValue;
    coreWebVitals.lcp = {
      value: Math.round(lcpValue),
      unit: 'ms',
      rating: lcpValue <= 2500 ? 'good' : lcpValue <= 4000 ? 'needs-improvement' : 'poor',
    };
  }

  // CLS
  if (fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE) {
    const clsField = fieldMetrics.CUMULATIVE_LAYOUT_SHIFT_SCORE;
    coreWebVitals.cls = {
      value: clsField.percentile / 100, // API returns as percentage
      unit: '',
      rating: clsField.category === 'FAST' ? 'good' : clsField.category === 'AVERAGE' ? 'needs-improvement' : 'poor',
    };
  } else if (labAudits['cumulative-layout-shift']) {
    const clsValue = labAudits['cumulative-layout-shift'].numericValue;
    coreWebVitals.cls = {
      value: Math.round(clsValue * 1000) / 1000,
      unit: '',
      rating: clsValue <= 0.1 ? 'good' : clsValue <= 0.25 ? 'needs-improvement' : 'poor',
    };
  }

  // INP (Interaction to Next Paint - replaced FID)
  if (fieldMetrics.INTERACTION_TO_NEXT_PAINT) {
    const inpField = fieldMetrics.INTERACTION_TO_NEXT_PAINT;
    coreWebVitals.inp = {
      value: inpField.percentile,
      unit: 'ms',
      rating: inpField.category === 'FAST' ? 'good' : inpField.category === 'AVERAGE' ? 'needs-improvement' : 'poor',
    };
  }

  // FCP
  if (fieldMetrics.FIRST_CONTENTFUL_PAINT_MS) {
    const fcpField = fieldMetrics.FIRST_CONTENTFUL_PAINT_MS;
    coreWebVitals.fcp = {
      value: fcpField.percentile,
      unit: 'ms',
      rating: fcpField.category === 'FAST' ? 'good' : fcpField.category === 'AVERAGE' ? 'needs-improvement' : 'poor',
    };
  } else if (labAudits['first-contentful-paint']) {
    const fcpValue = labAudits['first-contentful-paint'].numericValue;
    coreWebVitals.fcp = {
      value: Math.round(fcpValue),
      unit: 'ms',
      rating: fcpValue <= 1800 ? 'good' : fcpValue <= 3000 ? 'needs-improvement' : 'poor',
    };
  }

  // TTFB
  if (fieldMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE) {
    const ttfbField = fieldMetrics.EXPERIMENTAL_TIME_TO_FIRST_BYTE;
    coreWebVitals.ttfb = {
      value: ttfbField.percentile,
      unit: 'ms',
      rating: ttfbField.category === 'FAST' ? 'good' : ttfbField.category === 'AVERAGE' ? 'needs-improvement' : 'poor',
    };
  } else if (labAudits['server-response-time']) {
    const ttfbValue = labAudits['server-response-time'].numericValue;
    coreWebVitals.ttfb = {
      value: Math.round(ttfbValue),
      unit: 'ms',
      rating: ttfbValue <= 800 ? 'good' : ttfbValue <= 1800 ? 'needs-improvement' : 'poor',
    };
  }

  // Lighthouse scores
  const categories = lighthouseResult?.categories || {};
  const lighthouseScores: LighthouseScores = {
    performance: (categories.performance?.score || 0) * 100,
    accessibility: (categories.accessibility?.score || 0) * 100,
    bestPractices: (categories['best-practices']?.score || 0) * 100,
    seo: (categories.seo?.score || 0) * 100,
  };

  return {
    coreWebVitals,
    lighthouseScores,
    loadingExperience: loadingExperience as PerformanceData['loadingExperience'],
    strategy,
  };
}

function analyzeCoreWebVitals(
  data: PerformanceData,
  label: string,
  findings: Finding[]
) {
  const { coreWebVitals } = data;

  // LCP
  if (coreWebVitals.lcp) {
    if (coreWebVitals.lcp.rating === 'poor') {
      findings.push({
        id: `perf-lcp-poor-${data.strategy}`,
        title: `${label}: Poor Largest Contentful Paint (LCP)`,
        description: `LCP is ${coreWebVitals.lcp.value}ms. This means the main content takes too long to appear. Google's threshold: under 2500ms.`,
        severity: 'critical',
        category: 'performance',
        subcategory: 'Core Web Vitals',
        currentValue: `${coreWebVitals.lcp.value}ms`,
        recommendedValue: '≤ 2500ms',
        howToFix: 'Common fixes: Optimize and compress images (use WebP/AVIF), implement lazy loading, reduce server response time, minimize render-blocking CSS/JS, use a CDN, preload critical resources.',
        impact: 'LCP is a Core Web Vital and a direct ranking factor. Poor LCP means users see a blank/loading page for too long, increasing bounce rate.',
        effort: 'high',
      });
    } else if (coreWebVitals.lcp.rating === 'needs-improvement') {
      findings.push({
        id: `perf-lcp-mid-${data.strategy}`,
        title: `${label}: LCP Needs Improvement`,
        description: `LCP is ${coreWebVitals.lcp.value}ms. It's okay but could be better. Target: under 2500ms.`,
        severity: 'medium',
        category: 'performance',
        subcategory: 'Core Web Vitals',
        currentValue: `${coreWebVitals.lcp.value}ms`,
        recommendedValue: '≤ 2500ms',
        howToFix: 'Optimize the largest element on the page (usually a hero image or large text block). Compress images, enable caching, and consider preloading the LCP element.',
        impact: 'Improving LCP to "good" status gives a ranking boost and improves user experience.',
        effort: 'medium',
      });
    }
  }

  // CLS
  if (coreWebVitals.cls) {
    if (coreWebVitals.cls.rating === 'poor') {
      findings.push({
        id: `perf-cls-poor-${data.strategy}`,
        title: `${label}: Poor Cumulative Layout Shift (CLS)`,
        description: `CLS score is ${coreWebVitals.cls.value}. The page layout shifts significantly during loading, frustrating users. Google's threshold: under 0.1.`,
        severity: 'critical',
        category: 'performance',
        subcategory: 'Core Web Vitals',
        currentValue: `${coreWebVitals.cls.value}`,
        recommendedValue: '≤ 0.1',
        howToFix: 'Common fixes: Always set width/height on images and videos, avoid inserting content above existing content, use CSS contain for dynamic content, preload fonts, avoid late-loading ads that push content around.',
        impact: 'CLS is a Core Web Vital and ranking factor. Layout shifts cause users to click wrong elements and create a frustrating experience.',
        effort: 'medium',
      });
    } else if (coreWebVitals.cls.rating === 'needs-improvement') {
      findings.push({
        id: `perf-cls-mid-${data.strategy}`,
        title: `${label}: CLS Needs Improvement`,
        description: `CLS score is ${coreWebVitals.cls.value}. Some layout shift detected. Target: under 0.1.`,
        severity: 'medium',
        category: 'performance',
        subcategory: 'Core Web Vitals',
        currentValue: `${coreWebVitals.cls.value}`,
        recommendedValue: '≤ 0.1',
        howToFix: 'Review the page for elements that shift during load. Set explicit dimensions on images, embed containers, and ad slots.',
        impact: 'Improving CLS improves user experience and provides a ranking signal boost.',
        effort: 'medium',
      });
    }
  }

  // INP
  if (coreWebVitals.inp) {
    if (coreWebVitals.inp.rating === 'poor') {
      findings.push({
        id: `perf-inp-poor-${data.strategy}`,
        title: `${label}: Poor Interaction to Next Paint (INP)`,
        description: `INP is ${coreWebVitals.inp.value}ms. The page responds slowly to user interactions. Google's threshold: under 200ms.`,
        severity: 'high',
        category: 'performance',
        subcategory: 'Core Web Vitals',
        currentValue: `${coreWebVitals.inp.value}ms`,
        recommendedValue: '≤ 200ms',
        howToFix: 'Reduce JavaScript execution time, break up long tasks, optimize event handlers, minimize main thread work, use web workers for heavy processing.',
        impact: 'INP replaced FID as a Core Web Vital in 2024. Poor INP means users experience lag when clicking, typing, or tapping.',
        effort: 'high',
      });
    } else if (coreWebVitals.inp.rating === 'needs-improvement') {
      findings.push({
        id: `perf-inp-mid-${data.strategy}`,
        title: `${label}: INP Needs Improvement`,
        description: `INP is ${coreWebVitals.inp.value}ms. Interactions could be more responsive. Target: under 200ms.`,
        severity: 'medium',
        category: 'performance',
        subcategory: 'Core Web Vitals',
        currentValue: `${coreWebVitals.inp.value}ms`,
        recommendedValue: '≤ 200ms',
        howToFix: 'Optimize event handlers, reduce JavaScript bundle size, defer non-critical scripts, and minimize DOM size.',
        impact: 'Better INP creates a snappier user experience and contributes to ranking signals.',
        effort: 'medium',
      });
    }
  }
}

function analyzeLighthouseScores(
  data: PerformanceData,
  label: string,
  findings: Finding[]
) {
  const { lighthouseScores } = data;

  if (lighthouseScores.performance < 50) {
    findings.push({
      id: `perf-lighthouse-poor-${data.strategy}`,
      title: `${label}: Poor Lighthouse Performance Score`,
      description: `The Lighthouse performance score is ${Math.round(lighthouseScores.performance)}/100. This indicates significant performance issues.`,
      severity: 'high',
      category: 'performance',
      subcategory: 'Lighthouse',
      currentValue: `${Math.round(lighthouseScores.performance)}/100`,
      recommendedValue: '90+/100',
      howToFix: 'Run a full Lighthouse audit at https://pagespeed.web.dev/ for detailed recommendations. Focus on the largest opportunities first: image optimization, JavaScript reduction, and server response time.',
      impact: 'A low performance score correlates with slow page loads, poor user experience, and lower search rankings.',
      effort: 'high',
    });
  } else if (lighthouseScores.performance < 90) {
    findings.push({
      id: `perf-lighthouse-mid-${data.strategy}`,
      title: `${label}: Lighthouse Performance Score Could Improve`,
      description: `The Lighthouse performance score is ${Math.round(lighthouseScores.performance)}/100. Good, but there's room for improvement.`,
      severity: 'low',
      category: 'performance',
      subcategory: 'Lighthouse',
      currentValue: `${Math.round(lighthouseScores.performance)}/100`,
      recommendedValue: '90+/100',
      howToFix: 'Check https://pagespeed.web.dev/ for specific optimization opportunities to push the score into the green (90+).',
      impact: 'Pushing the performance score above 90 ensures the best possible speed experience for users.',
      effort: 'medium',
    });
  }

  // Accessibility score
  if (lighthouseScores.accessibility < 80) {
    findings.push({
      id: `perf-a11y-${data.strategy}`,
      title: `${label}: Accessibility Issues Detected`,
      description: `Lighthouse accessibility score is ${Math.round(lighthouseScores.accessibility)}/100.`,
      severity: lighthouseScores.accessibility < 50 ? 'high' : 'medium',
      category: 'performance',
      subcategory: 'Accessibility',
      currentValue: `${Math.round(lighthouseScores.accessibility)}/100`,
      recommendedValue: '90+/100',
      howToFix: 'Common fixes: Add alt text to images, ensure sufficient color contrast, use semantic HTML, add ARIA labels, ensure all interactive elements are keyboard accessible.',
      impact: 'Accessibility issues prevent users with disabilities from using the site. Google has indicated that accessible sites may receive ranking benefits.',
      effort: 'medium',
    });
  }

  // Built-in SEO score from Lighthouse
  if (lighthouseScores.seo < 80) {
    findings.push({
      id: `perf-seo-score-${data.strategy}`,
      title: `${label}: Lighthouse SEO Score Is Low`,
      description: `Lighthouse SEO score is ${Math.round(lighthouseScores.seo)}/100, indicating technical SEO issues.`,
      severity: lighthouseScores.seo < 50 ? 'high' : 'medium',
      category: 'performance',
      subcategory: 'Lighthouse SEO',
      currentValue: `${Math.round(lighthouseScores.seo)}/100`,
      recommendedValue: '90+/100',
      howToFix: 'Review the Lighthouse SEO audit for specific issues. Common problems: missing meta tags, non-crawlable links, small tap targets, missing viewport tag.',
      impact: 'Lighthouse SEO checks cover basic technical requirements. Failing these indicates fundamental issues that prevent proper indexing.',
      effort: 'medium',
    });
  }
}

function analyzeResponseTime(crawl: CrawlResult, findings: Finding[]) {
  if (crawl.responseTime > 3000) {
    findings.push({
      id: 'perf-slow-response',
      title: 'Slow Server Response Time',
      description: `The server took ${crawl.responseTime}ms to respond. This is significantly above the recommended threshold.`,
      severity: 'high',
      category: 'performance',
      subcategory: 'Server',
      currentValue: `${crawl.responseTime}ms`,
      recommendedValue: '< 600ms',
      howToFix: 'Investigate server-side performance: enable server-side caching, optimize database queries, upgrade hosting, use a CDN, implement HTTP/2 or HTTP/3.',
      impact: 'Slow server response time affects all other performance metrics. Google recommends TTFB under 600ms.',
      effort: 'high',
    });
  } else if (crawl.responseTime > 1000) {
    findings.push({
      id: 'perf-response-warning',
      title: 'Server Response Time Could Be Faster',
      description: `The server responded in ${crawl.responseTime}ms. Aim for under 600ms.`,
      severity: 'medium',
      category: 'performance',
      subcategory: 'Server',
      currentValue: `${crawl.responseTime}ms`,
      recommendedValue: '< 600ms',
      howToFix: 'Consider server-side caching, CDN implementation, or hosting upgrade to reduce response time.',
      impact: 'Faster server responses improve all performance metrics and user experience.',
      effort: 'medium',
    });
  }
}

function analyzePageSize(crawl: CrawlResult, findings: Finding[]) {
  const sizeKB = Math.round(crawl.contentLength / 1024);

  if (sizeKB > 3000) {
    findings.push({
      id: 'perf-page-large',
      title: 'Page Size Is Very Large',
      description: `The HTML document is ${sizeKB}KB. Large pages take longer to download and parse.`,
      severity: 'medium',
      category: 'performance',
      subcategory: 'Page Size',
      currentValue: `${sizeKB}KB`,
      recommendedValue: '< 500KB for HTML',
      howToFix: 'Reduce HTML size by: removing inline CSS/JS (move to external files), compressing HTML, removing unused code, lazy loading off-screen content.',
      impact: 'Smaller pages load faster, especially on mobile connections. This directly affects user experience and Core Web Vitals.',
      effort: 'medium',
    });
  }
}

export { fetchPageSpeedData };
