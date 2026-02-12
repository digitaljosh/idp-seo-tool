// ============================================================
// Core Types for IDP SEO Tool
// ============================================================

/** Severity levels for SEO findings, ordered by urgency */
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Effort required to fix a finding */
export type Effort = 'low' | 'medium' | 'high';

/** SEO audit categories */
export type AuditCategory = 'technical' | 'onpage' | 'performance' | 'schema' | 'aeo';

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
}

// ============================================================
// Configuration
// ============================================================

export interface ToolConfig {
  pageSpeedApiKey?: string;
  searchConsoleCredentials?: string;
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
