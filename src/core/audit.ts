import type {
  AuditReport, AnalyzerResult, ToolConfig, CrawlResult,
  GSCConfig, GSCData, DataforSEOConfig, DataforSEOBacklinkSummary,
  DataforSEOKeywordData,
} from '../types.js';
import { crawlUrl } from '../utils/crawler.js';
import { analyzeTechnical } from '../analyzers/technical.js';
import { analyzeOnPage } from '../analyzers/onpage.js';
import { analyzePerformance } from '../analyzers/performance.js';
import { analyzeSchema } from '../analyzers/schema.js';
import { analyzeAEO } from '../analyzers/aeo.js';
import { generateTaskPlan } from '../tasks/generator.js';
import { generateReport } from '../reports/generator.js';
import { calculateOverallScore, getGrade } from '../utils/scoring.js';
import { DEFAULT_CONFIG } from '../types.js';

/**
 * Audit options — framework-agnostic.
 * The CLI and web dashboard both use this.
 */
export interface AuditOptions {
  url: string;
  config?: Partial<ToolConfig>;
  pageSpeedApiKey?: string;
  skipPerformance?: boolean;
  gscKeyFile?: string;
  skipSearchConsole?: boolean;
  dataforseoLogin?: string;
  dataforseoPassword?: string;
  skipBacklinks?: boolean;
  skipKeywords?: boolean;
  seedKeywords?: string[];
  onProgress?: (step: string, detail?: string) => void;
}

export interface AuditResult {
  report: AuditReport;
  html: string;
}

/**
 * Core audit orchestrator.
 * Crawls the URL, runs all analyzers, generates task plan and report.
 * Decoupled from any UI framework — the CLI wraps this with spinners,
 * the web dashboard wraps it with SSE progress events.
 */
export async function runCoreAudit(options: AuditOptions): Promise<AuditResult> {
  const config = { ...DEFAULT_CONFIG, ...options.config };
  const progress = options.onProgress || (() => {});

  // Step 1: Crawl
  progress('crawling', `Crawling ${options.url}...`);
  const crawlResult = await crawlUrl(options.url, config);

  // Step 2: Run analyzers
  progress('analyzing', 'Running SEO analysis...');
  const results: AnalyzerResult[] = [];

  progress('analyzing', 'Analyzing technical SEO...');
  results.push(analyzeTechnical(crawlResult));

  progress('analyzing', 'Analyzing on-page SEO...');
  results.push(analyzeOnPage(crawlResult));

  if (!options.skipPerformance) {
    progress('analyzing', 'Analyzing performance (this may take a moment)...');
    try {
      const perfResult = await analyzePerformance(crawlResult, options.pageSpeedApiKey);
      results.push(perfResult);
    } catch {
      // Graceful degradation — performance analysis is optional
    }
  }

  progress('analyzing', 'Analyzing structured data...');
  results.push(analyzeSchema(crawlResult));

  progress('analyzing', 'Analyzing AEO / AI readiness...');
  results.push(analyzeAEO(crawlResult));

  // Step 2b: Google Search Console (optional)
  let gscData: GSCData | undefined;
  if (!options.skipSearchConsole && options.gscKeyFile) {
    progress('gsc', 'Fetching Search Console data...');
    try {
      const { analyzeSearchConsole } = await import('../analyzers/search-console.js');
      const gscConfig: GSCConfig = {
        keyFilePath: options.gscKeyFile,
        siteUrl: crawlResult.finalUrl.endsWith('/')
          ? crawlResult.finalUrl
          : crawlResult.finalUrl + '/',
      };
      const gscResult = await analyzeSearchConsole(gscConfig);
      results.push(gscResult.result);
      gscData = gscResult.data;
    } catch {
      // GSC is optional — skip gracefully
    }
  }

  // Step 2c: DataforSEO Backlinks (optional)
  let backlinkData: DataforSEOBacklinkSummary | undefined;
  if (!options.skipBacklinks && options.dataforseoLogin && options.dataforseoPassword) {
    progress('backlinks', 'Analyzing backlink profile (DataforSEO)...');
    try {
      const { analyzeBacklinks } = await import('../analyzers/dataforseo.js');
      const domain = new URL(crawlResult.finalUrl).hostname;
      const dfsConfig: DataforSEOConfig = {
        login: options.dataforseoLogin,
        password: options.dataforseoPassword,
      };
      const blResult = await analyzeBacklinks(domain, dfsConfig);
      results.push(blResult.result);
      backlinkData = blResult.data;
    } catch {
      // Backlinks are optional — skip gracefully
    }
  }

  // Step 2d: Keyword Intelligence via DataforSEO (optional — uses same credentials as backlinks)
  let keywordData: DataforSEOKeywordData[] | undefined;
  if (!options.skipKeywords && options.dataforseoLogin && options.dataforseoPassword) {
    progress('keywords', 'Analyzing keyword intelligence (DataforSEO)...');
    try {
      const { analyzeKeywordIntelligence } = await import('../analyzers/dataforseo.js');
      const domain = new URL(crawlResult.finalUrl).hostname;
      const dfsConfig: DataforSEOConfig = {
        login: options.dataforseoLogin,
        password: options.dataforseoPassword,
      };
      const kwResult = await analyzeKeywordIntelligence(domain, dfsConfig, options.seedKeywords);
      results.push(kwResult.result);
      keywordData = kwResult.data;
    } catch {
      // Keywords are optional — skip gracefully
    }
  }

  progress('analyzing', `Analysis complete — ${results.length} categories evaluated`);

  // Step 3: Generate task plan
  progress('planning', 'Generating task plan...');
  const taskPlan = generateTaskPlan(crawlResult.finalUrl, results);

  // Step 4: Build report
  const overallScore = calculateOverallScore(results);
  const executiveSummary = buildExecutiveSummary(crawlResult, results, overallScore);

  const report: AuditReport = {
    url: options.url,
    finalUrl: crawlResult.finalUrl,
    generatedAt: new Date().toISOString(),
    overallScore,
    categories: results,
    taskPlan,
    executiveSummary,
    crawlData: crawlResult,
    gscData,
    backlinkData,
    keywordData,
  };

  // Step 5: Generate HTML report
  progress('reporting', 'Generating report...');
  const html = generateReport(report);

  return { report, html };
}

function buildExecutiveSummary(
  crawl: CrawlResult,
  results: AnalyzerResult[],
  overallScore: number
): string {
  const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
  const criticals = results.reduce(
    (sum, r) => sum + r.findings.filter(f => f.severity === 'critical').length, 0
  );
  const quickWins = results.reduce(
    (sum, r) => sum + r.findings.filter(f => f.effort === 'low' && f.severity !== 'info').length, 0
  );

  let summary = `This SEO audit of ${crawl.finalUrl} identified ${totalFindings} findings across ${results.length} categories, resulting in an overall score of ${overallScore}/100 (${getGrade(overallScore)}).`;
  if (criticals > 0) summary += ` There are ${criticals} critical issues that should be addressed immediately.`;
  if (quickWins > 0) summary += ` ${quickWins} quick wins were identified that can be resolved with minimal effort.`;
  summary += ` The generated task plan provides a structured 6-month roadmap, starting with the most impactful fixes and building toward comprehensive optimization.`;
  return summary;
}
