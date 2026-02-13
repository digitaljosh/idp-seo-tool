import type {
  AuditReport,
  CompetitorComparison,
  CompetitorEntry,
  CategoryComparison,
  CompetitorGap,
  CompetitorStrength,
} from '../types.js';
import { runCoreAudit, type AuditOptions } from './audit.js';

export interface CompetitorOptions extends AuditOptions {
  competitors: string[];
}

/**
 * Runs the client audit + competitor audits, then produces
 * a side-by-side comparison with gaps and strengths.
 */
export async function runCompetitorComparison(
  options: CompetitorOptions
): Promise<{ clientResult: { report: AuditReport; html: string }; comparison: CompetitorComparison }> {
  const progress = options.onProgress || (() => {});

  // 1. Run client audit
  progress('client-audit', `Auditing client site: ${options.url}`);
  const clientResult = await runCoreAudit(options);

  // 2. Run competitor audits (sequentially to be polite to target sites)
  const competitors: CompetitorEntry[] = [];
  const compUrls = options.competitors.slice(0, 3); // Cap at 3

  for (let i = 0; i < compUrls.length; i++) {
    const compUrl = compUrls[i];
    progress('competitor-audit', `Auditing competitor ${i + 1}/${compUrls.length}: ${compUrl}`);
    try {
      const compResult = await runCoreAudit({
        ...options,
        url: compUrl,
        skipSearchConsole: true,   // GSC only works for sites you own
        gscKeyFile: undefined,
        onProgress: (step, detail) => {
          progress('competitor-audit', `[${compUrl}] ${detail || step}`);
        },
      });
      competitors.push({ url: compUrl, report: compResult.report });
    } catch (err: any) {
      progress('competitor-audit', `Failed to audit ${compUrl}: ${err.message}`);
      // Continue with remaining competitors
    }
  }

  // 3. Build comparison
  const categoryComparison = buildCategoryComparison(clientResult.report, competitors);
  const gaps = identifyGaps(clientResult.report, competitors, categoryComparison);
  const strengths = identifyStrengths(clientResult.report, competitors, categoryComparison);

  const comparison: CompetitorComparison = {
    clientUrl: options.url,
    clientReport: clientResult.report,
    competitors,
    categoryComparison,
    gaps,
    strengths,
    generatedAt: new Date().toISOString(),
  };

  // Attach comparison to client report
  clientResult.report.comparison = comparison;

  return { clientResult, comparison };
}

function buildCategoryComparison(
  client: AuditReport,
  competitors: CompetitorEntry[]
): CategoryComparison[] {
  return client.categories.map(clientCat => {
    const compScores = competitors.map(comp => {
      const compCat = comp.report.categories.find(c => c.category === clientCat.category);
      return { url: comp.url, score: compCat?.score ?? 0 };
    });

    const avgCompScore = compScores.length > 0
      ? compScores.reduce((s, c) => s + c.score, 0) / compScores.length
      : 0;

    // Rank: 1 = best among client + competitors
    const allScores = [
      { score: clientCat.score, isClient: true },
      ...compScores.map(c => ({ score: c.score, isClient: false })),
    ].sort((a, b) => b.score - a.score);

    const clientRank = allScores.findIndex(s => s.isClient) + 1;

    return {
      category: clientCat.category,
      categoryLabel: clientCat.categoryLabel,
      clientScore: clientCat.score,
      competitorScores: compScores,
      averageCompetitorScore: Math.round(avgCompScore),
      clientRank,
    };
  });
}

function identifyGaps(
  client: AuditReport,
  competitors: CompetitorEntry[],
  categoryComparison: CategoryComparison[]
): CompetitorGap[] {
  const gaps: CompetitorGap[] = [];

  for (const comp of categoryComparison) {
    for (const cs of comp.competitorScores) {
      if (cs.score > comp.clientScore) {
        const diff = cs.score - comp.clientScore;
        gaps.push({
          category: comp.category,
          finding: `${comp.categoryLabel}: ${cs.url} scores ${diff} points higher`,
          description: `Your ${comp.categoryLabel} score (${comp.clientScore}) is behind ${new URL(cs.url).hostname} (${cs.score}). Focus on ${comp.categoryLabel.toLowerCase()} improvements to close this gap.`,
          competitorUrl: cs.url,
          competitorScore: cs.score,
          clientScore: comp.clientScore,
          scoreDifference: diff,
        });
      }
    }
  }

  // Sort by largest gap first
  return gaps.sort((a, b) => b.scoreDifference - a.scoreDifference);
}

function identifyStrengths(
  client: AuditReport,
  competitors: CompetitorEntry[],
  categoryComparison: CategoryComparison[]
): CompetitorStrength[] {
  const strengths: CompetitorStrength[] = [];

  for (const comp of categoryComparison) {
    if (comp.clientScore > comp.averageCompetitorScore) {
      const advantage = comp.clientScore - comp.averageCompetitorScore;
      if (advantage >= 5) { // Only report meaningful advantages
        strengths.push({
          category: comp.category,
          finding: `${comp.categoryLabel}: ${advantage} points above competitor average`,
          description: `Your ${comp.categoryLabel} score (${comp.clientScore}) is above the competitor average (${comp.averageCompetitorScore}). Maintain this advantage.`,
          clientScore: comp.clientScore,
          averageCompetitorScore: comp.averageCompetitorScore,
          advantage,
        });
      }
    }
  }

  return strengths.sort((a, b) => b.advantage - a.advantage);
}
