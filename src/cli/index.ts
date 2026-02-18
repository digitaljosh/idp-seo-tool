#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { runCoreAudit, type AuditOptions } from '../core/audit.js';
import { runCompetitorComparison } from '../core/competitor.js';
import { saveReport, generateReport } from '../reports/generator.js';
import { getGrade, getScoreColor } from '../utils/scoring.js';
import type { AuditReport, CompetitorComparison, TaskPhase } from '../types.js';

const program = new Command();

program
  .name('idp-seo')
  .description('Agency-level SEO audit, task generation, and reporting tool')
  .version('2.0.0');

program
  .command('audit')
  .description('Run a full SEO audit on a URL')
  .option('-u, --url <url>', 'URL to audit')
  .option('-o, --output <dir>', 'Output directory for reports', './reports')
  .option('--api-key <key>', 'Google PageSpeed Insights API key (optional)')
  .option('--gsc-key <path>', 'Path to Google Search Console service account JSON key file')
  .option('--skip-performance', 'Skip performance analysis (faster)')
  .option('--skip-gsc', 'Skip Google Search Console analysis')
  .option('--dfs-login <login>', 'DataforSEO API login')
  .option('--dfs-password <password>', 'DataforSEO API password')
  .option('--skip-backlinks', 'Skip backlink analysis')
  .option('--skip-keywords', 'Skip keyword intelligence analysis')
  .option('--seed-keywords <keywords...>', 'Seed keywords for keyword research')
  .option('-c, --competitors <urls...>', 'Competitor URLs to compare against (up to 3)')
  .option('-f, --format <format>', 'Output format: html or pdf', 'html')
  .option('--json', 'Output raw JSON instead of interactive display')
  .action(async (options) => {
    let url = options.url;

    if (!url) {
      const answers = await inquirer.prompt([{
        type: 'input',
        name: 'url',
        message: 'Enter the URL to audit:',
        validate: (input: string) => {
          if (!input.trim()) return 'URL is required';
          return true;
        },
      }]);
      url = answers.url;
    }

    console.log('');
    console.log(chalk.bold.white('  IDP SEO Audit Tool v2.0'));
    console.log(chalk.gray('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log('');

    try {
      let report: AuditReport;
      let html: string;
      let comparison: CompetitorComparison | undefined;

      const spinner = ora({ color: 'cyan' });

      const auditOptions: AuditOptions = {
        url,
        pageSpeedApiKey: options.apiKey,
        skipPerformance: options.skipPerformance,
        gscKeyFile: options.skipGsc ? undefined : options.gscKey,
        skipSearchConsole: options.skipGsc,
        dataforseoLogin: options.dfsLogin,
        dataforseoPassword: options.dfsPassword,
        skipBacklinks: options.skipBacklinks,
        skipKeywords: options.skipKeywords,
        seedKeywords: options.seedKeywords,
        onProgress: (step, detail) => {
          spinner.text = chalk.cyan(detail || step);
          if (!spinner.isSpinning) spinner.start();
        },
      };

      if (options.competitors && options.competitors.length > 0) {
        spinner.start(chalk.cyan('Starting competitor comparison audit...'));
        const compResult = await runCompetitorComparison({
          ...auditOptions,
          competitors: options.competitors,
        });
        report = compResult.clientResult.report;
        comparison = compResult.comparison;
        report.comparison = comparison;
        html = generateReport(report);
        spinner.succeed(chalk.green('Competitor comparison complete'));
      } else {
        spinner.start(chalk.cyan('Starting audit...'));
        const result = await runCoreAudit(auditOptions);
        report = result.report;
        html = result.html;
        spinner.succeed(chalk.green(`Analysis complete — ${report.categories.length} categories evaluated`));
      }

      // Save HTML report
      const outputDir = options.output || './reports';
      const reportPath = saveReport(html, report.finalUrl, outputDir);
      console.log(chalk.green(`  Report saved to ${reportPath}`));

      // PDF export
      if (options.format === 'pdf') {
        const pdfSpinner = ora({ text: chalk.cyan('Generating PDF...'), color: 'cyan' }).start();
        try {
          const { generatePdf } = await import('../utils/pdf.js');
          const pdfPath = reportPath.replace('.html', '.pdf');
          await generatePdf({ html, outputPath: pdfPath, report });
          pdfSpinner.succeed(chalk.green(`PDF saved to ${pdfPath}`));
        } catch (err: any) {
          pdfSpinner.fail(chalk.red(`PDF generation failed: ${err.message}`));
        }
      }

      console.log('');

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      displayOverview(report);
      if (comparison) displayComparisonTable(comparison);
      await interactiveExplore(report, outputDir);

    } catch (err: any) {
      console.log('');
      console.log(chalk.red.bold('  Error: ') + chalk.red(err.message || 'Unknown error'));
      if (err.code === 'ENOTFOUND') {
        console.log(chalk.yellow('  The URL could not be reached. Check the URL and your internet connection.'));
      }
      process.exit(1);
    }
  });

function displayOverview(report: AuditReport) {
  const scoreColor = getScoreColor(report.overallScore);
  const colorFn = scoreColor === 'green' ? chalk.green : scoreColor === 'yellow' ? chalk.yellow : chalk.red;

  console.log(chalk.bold.white('  ┌─────────────────────────────────────┐'));
  console.log(chalk.bold.white('  │  ') + chalk.bold.white('OVERALL SCORE: ') + colorFn.bold(`${report.overallScore}/100 (${getGrade(report.overallScore)})`) + chalk.bold.white('       │'));
  console.log(chalk.bold.white('  └─────────────────────────────────────┘'));
  console.log('');

  const table = new Table({
    head: ['Category', 'Score', 'Grade', 'Findings', 'Critical'].map(h => chalk.white.bold(h)),
    colWidths: [30, 10, 10, 12, 12],
    style: { head: [], border: ['gray'] },
  });

  for (const cat of report.categories) {
    const c = getScoreColor(cat.score);
    const fn = c === 'green' ? chalk.green : c === 'yellow' ? chalk.yellow : chalk.red;
    const crits = cat.findings.filter(f => f.severity === 'critical').length;
    table.push([cat.categoryLabel, fn.bold(`${cat.score}`), fn(getGrade(cat.score)), `${cat.findings.length}`, crits > 0 ? chalk.red.bold(`${crits}`) : chalk.gray('0')]);
  }

  console.log(table.toString());
  console.log('');

  const criticals = report.categories.flatMap(c => c.findings).filter(f => f.severity === 'critical');
  if (criticals.length > 0) {
    console.log(chalk.red.bold('  Critical Issues:'));
    criticals.forEach(f => console.log(chalk.red(`    - ${f.title}`)));
    console.log('');
  }

  const quickWins = report.categories.flatMap(c => c.findings)
    .filter(f => f.effort === 'low' && (f.severity === 'high' || f.severity === 'medium')).slice(0, 5);
  if (quickWins.length > 0) {
    console.log(chalk.green.bold('  Top Quick Wins:'));
    quickWins.forEach(f => console.log(chalk.green(`    - ${f.title}`) + chalk.gray(` (${f.severity})`)));
    console.log('');
  }

  if (report.gscData) {
    const gsc = report.gscData.searchAnalytics;
    console.log(chalk.cyan.bold('  Search Console (Last 90 Days):'));
    console.log(chalk.white(`    Clicks: ${gsc.totalClicks.toLocaleString()}  |  Impressions: ${gsc.totalImpressions.toLocaleString()}  |  CTR: ${gsc.averageCtr}%  |  Avg Position: ${gsc.averagePosition}`));
    console.log('');
  }

  if (report.backlinkData) {
    const bl = report.backlinkData;
    console.log(chalk.cyan.bold('  Backlink Profile (DataforSEO):'));
    console.log(chalk.white(`    Backlinks: ${bl.totalBacklinks.toLocaleString()}  |  Referring Domains: ${bl.referringDomains.toLocaleString()}  |  Domain Rank: ${bl.domainRank}  |  Broken: ${bl.brokenBacklinks.toLocaleString()}`));
    console.log('');
  }

  if (report.keywordData && report.keywordData.length > 0) {
    console.log(chalk.cyan.bold('  Keyword Intelligence (DataforSEO):'));
    console.log(chalk.white(`    ${report.keywordData.length} keywords tracked`));
    const topKw = report.keywordData.filter(k => k.searchVolume > 0).sort((a, b) => b.searchVolume - a.searchVolume).slice(0, 3);
    if (topKw.length > 0) {
      topKw.forEach(k => console.log(chalk.white(`    "${k.keyword}" — ${k.searchVolume.toLocaleString()} mo. searches, $${k.cpc.toFixed(2)} CPC`)));
    }
    console.log('');
  }
}

function displayComparisonTable(comparison: CompetitorComparison) {
  console.log(chalk.bold.white('  COMPETITOR COMPARISON'));
  console.log('');

  const compNames = comparison.competitors.map(c => {
    try { return new URL(c.url).hostname.slice(0, 18); } catch { return c.url.slice(0, 18); }
  });

  const table = new Table({
    head: ['Category', 'You', ...compNames, 'Rank'].map(h => chalk.white.bold(h)),
    style: { head: [], border: ['gray'] },
  });

  for (const cat of comparison.categoryComparison) {
    const cFn = getScoreColor(cat.clientScore) === 'green' ? chalk.green : getScoreColor(cat.clientScore) === 'yellow' ? chalk.yellow : chalk.red;
    const compCells = cat.competitorScores.map(cs => {
      const fn = getScoreColor(cs.score) === 'green' ? chalk.green : getScoreColor(cs.score) === 'yellow' ? chalk.yellow : chalk.red;
      return fn(`${cs.score}`);
    });
    const rFn = cat.clientRank === 1 ? chalk.green.bold : cat.clientRank <= 2 ? chalk.yellow : chalk.red;
    table.push([cat.categoryLabel, cFn.bold(`${cat.clientScore}`), ...compCells, rFn(`#${cat.clientRank}`)]);
  }

  table.push([chalk.bold('OVERALL'), chalk.bold(`${comparison.clientReport.overallScore}`), ...comparison.competitors.map(c => chalk.bold(`${c.report.overallScore}`)), '']);
  console.log(table.toString());
  console.log('');

  if (comparison.gaps.length > 0) {
    console.log(chalk.red.bold('  Key Gaps:'));
    comparison.gaps.slice(0, 5).forEach(g => console.log(chalk.red(`    - ${g.finding} (${g.scoreDifference}pt gap)`)));
    console.log('');
  }
  if (comparison.strengths.length > 0) {
    console.log(chalk.green.bold('  Your Advantages:'));
    comparison.strengths.slice(0, 5).forEach(s => console.log(chalk.green(`    - ${s.finding}`)));
    console.log('');
  }
}

async function interactiveExplore(report: AuditReport, outputDir: string) {
  let exploring = true;
  while (exploring) {
    const choices: any[] = [
      { name: 'View findings by category', value: 'category' },
      { name: 'View task plan (month by month)', value: 'tasks' },
      { name: 'View all critical issues', value: 'critical' },
      { name: 'View quick wins', value: 'quick-wins' },
      { name: 'Walk me through the starting point', value: 'walkthrough' },
    ];
    if (report.gscData) {
      choices.push({ name: 'View top search queries', value: 'gsc-queries' });
      choices.push({ name: 'View top pages by traffic', value: 'gsc-pages' });
    }
    if (report.backlinkData) choices.push({ name: 'View backlink profile', value: 'backlinks' });
    if (report.keywordData && report.keywordData.length > 0) choices.push({ name: 'View keyword data', value: 'keywords' });
    if (report.comparison) choices.push({ name: 'View competitor comparison', value: 'comparison' });
    choices.push(new inquirer.Separator(), { name: 'Exit', value: 'exit' });

    const { action } = await inquirer.prompt([{ type: 'list', name: 'action', message: 'What would you like to explore?', choices }]);

    switch (action) {
      case 'category': await exploreCategoryFindings(report); break;
      case 'tasks': displayTaskPlan(report); break;
      case 'critical': displayCriticalIssues(report); break;
      case 'quick-wins': displayQuickWins(report); break;
      case 'walkthrough': await walkthroughStartingPoint(report); break;
      case 'gsc-queries': displayGSCQueries(report); break;
      case 'gsc-pages': displayGSCPages(report); break;
      case 'backlinks': displayBacklinks(report); break;
      case 'keywords': displayKeywords(report); break;
      case 'comparison': if (report.comparison) displayComparisonTable(report.comparison); break;
      case 'exit': exploring = false; console.log(chalk.gray('\n  Report saved. Open the HTML file in a browser for the full report.\n')); break;
    }
  }
}

async function exploreCategoryFindings(report: AuditReport) {
  const { category } = await inquirer.prompt([{
    type: 'list', name: 'category', message: 'Which category?',
    choices: report.categories.map(cat => ({ name: `${cat.categoryLabel} (${cat.score}/100, ${cat.findings.length} findings)`, value: cat.category })),
  }]);
  const cat = report.categories.find(c => c.category === category);
  if (!cat) return;
  console.log(`\n  ${chalk.bold(cat.categoryLabel)} — Score: ${cat.score}/100\n  ${chalk.gray(cat.summary)}\n`);
  if (cat.findings.length === 0) { console.log(chalk.green('  No issues found.\n')); return; }
  for (const f of cat.findings) {
    const sevColor = f.severity === 'critical' ? chalk.red : f.severity === 'high' ? chalk.hex('#ea580c') : f.severity === 'medium' ? chalk.yellow : f.severity === 'low' ? chalk.blue : chalk.gray;
    console.log(`  ${sevColor(`[${f.severity.toUpperCase()}]`)} ${chalk.bold(f.title)}\n  ${chalk.gray(f.description)}`);
    if (f.currentValue) console.log(chalk.red(`  Current: ${f.currentValue}`));
    if (f.recommendedValue) console.log(chalk.green(`  Target:  ${f.recommendedValue}`));
    console.log('');
  }
}

function displayTaskPlan(report: AuditReport) {
  const phases: { key: TaskPhase; label: string }[] = [
    { key: 'starting-point', label: 'Month 1: Starting Point' }, { key: 'month-2', label: 'Month 2: Performance & Technical' },
    { key: 'month-3', label: 'Month 3: On-Page Optimization' }, { key: 'month-4', label: 'Month 4: Structured Data' },
    { key: 'month-5', label: 'Month 5: AEO & AI Readiness' }, { key: 'month-6', label: 'Month 6: Ongoing & Monitoring' },
  ];
  console.log(`\n  ${chalk.bold.white('SEO Task Plan — 6-Month Roadmap')}\n  ${chalk.gray(`Total: ~${report.taskPlan.totalEstimatedHours}h`)}\n`);
  for (const phase of phases) {
    const tasks = report.taskPlan.monthlyTasks[phase.key] || [];
    if (tasks.length === 0) continue;
    const hrs = tasks.reduce((s, t) => s + t.estimatedHours, 0);
    console.log(chalk.bold.cyan(`  -- ${phase.label} --`) + chalk.gray(` (${tasks.length} tasks, ~${hrs}h)\n`));
    for (const t of tasks) {
      const p = t.priority > 70 ? chalk.red('P1') : t.priority > 40 ? chalk.yellow('P2') : chalk.blue('P3');
      const e = t.effort === 'low' ? chalk.green(t.effort) : t.effort === 'medium' ? chalk.yellow(t.effort) : chalk.red(t.effort);
      console.log(`  ${p} ${chalk.bold(t.title)} ${chalk.gray(`(${e}, ~${t.estimatedHours}h)`)}\n     ${chalk.gray(t.deliverable)}`);
    }
    console.log('');
  }
}

function displayCriticalIssues(report: AuditReport) {
  const criticals = report.categories.flatMap(c => c.findings).filter(f => f.severity === 'critical');
  console.log('');
  if (criticals.length === 0) { console.log(chalk.green.bold('  No critical issues.\n')); return; }
  console.log(chalk.red.bold(`  ${criticals.length} Critical Issues\n`));
  for (const f of criticals) {
    console.log(`${chalk.red.bold(`  > ${f.title}`)}\n    ${f.description}\n\n    ${chalk.yellow('Fix:')} ${chalk.gray(f.howToFix.replace(/\n/g, '\n    '))}\n    ${chalk.cyan('Impact:')} ${chalk.gray(f.impact)}\n`);
  }
}

function displayQuickWins(report: AuditReport) {
  const wins = report.categories.flatMap(c => c.findings).filter(f => f.effort === 'low' && f.severity !== 'info')
    .sort((a, b) => { const o: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }; return (o[a.severity] || 4) - (o[b.severity] || 4); });
  console.log('');
  if (wins.length === 0) { console.log(chalk.gray('  No quick wins.\n')); return; }
  console.log(chalk.green.bold(`  ${wins.length} Quick Wins\n`));
  for (const f of wins) {
    const c = f.severity === 'critical' ? chalk.red : f.severity === 'high' ? chalk.hex('#ea580c') : f.severity === 'medium' ? chalk.yellow : chalk.blue;
    console.log(`  ${c(`[${f.severity.toUpperCase()}]`)} ${chalk.bold(f.title)}\n    ${chalk.gray(f.howToFix.split('\n')[0])}\n`);
  }
}

function displayGSCQueries(report: AuditReport) {
  if (!report.gscData) return;
  const qs = report.gscData.searchAnalytics.topQueries.slice(0, 20);
  console.log(`\n  ${chalk.bold.white('Top Search Queries (Last 90 Days)')}\n`);
  const t = new Table({ head: ['Query', 'Clicks', 'Impressions', 'CTR', 'Pos'].map(h => chalk.white.bold(h)), style: { head: [], border: ['gray'] } });
  for (const q of qs) t.push([q.query.slice(0, 40), q.clicks.toLocaleString(), q.impressions.toLocaleString(), `${q.ctr}%`, `${q.position}`]);
  console.log(t.toString() + '\n');
}

function displayGSCPages(report: AuditReport) {
  if (!report.gscData) return;
  const ps = report.gscData.searchAnalytics.topPages.slice(0, 15);
  console.log(`\n  ${chalk.bold.white('Top Pages by Search Traffic')}\n`);
  const t = new Table({ head: ['Page', 'Clicks', 'Impressions', 'CTR', 'Pos'].map(h => chalk.white.bold(h)), style: { head: [], border: ['gray'] } });
  for (const p of ps) t.push([p.page.replace(/https?:\/\/[^/]+/, '').slice(0, 45) || '/', p.clicks.toLocaleString(), p.impressions.toLocaleString(), `${p.ctr}%`, `${p.position}`]);
  console.log(t.toString() + '\n');
}

function displayBacklinks(report: AuditReport) {
  if (!report.backlinkData) return;
  const bl = report.backlinkData;
  console.log(`\n  ${chalk.bold.white('Backlink Profile')}\n`);
  console.log(chalk.white(`  Total Backlinks: ${bl.totalBacklinks.toLocaleString()}`));
  console.log(chalk.white(`  Referring Domains: ${bl.referringDomains.toLocaleString()}`));
  console.log(chalk.white(`  Domain Rank: ${bl.domainRank}/100`));
  console.log(chalk.white(`  Broken Backlinks: ${bl.brokenBacklinks.toLocaleString()}`));

  if (bl.topReferringDomains.length > 0) {
    console.log(`\n  ${chalk.bold('Top Referring Domains:')}`);
    const t = new Table({ head: ['Domain', 'Backlinks', 'Rank'].map(h => chalk.white.bold(h)), style: { head: [], border: ['gray'] } });
    bl.topReferringDomains.slice(0, 10).forEach(d => t.push([d.domain, d.backlinks.toLocaleString(), `${d.rank}`]));
    console.log(t.toString());
  }

  if (bl.topAnchors.length > 0) {
    console.log(`\n  ${chalk.bold('Top Anchor Texts:')}`);
    const t = new Table({ head: ['Anchor Text', 'Count'].map(h => chalk.white.bold(h)), style: { head: [], border: ['gray'] } });
    bl.topAnchors.slice(0, 10).forEach(a => t.push([a.anchor.slice(0, 50), a.count.toLocaleString()]));
    console.log(t.toString());
  }
  console.log('');
}

function displayKeywords(report: AuditReport) {
  if (!report.keywordData || report.keywordData.length === 0) return;
  const kws = report.keywordData.filter(k => k.searchVolume > 0).sort((a, b) => b.searchVolume - a.searchVolume);
  console.log(`\n  ${chalk.bold.white('Keyword Intelligence')}\n`);
  console.log(chalk.white(`  ${report.keywordData.length} keywords tracked, ${kws.length} with search volume\n`));
  const t = new Table({ head: ['Keyword', 'Volume', 'CPC', 'Competition'].map(h => chalk.white.bold(h)), style: { head: [], border: ['gray'] } });
  kws.slice(0, 25).forEach(k => {
    const compLabel = k.competition > 0.7 ? chalk.red('High') : k.competition > 0.3 ? chalk.yellow('Med') : chalk.green('Low');
    t.push([k.keyword.slice(0, 40), k.searchVolume.toLocaleString(), `$${k.cpc.toFixed(2)}`, compLabel]);
  });
  console.log(t.toString() + '\n');
}

async function walkthroughStartingPoint(report: AuditReport) {
  const tasks = report.taskPlan.startingPoint;
  if (tasks.length === 0) { console.log(chalk.green('\n  No starting point tasks — the site is in good shape!\n')); return; }
  console.log(`\n  ${chalk.bold.white('Month 1 Starting Point Walkthrough')}\n  ${chalk.gray(`${tasks.length} tasks`)}\n`);
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    console.log(`  ${chalk.bold.cyan(`Task ${i + 1}/${tasks.length}: ${t.title}`)}\n  ${t.description}\n\n  ${chalk.yellow('Deliverable:')} ${t.deliverable}\n  ${chalk.yellow('Effort:')} ${t.effort} (~${t.estimatedHours}h)\n`);
    console.log(chalk.bold('  Steps:'));
    t.steps.forEach((s, j) => console.log(`    ${j + 1}. ${s}`));
    console.log('');
    if (i < tasks.length - 1) {
      const { next } = await inquirer.prompt([{ type: 'list', name: 'next', message: 'Continue?', choices: [{ name: 'Next task', value: 'next' }, { name: 'Back to menu', value: 'menu' }] }]);
      if (next === 'menu') break;
    } else {
      console.log(chalk.green.bold('  Month 1 complete! Move to Month 2 next.\n'));
    }
  }
}

program.parse();
