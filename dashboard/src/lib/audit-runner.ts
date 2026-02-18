/**
 * Bridges the core audit engine with the dashboard.
 * Uses dynamic require() to load from the parent project at runtime,
 * bypassing webpack's module resolution.
 */
import path from 'path';
import { createRequire } from 'module';

export interface DashboardAuditOptions {
  url: string;
  pageSpeedApiKey?: string;
  skipPerformance?: boolean;
  gscKeyFile?: string;
  skipGsc?: boolean;
  dataforseoLogin?: string;
  dataforseoPassword?: string;
  skipBacklinks?: boolean;
  skipKeywords?: boolean;
  competitors?: string[];
  onProgress?: (step: string, detail?: string) => void;
}

export interface DashboardAuditResult {
  report: any;
  html: string;
  comparison?: any;
}

// Resolve parent project paths
const parentSrc = path.resolve(process.cwd(), '..', 'src');

/**
 * Load a module from the parent src/ directory using tsx runtime.
 * This bypasses webpack and loads TypeScript files directly.
 */
async function loadParentModule(modulePath: string): Promise<any> {
  const fullPath = path.join(parentSrc, modulePath);
  return import(fullPath);
}

export async function runDashboardAudit(
  options: DashboardAuditOptions
): Promise<DashboardAuditResult> {
  const { runCoreAudit } = await loadParentModule('core/audit.ts');
  const { generateReport } = await loadParentModule('reports/generator.ts');

  const auditOptions = {
    url: options.url,
    pageSpeedApiKey: options.pageSpeedApiKey,
    skipPerformance: options.skipPerformance,
    gscKeyFile: options.skipGsc ? undefined : options.gscKeyFile,
    skipSearchConsole: options.skipGsc,
    dataforseoLogin: options.dataforseoLogin,
    dataforseoPassword: options.dataforseoPassword,
    skipBacklinks: options.skipBacklinks,
    skipKeywords: options.skipKeywords,
    onProgress: options.onProgress,
  };

  if (options.competitors && options.competitors.length > 0) {
    const { runCompetitorComparison } = await loadParentModule('core/competitor.ts');
    const result = await runCompetitorComparison({
      ...auditOptions,
      competitors: options.competitors,
    });
    const report = result.clientResult.report;
    report.comparison = result.comparison;
    const html = generateReport(report);
    return { report, html, comparison: result.comparison };
  }

  const result = await runCoreAudit(auditOptions);
  return { report: result.report, html: result.html };
}
