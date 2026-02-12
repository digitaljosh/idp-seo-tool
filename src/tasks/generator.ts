import type {
  Finding,
  AnalyzerResult,
  SEOTask,
  TaskPlan,
  TaskPhase,
  AuditCategory,
  Effort,
} from '../types.js';
import { calculateFindingPriority, sortByPriority } from '../utils/scoring.js';
import { TASK_TEMPLATES } from './templates.js';

/**
 * Task Generator
 *
 * Converts audit findings into a prioritized, phased task plan.
 * Follows the agency's workflow: technical/performance first, then on-page.
 *
 * Phase logic:
 * - Starting Point (Month 1): Critical fixes, quick wins, technical foundation
 * - Month 2: Performance optimization, remaining technical fixes
 * - Month 3: On-page optimization, content improvements
 * - Month 4: Schema/structured data implementation
 * - Month 5: AEO/AI readiness optimization
 * - Month 6: Advanced optimization, monitoring, iteration
 */
export function generateTaskPlan(
  url: string,
  results: AnalyzerResult[]
): TaskPlan {
  // Collect all findings across categories
  const allFindings: Finding[] = results.flatMap(r => r.findings);
  const sorted = sortByPriority(allFindings);

  // Generate tasks from findings
  const tasks: SEOTask[] = [];
  let taskIdCounter = 1;

  // Group findings by category for phased assignment
  const byCategory = groupByCategory(sorted);

  // --- STARTING POINT (Month 1): Critical + Quick Wins ---
  // Critical issues from any category go first
  const criticalFindings = sorted.filter(f => f.severity === 'critical');
  for (const finding of criticalFindings) {
    const task = createTaskFromFinding(finding, 'starting-point', taskIdCounter++);
    if (task) tasks.push(task);
  }

  // High-severity technical issues in Month 1
  const highTechnical = (byCategory.technical || [])
    .filter(f => f.severity === 'high');
  for (const finding of highTechnical) {
    const task = createTaskFromFinding(finding, 'starting-point', taskIdCounter++);
    if (task) tasks.push(task);
  }

  // Quick wins (low effort, any severity above info)
  const quickWins = sorted.filter(
    f => f.effort === 'low' && f.severity !== 'info' && f.severity !== 'critical'
      && !tasks.some(t => t.relatedFindings.includes(f.id))
  );
  for (const finding of quickWins.slice(0, 5)) { // Cap quick wins
    const task = createTaskFromFinding(finding, 'starting-point', taskIdCounter++);
    if (task) tasks.push(task);
  }

  // --- MONTH 2: Performance + Remaining Technical ---
  const remainingTechnical = (byCategory.technical || [])
    .filter(f => !tasks.some(t => t.relatedFindings.includes(f.id)) && f.severity !== 'info');
  for (const finding of remainingTechnical) {
    const task = createTaskFromFinding(finding, 'month-2', taskIdCounter++);
    if (task) tasks.push(task);
  }

  const perfFindings = (byCategory.performance || [])
    .filter(f => !tasks.some(t => t.relatedFindings.includes(f.id)) && f.severity !== 'info');
  for (const finding of perfFindings) {
    const task = createTaskFromFinding(finding, 'month-2', taskIdCounter++);
    if (task) tasks.push(task);
  }

  // --- MONTH 3: On-Page SEO ---
  const onpageFindings = (byCategory.onpage || [])
    .filter(f => !tasks.some(t => t.relatedFindings.includes(f.id)) && f.severity !== 'info');
  for (const finding of onpageFindings) {
    const task = createTaskFromFinding(finding, 'month-3', taskIdCounter++);
    if (task) tasks.push(task);
  }

  // --- MONTH 4: Schema/Structured Data ---
  const schemaFindings = (byCategory.schema || [])
    .filter(f => !tasks.some(t => t.relatedFindings.includes(f.id)) && f.severity !== 'info');
  for (const finding of schemaFindings) {
    const task = createTaskFromFinding(finding, 'month-4', taskIdCounter++);
    if (task) tasks.push(task);
  }

  // --- MONTH 5: AEO/AI Readiness ---
  const aeoFindings = (byCategory.aeo || [])
    .filter(f => !tasks.some(t => t.relatedFindings.includes(f.id)) && f.severity !== 'info');
  for (const finding of aeoFindings) {
    const task = createTaskFromFinding(finding, 'month-5', taskIdCounter++);
    if (task) tasks.push(task);
  }

  // --- MONTH 6: Ongoing + Monitoring Tasks ---
  tasks.push(...generateOngoingTasks(taskIdCounter, results));

  // Build the monthly breakdown
  const monthlyTasks: Record<TaskPhase, SEOTask[]> = {
    'starting-point': tasks.filter(t => t.phase === 'starting-point'),
    'month-2': tasks.filter(t => t.phase === 'month-2'),
    'month-3': tasks.filter(t => t.phase === 'month-3'),
    'month-4': tasks.filter(t => t.phase === 'month-4'),
    'month-5': tasks.filter(t => t.phase === 'month-5'),
    'month-6': tasks.filter(t => t.phase === 'month-6'),
  };

  const totalEstimatedHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);

  return {
    url,
    generatedAt: new Date().toISOString(),
    startingPoint: monthlyTasks['starting-point'],
    monthlyTasks,
    totalEstimatedHours,
    summary: generatePlanSummary(results, tasks, totalEstimatedHours),
  };
}

function groupByCategory(findings: Finding[]): Partial<Record<AuditCategory, Finding[]>> {
  const groups: Partial<Record<AuditCategory, Finding[]>> = {};
  for (const finding of findings) {
    if (!groups[finding.category]) {
      groups[finding.category] = [];
    }
    groups[finding.category]!.push(finding);
  }
  return groups;
}

function createTaskFromFinding(
  finding: Finding,
  phase: TaskPhase,
  id: number
): SEOTask | null {
  // Skip info-level findings -- they don't generate tasks
  if (finding.severity === 'info') return null;

  const template = TASK_TEMPLATES[finding.id];
  const priority = calculateFindingPriority(finding);

  // Estimate hours based on effort
  const effortHours: Record<Effort, number> = {
    low: 1,
    medium: 3,
    high: 6,
  };

  return {
    id: `task-${id}`,
    title: template?.title || `Fix: ${finding.title}`,
    description: template?.description || finding.description,
    category: finding.category,
    phase,
    priority,
    effort: finding.effort,
    estimatedHours: template?.estimatedHours || effortHours[finding.effort],
    deliverable: template?.deliverable || `Resolve: ${finding.title}`,
    steps: template?.steps || generateStepsFromFinding(finding),
    relatedFindings: [finding.id],
    status: 'pending',
  };
}

function generateStepsFromFinding(finding: Finding): string[] {
  const steps: string[] = [];

  steps.push(`Audit current state: ${finding.currentValue || finding.description}`);
  steps.push(finding.howToFix);

  if (finding.recommendedValue) {
    steps.push(`Target: ${finding.recommendedValue}`);
  }

  steps.push('Verify the fix is working correctly');
  steps.push('Document the change for client reporting');

  return steps;
}

function generateOngoingTasks(startId: number, results: AnalyzerResult[]): SEOTask[] {
  const tasks: SEOTask[] = [];
  let id = startId;

  // Monthly monitoring task
  tasks.push({
    id: `task-${id++}`,
    title: 'Monthly SEO Performance Review',
    description: 'Run a follow-up audit to measure improvements from previous months. Compare scores, review rankings, and identify new opportunities.',
    category: 'technical',
    phase: 'month-6',
    priority: 70,
    effort: 'medium',
    estimatedHours: 3,
    deliverable: 'Monthly SEO performance report showing progress and next priorities',
    steps: [
      'Re-run the SEO audit tool on the site',
      'Compare scores across all categories with previous months',
      'Document improvements and remaining issues',
      'Review Google Search Console for ranking changes (if connected)',
      'Identify new opportunities based on updated data',
      'Prepare client-facing progress report',
    ],
    relatedFindings: [],
    status: 'pending',
  });

  // Content refresh task
  tasks.push({
    id: `task-${id++}`,
    title: 'Content Refresh & Expansion',
    description: 'Review existing content for freshness, accuracy, and completeness. Update outdated information and expand thin content areas.',
    category: 'onpage',
    phase: 'month-6',
    priority: 60,
    effort: 'high',
    estimatedHours: 8,
    deliverable: 'Updated content across key pages with improved depth and freshness signals',
    steps: [
      'Identify pages with thin or outdated content',
      'Research current best practices and updated information for each topic',
      'Expand content with new sections, FAQs, and examples',
      'Update publish dates and add "last updated" timestamps',
      'Ensure all new content follows AEO best practices (clear answers, structured format)',
      'Add internal links to new content sections',
    ],
    relatedFindings: [],
    status: 'pending',
  });

  // Competitor analysis task
  tasks.push({
    id: `task-${id++}`,
    title: 'Competitor SEO Analysis',
    description: 'Analyze top 3-5 competitors to identify gaps and opportunities. Look at their content strategy, schema usage, and technical implementation.',
    category: 'onpage',
    phase: 'month-6',
    priority: 50,
    effort: 'high',
    estimatedHours: 6,
    deliverable: 'Competitor analysis report with actionable recommendations',
    steps: [
      'Identify top 3-5 competitors ranking for target keywords',
      'Run SEO audits on competitor sites',
      'Compare technical SEO implementation',
      'Analyze competitor content strategy (topics, depth, format)',
      'Identify schema and structured data advantages',
      'Document specific opportunities where competitors are ahead',
      'Create action items to close competitive gaps',
    ],
    relatedFindings: [],
    status: 'pending',
  });

  return tasks;
}

function generatePlanSummary(
  results: AnalyzerResult[],
  tasks: SEOTask[],
  totalHours: number
): string {
  const criticalCount = tasks.filter(t => t.priority > 70).length;
  const quickWinCount = tasks.filter(t => t.effort === 'low' && t.priority > 30).length;
  const startingPointCount = tasks.filter(t => t.phase === 'starting-point').length;

  const categoryScores = results.map(r => `${r.categoryLabel}: ${r.score}/100`).join(', ');

  return `SEO Task Plan generated with ${tasks.length} total tasks across 6 months. ` +
    `${criticalCount} critical priority items, ${quickWinCount} quick wins identified. ` +
    `Month 1 starting point: ${startingPointCount} tasks. ` +
    `Category scores: ${categoryScores}. ` +
    `Estimated total effort: ~${totalHours} hours over the 6-month engagement.`;
}
