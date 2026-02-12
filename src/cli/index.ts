#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import Table from 'cli-table3';
import { crawlUrl } from '../utils/crawler.js';
import { analyzeTechnical } from '../analyzers/technical.js';
import { analyzeOnPage } from '../analyzers/onpage.js';
import { analyzePerformance } from '../analyzers/performance.js';
import { analyzeSchema } from '../analyzers/schema.js';
import { analyzeAEO } from '../analyzers/aeo.js';
import { generateTaskPlan } from '../tasks/generator.js';
import { generateReport, saveReport } from '../reports/generator.js';
import { calculateOverallScore, getGrade, getScoreColor, getSeverityColor } from '../utils/scoring.js';
import type { AnalyzerResult, AuditReport, Finding, SEOTask, TaskPhase } from '../types.js';
import { DEFAULT_CONFIG } from '../types.js';
import path from 'path';

const program = new Command();

program
  .name('idp-seo')
  .description('Agency-level SEO audit, task generation, and reporting tool')
  .version('1.0.0');

program
  .command('audit')
  .description('Run a full SEO audit on a URL')
  .option('-u, --url <url>', 'URL to audit')
  .option('-o, --output <dir>', 'Output directory for reports', './reports')
  .option('--api-key <key>', 'Google PageSpeed Insights API key (optional)')
  .option('--skip-performance', 'Skip performance analysis (faster)')
  .option('--json', 'Output raw JSON instead of interactive display')
  .action(async (options) => {
    let url = options.url;

    // If no URL provided, prompt for it
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
    console.log(chalk.bold.white('  IDP SEO Audit Tool v1.0'));
    console.log(chalk.gray('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log('');

    try {
      const report = await runAudit(url, options);

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
        return;
      }

      // Display results interactively
      displayOverview(report);

      // Ask what to explore
      await interactiveExplore(report, options.output);

    } catch (err: any) {
      console.log('');
      console.log(chalk.red.bold('  Error: ') + chalk.red(err.message || 'Unknown error'));
      if (err.code === 'ENOTFOUND') {
        console.log(chalk.yellow('  The URL could not be reached. Check the URL and your internet connection.'));
      }
      process.exit(1);
    }
  });

async function runAudit(
  url: string,
  options: { apiKey?: string; skipPerformance?: boolean; output?: string }
): Promise<AuditReport> {
  // Step 1: Crawl
  const crawlSpinner = ora({
    text: chalk.cyan('Crawling site...'),
    color: 'cyan',
  }).start();

  const crawlResult = await crawlUrl(url, DEFAULT_CONFIG);

  crawlSpinner.succeed(
    chalk.green(`Crawled ${crawlResult.finalUrl} `) +
    chalk.gray(`(${crawlResult.statusCode}, ${crawlResult.responseTime}ms)`)
  );

  // Step 2: Run analyzers
  const analyzeSpinner = ora({
    text: chalk.cyan('Running SEO analysis...'),
    color: 'cyan',
  }).start();

  const results: AnalyzerResult[] = [];

  // Technical analysis
  analyzeSpinner.text = chalk.cyan('Analyzing technical SEO...');
  results.push(analyzeTechnical(crawlResult));

  // On-page analysis
  analyzeSpinner.text = chalk.cyan('Analyzing on-page SEO...');
  results.push(analyzeOnPage(crawlResult));

  // Performance analysis
  if (!options.skipPerformance) {
    analyzeSpinner.text = chalk.cyan('Analyzing performance (this may take a moment)...');
    try {
      const perfResult = await analyzePerformance(crawlResult, options.apiKey);
      results.push(perfResult);
    } catch {
      analyzeSpinner.warn(chalk.yellow('Performance analysis failed - continuing without it'));
    }
  }

  // Schema analysis
  analyzeSpinner.text = chalk.cyan('Analyzing structured data...');
  results.push(analyzeSchema(crawlResult));

  // AEO analysis
  analyzeSpinner.text = chalk.cyan('Analyzing AEO / AI readiness...');
  results.push(analyzeAEO(crawlResult));

  analyzeSpinner.succeed(chalk.green(`Analysis complete — ${results.length} categories evaluated`));

  // Step 3: Generate task plan
  const taskSpinner = ora({
    text: chalk.cyan('Generating task plan...'),
    color: 'cyan',
  }).start();

  const taskPlan = generateTaskPlan(crawlResult.finalUrl, results);

  taskSpinner.succeed(
    chalk.green(`Task plan generated — ${Object.values(taskPlan.monthlyTasks).flat().length} tasks across 6 months`)
  );

  // Step 4: Calculate overall score
  const overallScore = calculateOverallScore(results);

  // Build executive summary
  const totalFindings = results.reduce((sum, r) => sum + r.findings.length, 0);
  const criticals = results.reduce(
    (sum, r) => sum + r.findings.filter(f => f.severity === 'critical').length, 0
  );
  const quickWins = results.reduce(
    (sum, r) => sum + r.findings.filter(f => f.effort === 'low' && f.severity !== 'info').length, 0
  );

  let execSummary = `This SEO audit of ${crawlResult.finalUrl} identified ${totalFindings} findings across ${results.length} categories, resulting in an overall score of ${overallScore}/100 (${getGrade(overallScore)}).`;

  if (criticals > 0) {
    execSummary += ` There are ${criticals} critical issues that should be addressed immediately.`;
  }

  if (quickWins > 0) {
    execSummary += ` ${quickWins} quick wins were identified that can be resolved with minimal effort.`;
  }

  execSummary += ` The generated task plan provides a structured 6-month roadmap, starting with the most impactful fixes and building toward comprehensive optimization.`;

  const report: AuditReport = {
    url,
    finalUrl: crawlResult.finalUrl,
    generatedAt: new Date().toISOString(),
    overallScore,
    categories: results,
    taskPlan,
    executiveSummary: execSummary,
    crawlData: crawlResult,
  };

  // Step 5: Generate and save HTML report
  const reportSpinner = ora({
    text: chalk.cyan('Generating HTML report...'),
    color: 'cyan',
  }).start();

  const html = generateReport(report);
  const outputDir = options.output || './reports';
  const reportPath = saveReport(html, crawlResult.finalUrl, outputDir);

  reportSpinner.succeed(chalk.green(`Report saved to ${reportPath}`));

  console.log('');

  return report;
}

function displayOverview(report: AuditReport) {
  const scoreColor = getScoreColor(report.overallScore);
  const colorFn = scoreColor === 'green' ? chalk.green : scoreColor === 'yellow' ? chalk.yellow : chalk.red;

  // Overall score display
  console.log(chalk.bold.white('  ┌─────────────────────────────────────┐'));
  console.log(chalk.bold.white('  │  ') + chalk.bold.white('OVERALL SCORE: ') + colorFn.bold(`${report.overallScore}/100 (${getGrade(report.overallScore)})`) + chalk.bold.white('       │'));
  console.log(chalk.bold.white('  └─────────────────────────────────────┘'));
  console.log('');

  // Category scores table
  const table = new Table({
    head: [
      chalk.white.bold('Category'),
      chalk.white.bold('Score'),
      chalk.white.bold('Grade'),
      chalk.white.bold('Findings'),
      chalk.white.bold('Critical'),
    ],
    colWidths: [30, 10, 10, 12, 12],
    style: { head: [], border: ['gray'] },
  });

  for (const cat of report.categories) {
    const catScoreColor = getScoreColor(cat.score);
    const catColorFn = catScoreColor === 'green' ? chalk.green : catScoreColor === 'yellow' ? chalk.yellow : chalk.red;
    const criticalCount = cat.findings.filter(f => f.severity === 'critical').length;

    table.push([
      cat.categoryLabel,
      catColorFn.bold(`${cat.score}`),
      catColorFn(getGrade(cat.score)),
      `${cat.findings.length}`,
      criticalCount > 0 ? chalk.red.bold(`${criticalCount}`) : chalk.gray('0'),
    ]);
  }

  console.log(table.toString());
  console.log('');

  // Quick summary of most critical findings
  const criticalFindings = report.categories
    .flatMap(c => c.findings)
    .filter(f => f.severity === 'critical');

  if (criticalFindings.length > 0) {
    console.log(chalk.red.bold('  ⚠ Critical Issues:'));
    for (const finding of criticalFindings) {
      console.log(chalk.red(`    • ${finding.title}`));
    }
    console.log('');
  }

  // Quick wins
  const quickWins = report.categories
    .flatMap(c => c.findings)
    .filter(f => f.effort === 'low' && (f.severity === 'high' || f.severity === 'medium'))
    .slice(0, 5);

  if (quickWins.length > 0) {
    console.log(chalk.green.bold('  ✓ Top Quick Wins:'));
    for (const finding of quickWins) {
      console.log(chalk.green(`    • ${finding.title}`) + chalk.gray(` (${finding.severity})`));
    }
    console.log('');
  }
}

async function interactiveExplore(report: AuditReport, outputDir: string) {
  let exploring = true;

  while (exploring) {
    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to explore?',
      choices: [
        { name: 'View findings by category', value: 'category' },
        { name: 'View task plan (month by month)', value: 'tasks' },
        { name: 'View all critical issues', value: 'critical' },
        { name: 'View quick wins', value: 'quick-wins' },
        { name: 'Walk me through the starting point', value: 'walkthrough' },
        new inquirer.Separator(),
        { name: 'Exit', value: 'exit' },
      ],
    }]);

    switch (action) {
      case 'category':
        await exploreCategoryFindings(report);
        break;
      case 'tasks':
        displayTaskPlan(report);
        break;
      case 'critical':
        displayCriticalIssues(report);
        break;
      case 'quick-wins':
        displayQuickWins(report);
        break;
      case 'walkthrough':
        await walkthroughStartingPoint(report);
        break;
      case 'exit':
        exploring = false;
        console.log('');
        console.log(chalk.gray('  Report saved. Open the HTML file in a browser for the full detailed report.'));
        console.log('');
        break;
    }
  }
}

async function exploreCategoryFindings(report: AuditReport) {
  const { category } = await inquirer.prompt([{
    type: 'list',
    name: 'category',
    message: 'Which category?',
    choices: report.categories.map(cat => ({
      name: `${cat.categoryLabel} (${cat.score}/100, ${cat.findings.length} findings)`,
      value: cat.category,
    })),
  }]);

  const cat = report.categories.find(c => c.category === category);
  if (!cat) return;

  console.log('');
  console.log(chalk.bold(`  ${cat.categoryLabel} — Score: ${cat.score}/100`));
  console.log(chalk.gray(`  ${cat.summary}`));
  console.log('');

  if (cat.findings.length === 0) {
    console.log(chalk.green('  No issues found in this category.'));
    console.log('');
    return;
  }

  for (const finding of cat.findings) {
    const sevColor = finding.severity === 'critical' ? chalk.red :
      finding.severity === 'high' ? chalk.hex('#ea580c') :
      finding.severity === 'medium' ? chalk.yellow :
      finding.severity === 'low' ? chalk.blue :
      chalk.gray;

    console.log(`  ${sevColor(`[${finding.severity.toUpperCase()}]`)} ${chalk.bold(finding.title)}`);
    console.log(chalk.gray(`  ${finding.description}`));

    if (finding.currentValue) {
      console.log(chalk.red(`  Current: ${finding.currentValue}`));
    }
    if (finding.recommendedValue) {
      console.log(chalk.green(`  Target:  ${finding.recommendedValue}`));
    }
    console.log('');
  }
}

function displayTaskPlan(report: AuditReport) {
  const { taskPlan } = report;

  const phases: { key: TaskPhase; label: string }[] = [
    { key: 'starting-point', label: 'Month 1: Starting Point' },
    { key: 'month-2', label: 'Month 2: Performance & Technical' },
    { key: 'month-3', label: 'Month 3: On-Page Optimization' },
    { key: 'month-4', label: 'Month 4: Structured Data' },
    { key: 'month-5', label: 'Month 5: AEO & AI Readiness' },
    { key: 'month-6', label: 'Month 6: Ongoing & Monitoring' },
  ];

  console.log('');
  console.log(chalk.bold.white('  SEO Task Plan — 6-Month Roadmap'));
  console.log(chalk.gray(`  Total estimated effort: ~${taskPlan.totalEstimatedHours} hours`));
  console.log('');

  for (const phase of phases) {
    const tasks = taskPlan.monthlyTasks[phase.key] || [];
    if (tasks.length === 0) continue;

    const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);

    console.log(chalk.bold.cyan(`  ━━ ${phase.label} ━━`) + chalk.gray(` (${tasks.length} tasks, ~${totalHours}h)`));
    console.log('');

    for (const task of tasks) {
      const priorityLabel = task.priority > 70 ? chalk.red('P1') :
        task.priority > 40 ? chalk.yellow('P2') : chalk.blue('P3');
      const effortLabel = task.effort === 'low' ? chalk.green(task.effort) :
        task.effort === 'medium' ? chalk.yellow(task.effort) : chalk.red(task.effort);

      console.log(`  ${priorityLabel} ${chalk.bold(task.title)} ${chalk.gray(`(${effortLabel} effort, ~${task.estimatedHours}h)`)}`);
      console.log(chalk.gray(`     ${task.deliverable}`));
    }
    console.log('');
  }
}

function displayCriticalIssues(report: AuditReport) {
  const criticals = report.categories.flatMap(c => c.findings).filter(f => f.severity === 'critical');

  console.log('');
  if (criticals.length === 0) {
    console.log(chalk.green.bold('  No critical issues found.'));
    console.log('');
    return;
  }

  console.log(chalk.red.bold(`  ${criticals.length} Critical Issues`));
  console.log('');

  for (const finding of criticals) {
    console.log(chalk.red.bold(`  ▸ ${finding.title}`));
    console.log(chalk.white(`    ${finding.description}`));
    console.log('');
    console.log(chalk.yellow('    How to fix:'));
    console.log(chalk.gray(`    ${finding.howToFix.replace(/\n/g, '\n    ')}`));
    console.log('');
    console.log(chalk.cyan('    Impact:'));
    console.log(chalk.gray(`    ${finding.impact}`));
    console.log('');
    console.log(chalk.gray('    ─────────────────────────────────'));
    console.log('');
  }
}

function displayQuickWins(report: AuditReport) {
  const quickWins = report.categories
    .flatMap(c => c.findings)
    .filter(f => f.effort === 'low' && f.severity !== 'info')
    .sort((a, b) => {
      const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return (sevOrder[a.severity] || 4) - (sevOrder[b.severity] || 4);
    });

  console.log('');
  if (quickWins.length === 0) {
    console.log(chalk.gray('  No quick wins identified.'));
    console.log('');
    return;
  }

  console.log(chalk.green.bold(`  ${quickWins.length} Quick Wins (Low Effort)`));
  console.log('');

  for (const finding of quickWins) {
    const sevColor = finding.severity === 'critical' ? chalk.red :
      finding.severity === 'high' ? chalk.hex('#ea580c') :
      finding.severity === 'medium' ? chalk.yellow : chalk.blue;

    console.log(`  ${sevColor(`[${finding.severity.toUpperCase()}]`)} ${chalk.bold(finding.title)}`);
    console.log(chalk.gray(`    ${finding.howToFix.split('\n')[0]}`));
    console.log('');
  }
}

async function walkthroughStartingPoint(report: AuditReport) {
  const startingTasks = report.taskPlan.startingPoint;

  if (startingTasks.length === 0) {
    console.log('');
    console.log(chalk.green('  No starting point tasks — the site is in good shape!'));
    console.log('');
    return;
  }

  console.log('');
  console.log(chalk.bold.white('  ━━ Month 1 Starting Point Walkthrough ━━'));
  console.log(chalk.gray(`  ${startingTasks.length} tasks to complete first.`));
  console.log('');

  for (let i = 0; i < startingTasks.length; i++) {
    const task = startingTasks[i];

    console.log(chalk.bold.cyan(`  Task ${i + 1}/${startingTasks.length}: ${task.title}`));
    console.log(chalk.white(`  ${task.description}`));
    console.log('');
    console.log(chalk.yellow('  Deliverable: ') + chalk.white(task.deliverable));
    console.log(chalk.yellow('  Effort: ') + chalk.white(`${task.effort} (~${task.estimatedHours} hours)`));
    console.log('');

    console.log(chalk.bold('  Steps:'));
    for (let j = 0; j < task.steps.length; j++) {
      console.log(chalk.white(`    ${j + 1}. ${task.steps[j]}`));
    }
    console.log('');

    if (i < startingTasks.length - 1) {
      const { next } = await inquirer.prompt([{
        type: 'list',
        name: 'next',
        message: 'Continue?',
        choices: [
          { name: 'Next task →', value: 'next' },
          { name: 'Back to menu', value: 'menu' },
        ],
      }]);

      if (next === 'menu') break;
    } else {
      console.log(chalk.green.bold('  ✓ That\'s the complete Month 1 starting point!'));
      console.log(chalk.gray('  Complete these tasks first, then move to Month 2.'));
      console.log('');
    }
  }
}

// Parse and run
program.parse();
