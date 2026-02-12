import type { Finding, Severity, Effort, AnalyzerResult } from '../types.js';

/**
 * Scoring system for SEO findings.
 * Converts raw findings into prioritized, actionable scores.
 */

/** Weight multipliers for severity levels */
const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

/** Priority score boost based on effort (quick wins get boosted) */
const EFFORT_BOOST: Record<Effort, number> = {
  low: 15,    // Easy fix = higher priority
  medium: 5,
  high: 0,
};

/**
 * Calculate the overall score for an analyzer category.
 * 100 = perfect, 0 = critical issues everywhere.
 * Score is reduced by the weighted severity of findings.
 */
export function calculateCategoryScore(findings: Finding[]): number {
  if (findings.length === 0) return 100;

  const totalDeductions = findings.reduce((sum, f) => {
    return sum + SEVERITY_WEIGHTS[f.severity];
  }, 0);

  // Cap deductions at 100
  const score = Math.max(0, 100 - totalDeductions);
  return Math.round(score);
}

/**
 * Calculate the overall audit score from all category results.
 * Weighted average favoring technical and performance.
 */
export function calculateOverallScore(results: AnalyzerResult[]): number {
  const CATEGORY_WEIGHTS: Record<string, number> = {
    technical: 0.25,
    onpage: 0.25,
    performance: 0.25,
    schema: 0.15,
    aeo: 0.10,
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const result of results) {
    const weight = CATEGORY_WEIGHTS[result.category] || 0.1;
    weightedSum += result.score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
}

/**
 * Calculate priority score for a finding.
 * Higher score = should be fixed first.
 * Combines severity (impact) with effort (ease of fix).
 */
export function calculateFindingPriority(finding: Finding): number {
  const severityScore = SEVERITY_WEIGHTS[finding.severity] * 3;
  const effortBoost = EFFORT_BOOST[finding.effort];
  return Math.min(100, severityScore + effortBoost);
}

/**
 * Sort findings by priority (highest first).
 */
export function sortByPriority(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    return calculateFindingPriority(b) - calculateFindingPriority(a);
  });
}

/**
 * Get a letter grade from a numeric score.
 */
export function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

/**
 * Get a color for a score (for terminal and report display).
 */
export function getScoreColor(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

/**
 * Get a color for severity level.
 */
export function getSeverityColor(severity: Severity): string {
  switch (severity) {
    case 'critical': return '#dc2626';
    case 'high': return '#ea580c';
    case 'medium': return '#ca8a04';
    case 'low': return '#2563eb';
    case 'info': return '#6b7280';
  }
}

/**
 * Generate a summary sentence for a category score.
 */
export function getScoreSummary(category: string, score: number): string {
  const grade = getGrade(score);
  if (score >= 90) return `${category} is in excellent shape (${grade}). Minor optimizations possible.`;
  if (score >= 80) return `${category} is good (${grade}) with some improvements recommended.`;
  if (score >= 70) return `${category} needs attention (${grade}). Several issues should be addressed.`;
  if (score >= 60) return `${category} has significant issues (${grade}). Priority fixes needed.`;
  return `${category} needs urgent work (${grade}). Critical issues detected.`;
}
