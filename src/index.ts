// IDP SEO Tool - Main Entry Point
// Run with: npm run audit -- --url <url>

export { crawlUrl } from './utils/crawler.js';
export { analyzeTechnical } from './analyzers/technical.js';
export { analyzeOnPage } from './analyzers/onpage.js';
export { analyzePerformance } from './analyzers/performance.js';
export { analyzeSchema } from './analyzers/schema.js';
export { analyzeAEO } from './analyzers/aeo.js';
export { generateTaskPlan } from './tasks/generator.js';
export { generateReport, saveReport } from './reports/generator.js';
export * from './types.js';
