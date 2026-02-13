// IDP SEO Tool - Main Entry Point
// Run with: npm run audit -- --url <url>

// Core orchestrators
export { runCoreAudit, type AuditOptions, type AuditResult } from './core/audit.js';
export { runCompetitorComparison, type CompetitorOptions } from './core/competitor.js';

// Analyzers
export { crawlUrl } from './utils/crawler.js';
export { analyzeTechnical } from './analyzers/technical.js';
export { analyzeOnPage } from './analyzers/onpage.js';
export { analyzePerformance } from './analyzers/performance.js';
export { analyzeSchema } from './analyzers/schema.js';
export { analyzeAEO } from './analyzers/aeo.js';
export { analyzeSearchConsole } from './analyzers/search-console.js';
export { analyzeBacklinks, fetchKeywordVolumes } from './analyzers/dataforseo.js';
export { analyzeKeywords } from './analyzers/keywords-everywhere.js';

// Reports & Tasks
export { generateTaskPlan } from './tasks/generator.js';
export { generateReport, saveReport } from './reports/generator.js';
export { generatePdf } from './utils/pdf.js';

// Types
export * from './types.js';
