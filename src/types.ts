// ============================================================
// Core Types for IDP SEO Tool
// ============================================================

/** Severity levels for SEO findings, ordered by urgency */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Effort required to fix a finding */
export type Effort = 'low' | 'medium' | 'high';

/** SEO audit categories */
export type AuditCategory = 'technical' | 'onpage' | 'performance' | 'schema' | 'aeo' | 'search-console' | 'keywords' | 'backlinks';

/** Task assignment phase */
export type TaskPhase = 'starting-point' | 'month-2' | 'month-3' | 'month-4' | 'month-5' | 'month-6';

// ============================================================
// Crawler Types
// ============================================================

export interface CrawlResult {
  url: string;
  finalUrl: string;
  statusCode: number;
  redirectChain: RedirectInfo[];
  html: string;
  headers: Record<string, string>;
  responseTime: number;
  contentLength: number;
  ssl: SSLInfo;
  robotsTxt: RobotsTxtInfo | null;
  sitemap: SitemapInfo | null;
}

export interface RedirectInfo {
  from: string;
  to: string;
  statusCode: number;
}

export interface SSLInfo {
  valid: boolean;
  issuer?: string;
  expiresAt?: string;
  protocol?: string;
}

export interface RobotsTxtInfo {
  exists: boolean;
  content: string;
  sitemapUrls: string[];
  disallowedPaths: string[];
  allowedPaths: string[];
  crawlDelay?: number;
}

export interface SitemapInfo {
  exists: boolean;
  url: string;
  urlCount: number;
  urls: string[];
  lastModified?: string;
  errors: string[];
}

// ============================================================
// Analyzer Types
// ============================================================

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: AuditCategory;
  subcategory: string;
  currentValue?: string;
  recommendedValue?: string;
  howToFix: string;
  impact: string;
  effort: Effort;
}

export interface AnalyzerResult {
  category: AuditCategory;
  categoryLabel: string;
  score: number; // 0-100
  maxScore: number;
  findings: Finding[];
  summary: string;
}

// ============================================================
// Performance-specific Types
// ============================================================

export interface CoreWebVitals {
  lcp?: MetricResult;       // Largest Contentful Paint
  fid?: MetricResult;       // First Input Delay
  cls?: MetricResult;       // Cumulative Layout Shift
  inp?: MetricResult;       // Interaction to Next Paint
  ttfb?: MetricResult;      // Time to First Byte
  fcp?: MetricResult;       // First Contentful Paint
}

export interface MetricResult {
  value: number;
  unit: string;
  rating: 'good' | 'needs-improvement' | 'poor';
  percentile?: number;
}

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

export interface PerformanceData {
  coreWebVitals: CoreWebVitals;
  lighthouseScores: LighthouseScores;
  loadingExperience: 'FAST' | 'AVERAGE' | 'SLOW' | 'NONE';
  strategy: 'mobile' | 'desktop';
}

// ============================================================
// Google Search Console Types
// ============================================================

export interface GSCConfig {
  keyFilePath: string;
  siteUrl: string;
  dateRange?: {
    startDate: string; // YYYY-MM-DD
    endDate: string;
  };
}

export interface GSCData {
  searchAnalytics: GSCSearchAnalytics;
  sitemapStatus: GSCSitemapStatus[];
}

export interface GSCSearchAnalytics {
  totalClicks: number;
  totalImpressions: number;
  averageCtr: number;
  averagePosition: number;
  topQueries: GSCQueryRow[];
  topPages: GSCPageRow[];
  queryCount: number;
  pageCount: number;
}

export interface GSCQueryRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCPageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCSitemapStatus {
  path: string;
  lastSubmitted: string;
  lastDownloaded: string;
  isPending: boolean;
  urlsDiscovered: number;
}

// ============================================================
// Competitor Comparison Types
// ============================================================

export interface CompetitorComparison {
  clientUrl: string;
  clientReport: AuditReport;
  competitors: CompetitorEntry[];
  categoryComparison: CategoryComparison[];
  gaps: CompetitorGap[];
  strengths: CompetitorStrength[];
  generatedAt: string;
}

export interface CompetitorEntry {
  url: string;
  report: AuditReport;
}

export interface CategoryComparison {
  category: AuditCategory;
  categoryLabel: string;
  clientScore: number;
  competitorScores: { url: string; score: number }[];
  averageCompetitorScore: number;
  clientRank: number;
}

export interface CompetitorGap {
  category: AuditCategory;
  finding: string;
  description: string;
  competitorUrl: string;
  competitorScore: number;
  clientScore: number;
  scoreDifference: number;
}

export interface CompetitorStrength {
  category: AuditCategory;
  finding: string;
  description: string;
  clientScore: number;
  averageCompetitorScore: number;
  advantage: number;
}

// ============================================================
// DataforSEO Types
// ============================================================

export interface DataforSEOConfig {
  login: string;
  password: string;
}

export interface DataforSEOKeywordData {
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  competitionLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  monthlySearches: { month: string; volume: number }[];
}

export interface DataforSEOBacklinkSummary {
  totalBacklinks: number;
  referringDomains: number;
  brokenBacklinks: number;
  domainRank: number;
  topAnchors: { anchor: string; count: number }[];
  topReferringDomains: { domain: string; backlinks: number; rank: number }[];
}

export interface DataforSEOSerpResult {
  keyword: string;
  position: number;
  url: string;
  title: string;
  description: string;
  featuredSnippet: boolean;
  peopleAlsoAsk: string[];
}

// ============================================================
// Task Types
// ============================================================

export interface SEOTask {
  id: string;
  title: string;
  description: string;
  category: AuditCategory;
  phase: TaskPhase;
  priority: number; // 1-100, higher = more urgent
  effort: Effort;
  estimatedHours: number;
  deliverable: string;
  steps: string[];
  relatedFindings: string[]; // Finding IDs
  status: 'pending' | 'in-progress' | 'completed';
}

export interface TaskPlan {
  url: string;
  generatedAt: string;
  startingPoint: SEOTask[];
  monthlyTasks: Record<TaskPhase, SEOTask[]>;
  totalEstimatedHours: number;
  summary: string;
}

// ============================================================
// Report Types
// ============================================================

export interface AuditReport {
  url: string;
  finalUrl: string;
  generatedAt: string;
  overallScore: number;
  categories: AnalyzerResult[];
  taskPlan: TaskPlan;
  executiveSummary: string;
  crawlData: CrawlResult;
  gscData?: GSCData;
  backlinkData?: DataforSEOBacklinkSummary;
  keywordData?: DataforSEOKeywordData[];
  comparison?: CompetitorComparison;
}

// ============================================================
// Configuration
// ============================================================

export interface ToolConfig {
  pageSpeedApiKey?: string;
  gscConfig?: GSCConfig;
  dataforseoConfig?: DataforSEOConfig;
  userAgent: string;
  timeout: number;
  maxRedirects: number;
  concurrency: number;
}

export const DEFAULT_CONFIG: ToolConfig = {
  userAgent: 'Mozilla/5.0 (compatible; IDP-SEO-Tool/1.0; +https://github.com/idp-seo-tool)',
  timeout: 30000,
  maxRedirects: 10,
  concurrency: 3,
};
