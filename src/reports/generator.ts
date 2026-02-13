import type { AuditReport, AnalyzerResult, Finding, SEOTask, TaskPhase, GSCData, CompetitorComparison } from '../types.js';
import { getGrade, getSeverityColor, getScoreColor } from '../utils/scoring.js';
import fs from 'fs';
import path from 'path';

/**
 * HTML Report Generator
 *
 * Produces a professional, client-ready HTML report with:
 * - Executive summary with overall score
 * - Category breakdowns with scores
 * - Detailed findings with severity and fix guidance
 * - Prioritized task plan (starting point + monthly)
 * - Clean design with no external dependencies
 */
export function generateReport(report: AuditReport): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SEO Audit Report — ${escapeHtml(report.url)}</title>
  <style>${getStyles()}</style>
</head>
<body>
  <div class="report">
    ${renderHeader(report)}
    ${renderExecutiveSummary(report)}
    ${renderScoreCards(report)}
    ${report.categories.map(cat => renderCategorySection(cat)).join('\n')}
    ${report.gscData ? renderGSCSection(report.gscData) : ''}
    ${report.comparison ? renderCompetitorSection(report.comparison) : ''}
    ${renderTaskPlan(report)}
    ${renderFooter(report)}
  </div>
  <script>${getInteractiveScript()}</script>
</body>
</html>`;
}

/**
 * Save the report to a file
 */
export function saveReport(html: string, url: string, outputDir: string): string {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate filename from URL
  const hostname = new URL(url).hostname.replace(/[^a-zA-Z0-9]/g, '-');
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `seo-audit-${hostname}-${timestamp}.html`;
  const filepath = path.join(outputDir, filename);

  fs.writeFileSync(filepath, html, 'utf-8');
  return filepath;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderHeader(report: AuditReport): string {
  return `
    <header class="report-header">
      <div class="header-content">
        <h1>SEO Audit Report</h1>
        <p class="report-url">${escapeHtml(report.url)}</p>
        <p class="report-date">Generated on ${new Date(report.generatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
      <div class="overall-score">
        <div class="score-circle score-${getScoreColor(report.overallScore)}">
          <span class="score-number">${report.overallScore}</span>
          <span class="score-label">Overall</span>
        </div>
        <div class="score-grade">${getGrade(report.overallScore)}</div>
      </div>
    </header>`;
}

function renderExecutiveSummary(report: AuditReport): string {
  const totalFindings = report.categories.reduce((sum, cat) => sum + cat.findings.length, 0);
  const criticalCount = report.categories.reduce(
    (sum, cat) => sum + cat.findings.filter(f => f.severity === 'critical').length, 0
  );
  const highCount = report.categories.reduce(
    (sum, cat) => sum + cat.findings.filter(f => f.severity === 'high').length, 0
  );
  const quickWins = report.categories.reduce(
    (sum, cat) => sum + cat.findings.filter(f => f.effort === 'low' && f.severity !== 'info').length, 0
  );

  return `
    <section class="executive-summary">
      <h2>Executive Summary</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-number">${totalFindings}</div>
          <div class="summary-label">Total Findings</div>
        </div>
        <div class="summary-card summary-critical">
          <div class="summary-number">${criticalCount}</div>
          <div class="summary-label">Critical Issues</div>
        </div>
        <div class="summary-card summary-high">
          <div class="summary-number">${highCount}</div>
          <div class="summary-label">High Priority</div>
        </div>
        <div class="summary-card summary-wins">
          <div class="summary-number">${quickWins}</div>
          <div class="summary-label">Quick Wins</div>
        </div>
      </div>
      <div class="summary-text">
        <p>${escapeHtml(report.executiveSummary)}</p>
      </div>
    </section>`;
}

function renderScoreCards(report: AuditReport): string {
  const cards = report.categories.map(cat => `
    <div class="category-card">
      <div class="category-score score-${getScoreColor(cat.score)}">
        ${cat.score}
      </div>
      <div class="category-info">
        <h3>${escapeHtml(cat.categoryLabel)}</h3>
        <p>${escapeHtml(cat.summary)}</p>
      </div>
    </div>
  `).join('\n');

  return `
    <section class="score-overview">
      <h2>Score Overview</h2>
      <div class="score-cards">
        ${cards}
      </div>
    </section>`;
}

function renderCategorySection(cat: AnalyzerResult): string {
  if (cat.findings.length === 0) {
    return `
      <section class="category-section">
        <div class="category-header">
          <h2>${escapeHtml(cat.categoryLabel)}</h2>
          <span class="category-badge score-bg-green">Score: ${cat.score}/100</span>
        </div>
        <p class="no-findings">No issues found. This area looks good.</p>
      </section>`;
  }

  // Group findings by severity
  const bySeverity = {
    critical: cat.findings.filter(f => f.severity === 'critical'),
    high: cat.findings.filter(f => f.severity === 'high'),
    medium: cat.findings.filter(f => f.severity === 'medium'),
    low: cat.findings.filter(f => f.severity === 'low'),
    info: cat.findings.filter(f => f.severity === 'info'),
  };

  const findingsHtml = cat.findings.map(finding => renderFinding(finding)).join('\n');

  return `
    <section class="category-section">
      <div class="category-header">
        <h2>${escapeHtml(cat.categoryLabel)}</h2>
        <span class="category-badge score-bg-${getScoreColor(cat.score)}">Score: ${cat.score}/100</span>
      </div>
      <div class="severity-summary">
        ${bySeverity.critical.length > 0 ? `<span class="sev-badge sev-critical">${bySeverity.critical.length} Critical</span>` : ''}
        ${bySeverity.high.length > 0 ? `<span class="sev-badge sev-high">${bySeverity.high.length} High</span>` : ''}
        ${bySeverity.medium.length > 0 ? `<span class="sev-badge sev-medium">${bySeverity.medium.length} Medium</span>` : ''}
        ${bySeverity.low.length > 0 ? `<span class="sev-badge sev-low">${bySeverity.low.length} Low</span>` : ''}
        ${bySeverity.info.length > 0 ? `<span class="sev-badge sev-info">${bySeverity.info.length} Info</span>` : ''}
      </div>
      <div class="findings-list">
        ${findingsHtml}
      </div>
    </section>`;
}

function renderFinding(finding: Finding): string {
  return `
    <div class="finding" data-severity="${finding.severity}">
      <div class="finding-header" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="severity-indicator" style="background-color: ${getSeverityColor(finding.severity)}">${finding.severity.toUpperCase()}</span>
        <h3 class="finding-title">${escapeHtml(finding.title)}</h3>
        <span class="effort-badge effort-${finding.effort}">${finding.effort} effort</span>
        <span class="expand-icon">+</span>
      </div>
      <div class="finding-details">
        <p class="finding-description">${escapeHtml(finding.description)}</p>
        ${finding.currentValue ? `
        <div class="finding-values">
          <div class="value-current">
            <strong>Current:</strong> ${escapeHtml(finding.currentValue)}
          </div>
          ${finding.recommendedValue ? `
          <div class="value-recommended">
            <strong>Recommended:</strong> ${escapeHtml(finding.recommendedValue)}
          </div>` : ''}
        </div>` : ''}
        <div class="finding-fix">
          <h4>How to Fix</h4>
          <p>${escapeHtml(finding.howToFix).replace(/\n/g, '<br>')}</p>
        </div>
        <div class="finding-impact">
          <h4>Why This Matters</h4>
          <p>${escapeHtml(finding.impact)}</p>
        </div>
      </div>
    </div>`;
}

function renderTaskPlan(report: AuditReport): string {
  const { taskPlan } = report;
  if (!taskPlan) return '';

  const phases: { key: TaskPhase; label: string }[] = [
    { key: 'starting-point', label: 'Month 1: Starting Point' },
    { key: 'month-2', label: 'Month 2: Performance & Technical' },
    { key: 'month-3', label: 'Month 3: On-Page Optimization' },
    { key: 'month-4', label: 'Month 4: Structured Data' },
    { key: 'month-5', label: 'Month 5: AEO & AI Readiness' },
    { key: 'month-6', label: 'Month 6: Ongoing & Monitoring' },
  ];

  const phasesHtml = phases.map(phase => {
    const tasks = taskPlan.monthlyTasks[phase.key] || [];
    if (tasks.length === 0) return '';

    const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);

    return `
      <div class="phase-section">
        <div class="phase-header">
          <h3>${escapeHtml(phase.label)}</h3>
          <span class="phase-meta">${tasks.length} tasks &middot; ~${totalHours} hours</span>
        </div>
        <div class="task-list">
          ${tasks.map(task => renderTask(task)).join('\n')}
        </div>
      </div>`;
  }).join('\n');

  return `
    <section class="task-plan">
      <h2>SEO Task Plan</h2>
      <div class="plan-summary">
        <p>${escapeHtml(taskPlan.summary)}</p>
      </div>
      ${phasesHtml}
    </section>`;
}

function renderTask(task: SEOTask): string {
  return `
    <div class="task" onclick="this.classList.toggle('expanded')">
      <div class="task-header">
        <span class="task-priority priority-${task.priority > 70 ? 'high' : task.priority > 40 ? 'medium' : 'low'}">
          P${task.priority > 70 ? '1' : task.priority > 40 ? '2' : '3'}
        </span>
        <h4 class="task-title">${escapeHtml(task.title)}</h4>
        <span class="task-effort">${escapeHtml(task.effort)} effort &middot; ~${task.estimatedHours}h</span>
        <span class="expand-icon">+</span>
      </div>
      <div class="task-details">
        <p>${escapeHtml(task.description)}</p>
        <div class="task-deliverable">
          <strong>Deliverable:</strong> ${escapeHtml(task.deliverable)}
        </div>
        <div class="task-steps">
          <strong>Steps:</strong>
          <ol>
            ${task.steps.map(step => `<li>${escapeHtml(step)}</li>`).join('\n')}
          </ol>
        </div>
      </div>
    </div>`;
}

function renderGSCSection(gscData: GSCData): string {
  const sa = gscData.searchAnalytics;

  const topQueriesRows = sa.topQueries.slice(0, 20).map(q => `
    <tr>
      <td>${escapeHtml(q.query)}</td>
      <td class="num">${q.clicks.toLocaleString()}</td>
      <td class="num">${q.impressions.toLocaleString()}</td>
      <td class="num">${q.ctr}%</td>
      <td class="num">${q.position}</td>
    </tr>
  `).join('');

  const topPagesRows = sa.topPages.slice(0, 15).map(p => {
    const shortPage = p.page.replace(/https?:\/\/[^/]+/, '') || '/';
    return `
    <tr>
      <td title="${escapeHtml(p.page)}">${escapeHtml(shortPage.length > 60 ? shortPage.slice(0, 57) + '...' : shortPage)}</td>
      <td class="num">${p.clicks.toLocaleString()}</td>
      <td class="num">${p.impressions.toLocaleString()}</td>
      <td class="num">${p.ctr}%</td>
      <td class="num">${p.position}</td>
    </tr>`;
  }).join('');

  return `
    <section class="gsc-section category-section">
      <div class="category-header">
        <h2>Search Console Insights (Last 90 Days)</h2>
      </div>

      <div class="gsc-summary-grid">
        <div class="gsc-metric">
          <div class="gsc-metric-value">${sa.totalClicks.toLocaleString()}</div>
          <div class="gsc-metric-label">Total Clicks</div>
        </div>
        <div class="gsc-metric">
          <div class="gsc-metric-value">${sa.totalImpressions.toLocaleString()}</div>
          <div class="gsc-metric-label">Impressions</div>
        </div>
        <div class="gsc-metric">
          <div class="gsc-metric-value">${sa.averageCtr}%</div>
          <div class="gsc-metric-label">Average CTR</div>
        </div>
        <div class="gsc-metric">
          <div class="gsc-metric-value">${sa.averagePosition}</div>
          <div class="gsc-metric-label">Avg Position</div>
        </div>
      </div>

      <h3 class="subsection-title">Top Search Queries</h3>
      <table class="data-table">
        <thead><tr><th>Query</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead>
        <tbody>${topQueriesRows}</tbody>
      </table>

      <h3 class="subsection-title" style="margin-top:24px;">Top Pages by Traffic</h3>
      <table class="data-table">
        <thead><tr><th>Page</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead>
        <tbody>${topPagesRows}</tbody>
      </table>
    </section>`;
}

function renderCompetitorSection(comparison: CompetitorComparison): string {
  const clientHost = (() => { try { return new URL(comparison.clientUrl).hostname; } catch { return comparison.clientUrl; } })();
  const compHosts = comparison.competitors.map(c => {
    try { return new URL(c.url).hostname; } catch { return c.url; }
  });

  const catRows = comparison.categoryComparison.map(cat => {
    const compCells = cat.competitorScores.map(cs => {
      const color = cs.score >= 80 ? '#16a34a' : cs.score >= 60 ? '#ca8a04' : '#dc2626';
      return `<td class="num" style="color:${color};font-weight:600;">${cs.score}</td>`;
    }).join('');
    const clientColor = cat.clientScore >= 80 ? '#16a34a' : cat.clientScore >= 60 ? '#ca8a04' : '#dc2626';
    const rankColor = cat.clientRank === 1 ? '#16a34a' : cat.clientRank <= 2 ? '#ca8a04' : '#dc2626';
    return `<tr>
      <td>${escapeHtml(cat.categoryLabel)}</td>
      <td class="num" style="color:${clientColor};font-weight:700;">${cat.clientScore}</td>
      ${compCells}
      <td class="num" style="color:${rankColor};font-weight:600;">#${cat.clientRank}</td>
    </tr>`;
  }).join('');

  const overallRow = `<tr style="font-weight:700;border-top:2px solid #1a1a2e;">
    <td>Overall</td>
    <td class="num">${comparison.clientReport.overallScore}</td>
    ${comparison.competitors.map(c => `<td class="num">${c.report.overallScore}</td>`).join('')}
    <td></td>
  </tr>`;

  const gapsHtml = comparison.gaps.slice(0, 5).map(g => `
    <div class="gap-item">
      <span class="gap-badge">${g.scoreDifference}pt gap</span>
      <span>${escapeHtml(g.finding)}</span>
    </div>`).join('');

  const strengthsHtml = comparison.strengths.slice(0, 5).map(s => `
    <div class="strength-item">
      <span class="strength-badge">+${s.advantage}pt</span>
      <span>${escapeHtml(s.finding)}</span>
    </div>`).join('');

  return `
    <section class="competitor-section category-section">
      <div class="category-header">
        <h2>Competitor Comparison</h2>
      </div>

      <table class="data-table">
        <thead>
          <tr>
            <th>Category</th>
            <th>${escapeHtml(clientHost)} (You)</th>
            ${compHosts.map(h => `<th>${escapeHtml(h)}</th>`).join('')}
            <th>Rank</th>
          </tr>
        </thead>
        <tbody>
          ${catRows}
          ${overallRow}
        </tbody>
      </table>

      ${comparison.gaps.length > 0 ? `
      <h3 class="subsection-title" style="margin-top:24px;">Key Gaps (Where Competitors Lead)</h3>
      <div class="gaps-list">${gapsHtml}</div>` : ''}

      ${comparison.strengths.length > 0 ? `
      <h3 class="subsection-title" style="margin-top:24px;">Your Advantages</h3>
      <div class="strengths-list">${strengthsHtml}</div>` : ''}
    </section>`;
}

function renderFooter(report: AuditReport): string {
  return `
    <footer class="report-footer">
      <p>Generated by IDP SEO Tool v2.0</p>
      <p>Report generated on ${new Date(report.generatedAt).toLocaleString()} for ${escapeHtml(report.url)}</p>
      <p class="disclaimer">This report provides recommendations based on automated analysis. Some findings may require professional judgment to implement. Scores are relative and should be tracked over time for progress measurement.</p>
    </footer>`;
}

function getInteractiveScript(): string {
  return `
    // Expand/collapse functionality
    document.querySelectorAll('.finding-header, .task-header').forEach(header => {
      header.style.cursor = 'pointer';
    });

    // Expand all / collapse all buttons
    function expandAll(section) {
      section.querySelectorAll('.finding, .task').forEach(el => el.classList.add('expanded'));
    }
    function collapseAll(section) {
      section.querySelectorAll('.finding, .task').forEach(el => el.classList.remove('expanded'));
    }
  `;
}

function getStyles(): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1a1a2e;
      background: #f5f5f7;
    }

    .report {
      max-width: 1100px;
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    }

    /* --- Header --- */
    .report-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 48px 48px 36px;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
    }

    .report-header h1 {
      font-size: 28px;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .report-url {
      font-size: 16px;
      opacity: 0.85;
      word-break: break-all;
    }

    .report-date {
      font-size: 14px;
      opacity: 0.65;
      margin-top: 4px;
    }

    .overall-score {
      text-align: center;
      flex-shrink: 0;
      margin-left: 32px;
    }

    .score-circle {
      width: 110px;
      height: 110px;
      border-radius: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border: 4px solid rgba(255,255,255,0.2);
    }

    .score-circle.score-green { background: rgba(34, 197, 94, 0.2); border-color: #22c55e; }
    .score-circle.score-yellow { background: rgba(234, 179, 8, 0.2); border-color: #eab308; }
    .score-circle.score-red { background: rgba(239, 68, 68, 0.2); border-color: #ef4444; }

    .score-number {
      font-size: 36px;
      font-weight: 800;
      line-height: 1;
    }

    .score-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.8;
    }

    .score-grade {
      font-size: 20px;
      font-weight: 700;
      margin-top: 8px;
      opacity: 0.9;
    }

    /* --- Executive Summary --- */
    .executive-summary {
      padding: 36px 48px;
      border-bottom: 1px solid #e5e7eb;
    }

    .executive-summary h2 {
      font-size: 22px;
      margin-bottom: 20px;
      color: #1a1a2e;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 20px;
    }

    .summary-card {
      text-align: center;
      padding: 20px;
      border-radius: 10px;
      background: #f8f9fa;
    }

    .summary-card.summary-critical { background: #fef2f2; }
    .summary-card.summary-high { background: #fff7ed; }
    .summary-card.summary-wins { background: #f0fdf4; }

    .summary-number {
      font-size: 32px;
      font-weight: 800;
    }

    .summary-critical .summary-number { color: #dc2626; }
    .summary-high .summary-number { color: #ea580c; }
    .summary-wins .summary-number { color: #16a34a; }

    .summary-label {
      font-size: 13px;
      color: #6b7280;
      margin-top: 4px;
    }

    .summary-text {
      font-size: 15px;
      color: #374151;
      line-height: 1.7;
    }

    /* --- Score Overview --- */
    .score-overview {
      padding: 36px 48px;
      border-bottom: 1px solid #e5e7eb;
    }

    .score-overview h2 {
      font-size: 22px;
      margin-bottom: 20px;
    }

    .score-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .category-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      border-radius: 10px;
      background: #f8f9fa;
      border: 1px solid #e5e7eb;
    }

    .category-score {
      font-size: 28px;
      font-weight: 800;
      width: 64px;
      height: 64px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      flex-shrink: 0;
    }

    .category-score.score-green { background: #dcfce7; color: #16a34a; }
    .category-score.score-yellow { background: #fef9c3; color: #a16207; }
    .category-score.score-red { background: #fee2e2; color: #dc2626; }

    .category-info h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .category-info p {
      font-size: 12px;
      color: #6b7280;
      line-height: 1.4;
    }

    /* --- Category Sections --- */
    .category-section {
      padding: 36px 48px;
      border-bottom: 1px solid #e5e7eb;
    }

    .category-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .category-header h2 {
      font-size: 22px;
    }

    .category-badge {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      color: white;
    }

    .score-bg-green { background: #16a34a; }
    .score-bg-yellow { background: #ca8a04; }
    .score-bg-red { background: #dc2626; }

    .severity-summary {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .sev-badge {
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 12px;
      font-weight: 600;
    }

    .sev-critical { background: #fef2f2; color: #dc2626; }
    .sev-high { background: #fff7ed; color: #ea580c; }
    .sev-medium { background: #fefce8; color: #a16207; }
    .sev-low { background: #eff6ff; color: #2563eb; }
    .sev-info { background: #f3f4f6; color: #6b7280; }

    .no-findings {
      color: #16a34a;
      font-style: italic;
      padding: 16px;
      background: #f0fdf4;
      border-radius: 8px;
    }

    /* --- Findings --- */
    .finding {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin-bottom: 10px;
      overflow: hidden;
    }

    .finding-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      cursor: pointer;
      background: #fafafa;
      transition: background 0.15s;
    }

    .finding-header:hover { background: #f0f0f0; }

    .severity-indicator {
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      color: white;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      flex-shrink: 0;
    }

    .finding-title {
      font-size: 15px;
      font-weight: 600;
      flex: 1;
    }

    .effort-badge {
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 12px;
      font-weight: 500;
      flex-shrink: 0;
    }

    .effort-low { background: #dcfce7; color: #16a34a; }
    .effort-medium { background: #fef9c3; color: #a16207; }
    .effort-high { background: #fee2e2; color: #dc2626; }

    .expand-icon {
      font-size: 18px;
      font-weight: 300;
      color: #9ca3af;
      flex-shrink: 0;
      transition: transform 0.2s;
    }

    .finding.expanded .expand-icon,
    .task.expanded .expand-icon {
      transform: rotate(45deg);
    }

    .finding-details {
      display: none;
      padding: 18px;
      border-top: 1px solid #e5e7eb;
      background: white;
    }

    .finding.expanded .finding-details,
    .task.expanded .task-details {
      display: block;
    }

    .finding-description {
      font-size: 14px;
      color: #374151;
      margin-bottom: 16px;
    }

    .finding-values {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }

    .value-current, .value-recommended {
      padding: 12px;
      border-radius: 6px;
      font-size: 13px;
    }

    .value-current { background: #fef2f2; }
    .value-recommended { background: #f0fdf4; }

    .finding-fix, .finding-impact {
      margin-top: 16px;
    }

    .finding-fix h4, .finding-impact h4 {
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #6b7280;
      margin-bottom: 6px;
    }

    .finding-fix p, .finding-impact p {
      font-size: 14px;
      color: #374151;
      line-height: 1.7;
    }

    /* --- Task Plan --- */
    .task-plan {
      padding: 36px 48px;
      border-bottom: 1px solid #e5e7eb;
    }

    .task-plan h2 {
      font-size: 22px;
      margin-bottom: 12px;
    }

    .plan-summary {
      font-size: 14px;
      color: #6b7280;
      margin-bottom: 24px;
      padding: 16px;
      background: #f8f9fa;
      border-radius: 8px;
    }

    .phase-section {
      margin-bottom: 28px;
    }

    .phase-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 2px solid #1a1a2e;
    }

    .phase-header h3 {
      font-size: 18px;
      color: #1a1a2e;
    }

    .phase-meta {
      font-size: 13px;
      color: #6b7280;
    }

    .task {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin-bottom: 8px;
      overflow: hidden;
    }

    .task-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      cursor: pointer;
      background: #fafafa;
    }

    .task-header:hover { background: #f0f0f0; }

    .task-priority {
      padding: 3px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
    }

    .priority-high { background: #dc2626; }
    .priority-medium { background: #ca8a04; }
    .priority-low { background: #2563eb; }

    .task-title {
      font-size: 14px;
      font-weight: 600;
      flex: 1;
    }

    .task-effort {
      font-size: 12px;
      color: #6b7280;
      flex-shrink: 0;
    }

    .task-details {
      display: none;
      padding: 18px;
      border-top: 1px solid #e5e7eb;
      background: white;
      font-size: 14px;
    }

    .task-deliverable {
      margin-top: 12px;
      padding: 12px;
      background: #f0fdf4;
      border-radius: 6px;
    }

    .task-steps {
      margin-top: 12px;
    }

    .task-steps ol {
      margin-left: 20px;
      margin-top: 8px;
    }

    .task-steps li {
      margin-bottom: 6px;
      line-height: 1.5;
    }

    /* --- Footer --- */
    .report-footer {
      padding: 32px 48px;
      background: #f8f9fa;
      text-align: center;
      font-size: 13px;
      color: #6b7280;
    }

    .report-footer p { margin-bottom: 6px; }

    .disclaimer {
      margin-top: 12px;
      font-style: italic;
      font-size: 12px;
    }

    /* --- GSC Section --- */
    .gsc-summary-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .gsc-metric {
      text-align: center;
      padding: 20px;
      border-radius: 10px;
      background: #f0f9ff;
      border: 1px solid #bae6fd;
    }

    .gsc-metric-value {
      font-size: 28px;
      font-weight: 800;
      color: #0369a1;
    }

    .gsc-metric-label {
      font-size: 13px;
      color: #6b7280;
      margin-top: 4px;
    }

    .subsection-title {
      font-size: 17px;
      font-weight: 600;
      color: #1a1a2e;
      margin-bottom: 12px;
    }

    /* --- Data Tables --- */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }

    .data-table thead th {
      background: #f8f9fa;
      padding: 10px 14px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #e5e7eb;
      color: #374151;
    }

    .data-table tbody td {
      padding: 8px 14px;
      border-bottom: 1px solid #f3f4f6;
    }

    .data-table tbody tr:hover { background: #f9fafb; }

    .data-table td.num {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    /* --- Competitor Section --- */
    .gap-item, .strength-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      font-size: 14px;
    }

    .gap-badge {
      background: #fef2f2;
      color: #dc2626;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .strength-badge {
      background: #f0fdf4;
      color: #16a34a;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }

    /* --- Print styles --- */
    @media print {
      body { background: white; }
      .report { box-shadow: none; }
      .finding-details, .task-details { display: block !important; }
      .expand-icon { display: none; }
      .finding-header, .task-header { cursor: default; }
    }

    /* --- Responsive --- */
    @media (max-width: 768px) {
      .report-header { flex-direction: column; text-align: center; padding: 32px 24px; }
      .overall-score { margin: 20px 0 0 0; }
      .summary-grid { grid-template-columns: repeat(2, 1fr); }
      .category-section, .executive-summary, .score-overview, .task-plan { padding: 24px; }
      .finding-header { flex-wrap: wrap; }
      .finding-values { grid-template-columns: 1fr; }
    }
  `;
}
